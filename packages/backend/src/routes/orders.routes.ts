import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { calculateItemPrice, DEFAULT_RATE_CARD } from '../services/pricing.service.js';
import { enqueuePrintDispatch } from '../services/queue.service.js';
import { orderStore, EnrichedOrder } from '../services/order.store.js';
import { env } from '../config/env.js';

const orderItemInputSchema = z.object({
  documentId: z.string(),
  pageRange: z.string().optional().default('ALL'),
  colorMode: z.enum(['BW', 'COLOR']).default('BW'),
  paperSize: z.enum(['A4', 'A3']).default('A4'),
  duplexMode: z.enum(['SIMPLEX', 'DUPLEX_LONG', 'DUPLEX_SHORT']).default('SIMPLEX'),
  copies: z.number().int().min(1).default(1),
  pageCount: z.number().int().min(1).optional().default(1),
});

const createOrderSchema = z.object({
  studentId: z.string().optional().default('00000000-0000-0000-0000-000000000001'),
  centerId: z.string().optional().default('00000000-0000-0000-0000-000000000002'),
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one item'),
});

export const orderRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * Create an unconfirmed order in PAYMENT_PENDING state with 4-digit OTP.
   */
  app.post('/api/v1/orders/create', async (req, reply) => {
    const parseResult = createOrderSchema.safeParse(req.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { studentId, centerId, items } = parseResult.data;

    // 1. Generate 4-digit collection OTP
    const collectionOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // 2. Compute exact pricing for each item
    let totalSheets = 0;
    let subtotalCents = 0;

    const computedItems = items.map((item) => {
      const calc = calculateItemPrice({
        pageCount: item.pageCount,
        pageRange: item.pageRange,
        colorMode: item.colorMode,
        paperSize: item.paperSize,
        duplexMode: item.duplexMode,
        copies: item.copies,
      });

      totalSheets += calc.totalSheets;
      subtotalCents += calc.itemTotalCents;

      return {
        ...item,
        computedSheets: calc.totalSheets,
        itemTotalCents: calc.itemTotalCents,
      };
    });

    const convenienceFeeCents = DEFAULT_RATE_CARD.convenienceFeeCents;
    const totalAmountCents = subtotalCents + convenienceFeeCents;
    const orderId = crypto.randomUUID();

    // 3. Persist Order in orderStore
    const newStoreOrder: EnrichedOrder = {
      id: orderId,
      studentId,
      studentName: 'Campus Student',
      studentPhone: '+91 98765 43210',
      centerId,
      status: 'PAYMENT_PENDING',
      collectionOtp,
      totalSheets,
      subtotalCents,
      convenienceFeeCents,
      totalAmountCents,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: computedItems.map((ci, idx) => ({
        id: `item-${orderId.slice(0, 8)}-${idx + 1}`,
        orderId,
        documentId: ci.documentId,
        documentName: `Document_${ci.documentId.slice(0, 6)}.pdf`,
        totalPages: ci.pageCount,
        pageRange: ci.pageRange,
        colorMode: ci.colorMode,
        paperSize: ci.paperSize,
        duplexMode: ci.duplexMode,
        copies: ci.copies,
        computedSheets: ci.computedSheets,
        itemTotalCents: ci.itemTotalCents,
      })),
      payment: {
        amountCents: totalAmountCents,
        status: 'PENDING',
      },
    };

    orderStore.saveOrder(newStoreOrder);

    // 4. Also attempt persistence in database if available
    try {
      await prisma.order.create({
        data: {
          id: orderId,
          studentId,
          centerId,
          status: 'PAYMENT_PENDING',
          collectionOtp,
          totalSheets,
          subtotalCents,
          convenienceFeeCents,
          totalAmountCents,
          items: {
            create: computedItems.map((ci) => ({
              documentId: ci.documentId,
              pageRange: ci.pageRange,
              colorMode: ci.colorMode,
              paperSize: ci.paperSize,
              duplexMode: ci.duplexMode,
              copies: ci.copies,
              computedSheets: ci.computedSheets,
              itemTotalCents: ci.itemTotalCents,
            })),
          },
          payment: {
            create: {
              amountCents: totalAmountCents,
              currency: 'INR',
              status: 'PENDING',
            },
          },
        },
      });
    } catch (_: any) {}

    return reply.status(201).send({
      success: true,
      data: {
        orderId,
        status: 'PAYMENT_PENDING',
        collectionOtp,
        totalSheets,
        subtotalCents,
        convenienceFeeCents,
        totalAmountCents,
        items: newStoreOrder.items,
        payment: newStoreOrder.payment,
        createdAt: newStoreOrder.createdAt,
      },
    });
  });

  /**
   * Confirm Payment and Trigger Print Dispatch
   */
  app.post('/api/v1/orders/:id/confirm-payment', async (req, reply) => {
    const { id } = req.params as { id: string };

    const order = orderStore.getOrder(id);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    orderStore.updateStatus(id, 'PAYMENT_VERIFIED');

    try {
      await prisma.order.update({
        where: { id },
        data: { status: 'PAYMENT_VERIFIED' },
      });
    } catch (_: any) {}

    // Dispatch items to print agent queue
    for (const item of order.items) {
      const downloadUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${item.documentName || 'mock.pdf'}`;

      await enqueuePrintDispatch({
        orderId: order.id,
        orderItemId: item.id,
        centerId: order.centerId,
        payload: {
          orderItemId: item.id,
          documentName: item.documentName,
          totalPages: item.totalPages,
          colorMode: item.colorMode,
          duplexMode: item.duplexMode,
          paperSize: item.paperSize,
          copies: item.copies,
          downloadUrl,
          createdAt: Date.now(),
        },
      });
    }

    return reply.send({
      success: true,
      message: 'Payment confirmed. Print jobs dispatched to operator terminal.',
      orderId: order.id,
      status: 'QUEUED',
    });
  });

  /**
   * Get Order Status with live queue position & wait time
   */
  app.get('/api/v1/orders/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const order = orderStore.getOrder(id);

    if (!order) {
      // Try querying Prisma DB
      try {
        const dbOrder = await prisma.order.findUnique({
          where: { id },
          include: {
            items: {
              include: { document: true, printJobs: true },
            },
            payment: true,
          },
        });

        if (!dbOrder) {
          return reply.status(404).send({ error: 'Order not found' });
        }

        const queueMetrics = orderStore.calculateQueuePosition(id);
        return reply.send({
          success: true,
          data: {
            ...dbOrder,
            queuePosition: queueMetrics.queuePosition,
            estimatedWaitMinutes: queueMetrics.estimatedWaitMinutes,
          },
        });
      } catch (_: any) {
        return reply.status(404).send({ error: 'Order not found' });
      }
    }

    const queueMetrics = orderStore.calculateQueuePosition(order.id);

    return reply.send({
      success: true,
      data: {
        ...order,
        queuePosition: queueMetrics.queuePosition,
        estimatedWaitMinutes: queueMetrics.estimatedWaitMinutes,
        aheadJobsCount: queueMetrics.aheadJobsCount,
        aheadSheets: queueMetrics.aheadSheets,
      },
    });
  });
};
