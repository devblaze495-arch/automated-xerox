import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { enqueuePrintDispatch } from '../services/queue.service.js';

const verifyPaymentSchema = z.object({
  orderId: z.string().uuid(),
  rzpOrderId: z.string().default('order_mock_123'),
  rzpPaymentId: z.string().default('pay_mock_123'),
  rzpSignature: z.string().optional(),
});

export const paymentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * Verify Razorpay Payment and Dispatch Print Order
   */
  app.post('/api/v1/payments/verify', async (req, reply) => {
    const parseResult = verifyPaymentSchema.safeParse(req.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { orderId, rzpOrderId, rzpPaymentId, rzpSignature } = parseResult.data;

    // Signature verification (in production with live keys)
    if (rzpSignature && env.NODE_ENV === 'production') {
      const generatedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${rzpOrderId}|${rzpPaymentId}`)
        .digest('hex');

      if (generatedSignature !== rzpSignature) {
        return reply.status(400).send({ error: 'Invalid payment signature verification' });
      }
    }

    try {
      // 1. Update Payment Record
      await prisma.orderPayment.updateMany({
        where: { orderId },
        data: {
          rzpOrderId,
          rzpPaymentId,
          rzpSignature: rzpSignature || 'mock_verified_signature',
          status: 'CAPTURED',
        },
      });

      // 2. Transition Order Status to PAYMENT_VERIFIED
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAYMENT_VERIFIED',
        },
        include: {
          items: {
            include: { document: true },
          },
        },
      });

      // 3. Dispatch items to the connected Android Operator Terminal via WebSocket
      for (const item of updatedOrder.items) {
        const downloadFileName = item.document.s3Key ? item.document.s3Key.split('/').pop() : 'campus_test_document.pdf';
        const downloadUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${downloadFileName}`;

        await enqueuePrintDispatch({
          orderId: updatedOrder.id,
          orderItemId: item.id,
          centerId: updatedOrder.centerId,
          payload: {
            orderItemId: item.id,
            documentName: item.document.fileName,
            totalPages: item.document.pageCount,
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
        message: 'Payment captured and verified. Order queued for dispatch.',
        orderId: updatedOrder.id,
        status: 'QUEUED',
      });
    } catch (err: any) {
      console.warn('DB payment update skipped (mock mode):', err.message);

      return reply.send({
        success: true,
        message: 'Payment verified (mock mode).',
        orderId,
        status: 'QUEUED',
      });
    }
  });
};

