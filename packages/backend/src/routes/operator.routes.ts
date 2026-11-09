import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { printerService } from '../services/printer.service.js';
import { orderStore } from '../services/order.store.js';
import { enqueuePrintDispatch } from '../services/queue.service.js';
import { refundService } from '../services/refund.service.js';
import { env } from '../config/env.js';

const acceptOrderSchema = z.object({
  printerId: z.string().optional(),
});

const rejectOrderSchema = z.object({
  reason: z.string().optional().default('Cancelled by operator at print station'),
});

const collectOrderSchema = z.object({
  collectionOtp: z.string().min(4, 'Collection OTP must be 4 digits'),
});

const togglePrinterSchema = z.object({
  isOnline: z.boolean().optional(),
});

export const operatorRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/operator/orders
   * Lists all campus orders with item breakdown, document metadata, and printer compatibility
   */
  app.get('/api/v1/operator/orders', async (req, reply) => {
    const orders = orderStore.getAllOrders();

    const formattedOrders = orders.map((order) => {
      const queueMetrics = orderStore.calculateQueuePosition(order.id);
      return {
        ...order,
        queuePosition: queueMetrics.queuePosition,
        estimatedWaitMinutes: queueMetrics.estimatedWaitMinutes,
      };
    });

    return reply.send({
      success: true,
      total: formattedOrders.length,
      data: formattedOrders,
    });
  });

  /**
   * POST /api/v1/operator/orders/:id/accept
   * Transitions order to QUEUED, selects the best compatible printer, and dispatches to agent
   */
  app.post('/api/v1/operator/orders/:id/accept', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bodyResult = acceptOrderSchema.safeParse(req.body || {});
    const requestedPrinterId = bodyResult.success ? bodyResult.data.printerId : undefined;

    const order = orderStore.getOrder(id);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    // Determine target printer
    let selectedPrinter = requestedPrinterId ? printerService.getPrinterById(requestedPrinterId) : undefined;

    // If no printer specified, auto-route based on first item specs
    if (!selectedPrinter && order.items.length > 0) {
      const firstItem = order.items[0];
      const matches = printerService.findCompatiblePrinters({
        paperSize: firstItem.paperSize,
        colorMode: firstItem.colorMode,
        duplexMode: firstItem.duplexMode,
        copies: firstItem.copies,
      });

      if (matches.length > 0) {
        selectedPrinter = matches[0].printer;
      }
    }

    // Default to first online printer if still none
    if (!selectedPrinter) {
      selectedPrinter = printerService.getAllPrinters().find((p) => p.isOnline);
    }

    // Transition order state to QUEUED
    const updatedOrder = orderStore.updateStatus(order.id, 'QUEUED', {
      printerId: selectedPrinter?.id,
    });

    // Dispatch items to the connected agent gateway
    for (const item of order.items) {
      const downloadFileName = item.documentName ? item.documentName.split('/').pop() : 'campus_job.pdf';
      const downloadUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${downloadFileName}`;

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
          targetPrinter: selectedPrinter
            ? {
                id: selectedPrinter.id,
                name: selectedPrinter.name,
                portName: selectedPrinter.portName,
              }
            : undefined,
          requiresManualFlip: updatedOrder?.requiresManualFlip || false,
          createdAt: Date.now(),
        },
      });
    }

    return reply.send({
      success: true,
      message: `Order accepted and routed to ${selectedPrinter?.name || 'spooler'}. Dispatch event emitted.`,
      order: updatedOrder,
    });
  });

  /**
   * POST /api/v1/operator/orders/:id/ready
   * Marks printing finished, transitioning order to READY_FOR_COLLECTION
   */
  app.post('/api/v1/operator/orders/:id/ready', async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = orderStore.getOrder(id);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const updated = orderStore.updateStatus(order.id, 'READY_FOR_COLLECTION');

    return reply.send({
      success: true,
      message: 'Order marked ready for student pickup.',
      order: updated,
    });
  });

  /**
   * POST /api/v1/operator/orders/:id/collect
   * Validates the student's 4-digit Collection OTP and marks order COLLECTED
   */
  app.post('/api/v1/operator/orders/:id/collect', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseResult = collectOrderSchema.safeParse(req.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { collectionOtp } = parseResult.data;
    const order = orderStore.getOrder(id);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    // Verify 4-digit OTP
    if (order.collectionOtp !== collectionOtp.trim()) {
      return reply.status(400).send({
        error: `Invalid Collection OTP! Expected: ${order.collectionOtp}, Received: ${collectionOtp}`,
      });
    }

    const updated = orderStore.updateStatus(order.id, 'COLLECTED');

    return reply.send({
      success: true,
      message: 'Collection OTP verified successfully! Order handed over to student.',
      order: updated,
    });
  });

  /**
   * POST /api/v1/operator/orders/:id/reject
   * Transitions order to REFUNDED and triggers automated Razorpay refund
   */
  app.post('/api/v1/operator/orders/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseResult = rejectOrderSchema.safeParse(req.body || {});
    const reason = parseResult.success ? parseResult.data.reason : 'Rejected by operator at print station';

    const order = orderStore.getOrder(id);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    try {
      const refundResult = await refundService.processRefund(order.id, undefined, reason);
      const updated = orderStore.getOrder(order.id);

      return reply.send({
        success: true,
        message: refundResult.message,
        refundId: refundResult.refundId,
        order: updated,
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Refund Processing Failed',
        message: err.message,
      });
    }
  });

  /**
   * GET /api/v1/printers
   * Lists all physical printers with capability badges & queue counts
   */
  app.get('/api/v1/printers', async (req, reply) => {
    const printers = printerService.getAllPrinters();
    return reply.send({
      success: true,
      total: printers.length,
      data: printers,
    });
  });

  /**
   * PATCH /api/v1/printers/:id/toggle
   * Toggles online/offline status for a printer
   */
  app.patch('/api/v1/printers/:id/toggle', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseResult = togglePrinterSchema.safeParse(req.body || {});
    const targetStatus = parseResult.success ? parseResult.data.isOnline : undefined;

    const updated = await printerService.togglePrinterOnline(id, targetStatus);
    if (!updated) {
      return reply.status(404).send({ error: 'Printer not found in registry' });
    }

    return reply.send({
      success: true,
      message: `Printer ${updated.name} is now ${updated.isOnline ? 'ONLINE' : 'OFFLINE'}`,
      data: updated,
    });
  });
};

