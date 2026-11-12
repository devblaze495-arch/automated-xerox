import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { printerService } from '../services/printer.service.js';
import { orderStore } from '../services/order.store.js';
import { enqueuePrintDispatch } from '../services/queue.service.js';
import { refundService } from '../services/refund.service.js';
import { AnalyticsService } from '../services/analytics.service.js';
import { env } from '../config/env.js';
import { notificationService } from '../services/notification.service.js';
import { agentRegistry } from '../ws/agent.registry.js';

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

const pauseSpoolerSchema = z.object({
  centerId: z.string().optional(),
  paused: z.boolean(),
});

const bumpPrioritySchema = z.object({
  isUrgent: z.boolean().optional().default(true),
});

const reroutePrinterSchema = z.object({
  targetPrinterName: z.string().min(1, 'Target printer name is required'),
});

const scanCollectSchema = z.object({
  centerId: z.string().optional().default('00000000-0000-0000-0000-000000000002'),
  scanInput: z.string().min(1, 'Scan input is required'),
});

const walkInSchema = z.object({
  centerId: z.string().optional().default('00000000-0000-0000-0000-000000000002'),
  paperSize: z.enum(['A4', 'A3']).default('A4'),
  sheets: z.number().int().positive('Sheets must be at least 1'),
  colorMode: z.enum(['BW', 'COLOR']).default('BW'),
  amountCollected: z.number().nonnegative('Amount collected must be non-negative'),
  note: z.string().optional(),
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

    const isSpoolerPaused =
      agentRegistry.isSpoolerPaused('00000000-0000-0000-0000-000000000002') ||
      agentRegistry.isSpoolerPaused('CTR-CAMPUS-01');

    return reply.send({
      success: true,
      total: formattedOrders.length,
      isSpoolerPaused,
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

    // If no printer specified, smart-route using selectOptimalPrinter
    if (!selectedPrinter && order.items.length > 0) {
      const firstItem = order.items[0];
      selectedPrinter = printerService.selectOptimalPrinter(order.centerId, {
        paperSize: firstItem.paperSize,
        colorMode: firstItem.colorMode,
        duplexMode: firstItem.duplexMode,
        totalSheets: order.totalSheets,
      });

      if (!selectedPrinter) {
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
    }

    // Default to first online printer if still none
    if (!selectedPrinter) {
      selectedPrinter = printerService.getAllPrinters().find((p) => p.isOnline);
    }

    // Transition order state to QUEUED
    const updatedOrder = orderStore.updateStatus(order.id, 'QUEUED', {
      printerId: selectedPrinter?.id,
    });

    // Check if spooler is currently paused for walk-ins
    const isPaused =
      agentRegistry.isSpoolerPaused(order.centerId) ||
      agentRegistry.isSpoolerPaused('00000000-0000-0000-0000-000000000002');

    if (!isPaused) {
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
    } else {
      console.log(`⏸️ Spooler paused for Center ${order.centerId}. Holding Order #${order.id.substring(0, 8)} in digital queue.`);
    }

    return reply.send({
      success: true,
      message: isPaused
        ? `Order accepted and safely held in queue (Spooler paused for walk-ins).`
        : `Order accepted and routed to ${selectedPrinter?.name || 'spooler'}. Dispatch event emitted.`,
      order: updatedOrder,
      isSpoolerPaused: isPaused,
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

    // Fire-and-forget: notify student their order is ready
    notificationService.sendOrderReadyAlert({
      phone: order.studentPhone || '',
      studentName: order.studentName || 'Student',
      orderId: order.id,
      pickupOtp: order.collectionOtp,
      centerName: 'Central Library Print Station',
    });

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

    // Sync collected timestamp to DB
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'COLLECTED',
          collectedAt: new Date(),
        },
      });
    } catch (_err) { }

    // Auto-delete document files for privacy if configured
    const purgedCount = await AnalyticsService.autoPurgeOrderDocuments(order.id);

    // Deduct physical paper stock
    await AnalyticsService.deductPaperStock(order.items);

    return reply.send({
      success: true,
      message: `Collection OTP verified! Order handed over to student.${purgedCount > 0 ? ` ${purgedCount} document file(s) permanently purged for privacy.` : ''
        }`,
      order: updated,
      purgedCount,
    });
  });

  /**
   * POST /api/v1/operator/orders/scan-collect
   * Instant Counter Handover via USB Scanner wedge or Webcam QR scanner
   * Accepts:
   *   Format A: CAMPUSPRINT_PICKUP:<orderId>:<pickupOtp>
   *   Format B: <4-digit-otp>
   */
  app.post('/api/v1/operator/orders/scan-collect', async (req, reply) => {
    const parseResult = scanCollectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { centerId, scanInput: rawInput } = parseResult.data;
    const input = rawInput.trim();

    let targetOrderId: string | null = null;
    let expectedOtp: string | null = null;

    if (input.startsWith('CAMPUSPRINT_PICKUP:')) {
      // Format A: CAMPUSPRINT_PICKUP:<orderId>:<pickupOtp>
      const parts = input.split(':');
      if (parts.length < 3) {
        return reply.status(400).send({
          error: 'Invalid QR Ticket Format. Expected CAMPUSPRINT_PICKUP:<orderId>:<pickupOtp>',
        });
      }
      targetOrderId = parts[1];
      expectedOtp = parts[2];
    } else if (/^\d{4}$/.test(input)) {
      // Format B: Raw 4-digit OTP
      expectedOtp = input;
      // Search active orders in orderStore
      const allOrders = orderStore.getAllOrders();
      const match = allOrders.find(
        (o) =>
          o.collectionOtp === input &&
          o.status !== 'COLLECTED' &&
          o.status !== 'COMPLETED' &&
          o.status !== 'REFUNDED' &&
          (o.centerId === centerId ||
            o.centerId === 'CTR-CAMPUS-01' ||
            centerId === 'CTR-CAMPUS-01' ||
            centerId === '00000000-0000-0000-0000-000000000002')
      );

      if (!match) {
        const alreadyCollected = allOrders.find(
          (o) => o.collectionOtp === input && (o.status === 'COLLECTED' || o.status === 'COMPLETED')
        );
        if (alreadyCollected) {
          return reply.status(400).send({ error: 'Order has already been collected' });
        }
        return reply.status(404).send({ error: `No active order found with OTP: ${input}` });
      }

      targetOrderId = match.id;
    } else {
      return reply.status(400).send({
        error: 'Unrecognized barcode format. Expected CAMPUSPRINT_PICKUP QR or 4-digit OTP.',
      });
    }

    const order = orderStore.getOrder(targetOrderId);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found for scanned ticket' });
    }

    // Check if already collected
    if (order.status === 'COLLECTED' || order.status === 'COMPLETED') {
      return reply.status(400).send({ error: 'Order has already been collected' });
    }

    // Validate OTP if provided in Format A
    if (expectedOtp && order.collectionOtp !== expectedOtp) {
      return reply.status(400).send({
        error: `Invalid Pickup OTP in ticket! Expected ${order.collectionOtp}, received ${expectedOtp}`,
      });
    }

    // Update order state
    const updated = orderStore.updateStatus(order.id, 'COLLECTED');

    // Sync to PostgreSQL
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'COLLECTED',
          collectedAt: new Date(),
        },
      });
    } catch (_err) {}

    // Auto-purge document files for privacy if configured
    const purgedCount = await AnalyticsService.autoPurgeOrderDocuments(order.id);

    // Deduct physical paper stock
    await AnalyticsService.deductPaperStock(order.items);

    return reply.send({
      success: true,
      message: `Pickup confirmed! Order #${order.id.substring(0, 8)} successfully handed over.`,
      purgedCount,
      order: {
        id: order.id,
        shortId: order.id.substring(0, 8),
        studentName: order.studentName || 'Student',
        totalSheets: order.totalSheets,
        amountPaid: order.totalAmountCents / 100,
        documentNames: order.items.map((i) => i.documentName),
      },
    });
  });

  /**
   * POST /api/v1/operator/walk-in
   * Quick Counter / Walk-in Customer Logging
   * Creates a COLLECTED order record so daily revenue analytics and A4/A3 paper stock stay accurate.
   */
  app.post('/api/v1/operator/walk-in', async (req, reply) => {
    const parseResult = walkInSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { centerId, paperSize, sheets, colorMode, amountCollected, note } = parseResult.data;
    const resolvedCenterId =
      centerId === 'CTR-CAMPUS-01' ? '00000000-0000-0000-0000-000000000002' : centerId;

    const walkInId = crypto.randomUUID();
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const amountCents = Math.round(amountCollected * 100);
    const docName = note?.trim() || `Walk-in Print (${sheets} ${paperSize} ${colorMode})`;

    const enrichedWalkIn: any = {
      id: walkInId,
      studentId: '00000000-0000-0000-0000-000000000001',
      studentName: 'Walk-in Counter Customer',
      studentPhone: '+91 Counter Cash',
      centerId: resolvedCenterId,
      status: 'COLLECTED',
      collectionOtp: otp,
      totalSheets: sheets,
      subtotalCents: amountCents,
      convenienceFeeCents: 0,
      totalAmountCents: amountCents,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: crypto.randomUUID(),
          orderId: walkInId,
          documentId: crypto.randomUUID(),
          documentName: docName,
          totalPages: sheets,
          pageRange: 'ALL',
          colorMode,
          paperSize,
          duplexMode: 'SIMPLEX',
          copies: 1,
          computedSheets: sheets,
          itemTotalCents: amountCents,
        },
      ],
      payment: {
        status: 'CAPTURED',
        amountCents,
        rzpPaymentId: 'cash_counter_walkin',
      },
    };

    // Save in in-memory order store
    orderStore.saveOrder(enrichedWalkIn);

    // Sync to PostgreSQL DB for permanent ledger
    try {
      await prisma.order.create({
        data: {
          id: walkInId,
          studentId: '00000000-0000-0000-0000-000000000001',
          centerId: resolvedCenterId,
          status: 'COLLECTED',
          collectionOtp: otp,
          totalSheets: sheets,
          colorSheets: colorMode === 'COLOR' ? sheets : 0,
          bwSheets: colorMode === 'BW' ? sheets : 0,
          isDuplex: false,
          paperSize,
          amountPaid: amountCollected,
          subtotalCents: amountCents,
          convenienceFeeCents: 0,
          totalAmountCents: amountCents,
          collectedAt: new Date(),
        },
      });
    } catch (_err) {
      // In-memory fallback if mock
    }

    // Deduct physical paper stock
    await AnalyticsService.deductPaperStock([{ paperSize, computedSheets: sheets }]);

    return reply.send({
      success: true,
      message: `Walk-in print logged: ${sheets} ${paperSize} (${colorMode}) sheets, ₹${amountCollected.toFixed(2)} collected. Stock deducted.`,
      order: {
        id: walkInId,
        shortId: walkInId.substring(0, 8),
        totalSheets: sheets,
        amountPaid: amountCollected,
        paperSize,
        colorMode,
        note: docName,
      },
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

  /**
   * PATCH /api/v1/operator/spooler/pause
   * Toggles walk-in mode: pauses or resumes the digital print spooler and broadcasts to agent
   */
  app.patch('/api/v1/operator/spooler/pause', async (req, reply) => {
    const parseResult = pauseSpoolerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid pause payload',
        details: parseResult.error.format(),
      });
    }

    const { centerId = '00000000-0000-0000-0000-000000000002', paused } = parseResult.data;

    // 1. Update in Database / AnalyticsService
    await AnalyticsService.updateShopSettings(centerId, { isSpoolerPaused: paused }).catch(() => { });

    // 2. Broadcast SPOOLER_STATE message over active agent WebSocket
    const agentCount = agentRegistry.broadcastSpoolerState(centerId, paused);
    agentRegistry.broadcastSpoolerState('CTR-CAMPUS-01', paused);

    // 3. If unpaused, flush held queued orders to hardware spooler
    let flushedCount = 0;
    if (!paused) {
      const pendingQueued = orderStore.getAllOrders().filter((o) => o.status === 'QUEUED');
      for (const order of pendingQueued) {
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
              requiresManualFlip: order.requiresManualFlip || false,
              createdAt: Date.now(),
            },
          });
          flushedCount++;
        }
      }
    }

    return reply.send({
      success: true,
      paused,
      message: paused
        ? 'Auto-print spooler PAUSED (Walk-in Mode active). Digital jobs will be held.'
        : `Auto-print spooler RESUMED. ${flushedCount} held job(s) dispatched to hardware spooler.`,
      agentCount,
      flushedCount,
    });
  });

  /**
   * PATCH /api/v1/operator/orders/:id/priority
   * Sets isUrgent = true and priorityScore = Date.now() so order jumps to top of queue
   */
  app.patch('/api/v1/operator/orders/:id/priority', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseResult = bumpPrioritySchema.safeParse(req.body || {});
    const isUrgent = parseResult.success ? parseResult.data.isUrgent : true;
    const priorityScore = Date.now();

    const updated = orderStore.setOrderPriority(id, isUrgent, priorityScore);
    if (!updated) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    return reply.send({
      success: true,
      message: isUrgent
        ? `Order #${id.substring(0, 8)} bumped to top priority! It will print next.`
        : `Priority restored to standard FIFO for Order #${id.substring(0, 8)}.`,
      order: updated,
    });
  });

  /**
   * PATCH /api/v1/operator/orders/:id/printer
   * Manually re-routes an order to a specified Canon machine and dispatches immediately
   */
  app.patch('/api/v1/operator/orders/:id/printer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseResult = reroutePrinterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { targetPrinterName } = parseResult.data;
    const order = orderStore.getOrder(id);
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    // Match printer in registry by name or ID
    const allPrinters = printerService.getAllPrinters();
    const targetPrinter = allPrinters.find(
      (p) =>
        p.name.toLowerCase() === targetPrinterName.toLowerCase() ||
        p.id.toLowerCase() === targetPrinterName.toLowerCase() ||
        p.portName.toLowerCase() === targetPrinterName.toLowerCase() ||
        (targetPrinterName.includes('G2010') && p.name.includes('G2010')) ||
        (targetPrinterName.includes('G3070') && p.name.includes('G3070')) ||
        (targetPrinterName.includes('2224') && (p.name.includes('2224') || p.name.includes('UFR')))
    );

    if (!targetPrinter) {
      return reply.status(404).send({
        error: `Target printer '${targetPrinterName}' not found in registry`,
      });
    }

    // Update assigned printer in order store
    const updatedOrder = orderStore.setOrderPrinter(order.id, targetPrinter);

    // Transition status to QUEUED if currently WAITING_FOR_OPERATOR or PAYMENT_VERIFIED
    if (updatedOrder.status === 'WAITING_FOR_OPERATOR' || updatedOrder.status === 'PAYMENT_VERIFIED') {
      orderStore.updateStatus(updatedOrder.id, 'QUEUED', { printerId: targetPrinter.id });
      updatedOrder.status = 'QUEUED';
    }

    // Check if spooler is currently paused for walk-ins
    const isPaused =
      agentRegistry.isSpoolerPaused(order.centerId) ||
      agentRegistry.isSpoolerPaused('00000000-0000-0000-0000-000000000002');

    // Dispatch items to the connected agent gateway for the selected printer
    if (!isPaused) {
      for (const item of updatedOrder.items) {
        const downloadFileName = item.documentName ? item.documentName.split('/').pop() : 'campus_job.pdf';
        const downloadUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${downloadFileName}`;

        await enqueuePrintDispatch({
          orderId: updatedOrder.id,
          orderItemId: item.id,
          centerId: updatedOrder.centerId,
          payload: {
            orderItemId: item.id,
            documentName: item.documentName,
            totalPages: item.totalPages,
            colorMode: item.colorMode,
            duplexMode: item.duplexMode,
            paperSize: item.paperSize,
            copies: item.copies,
            downloadUrl,
            targetPrinter: {
              id: targetPrinter.id,
              name: targetPrinter.name,
              portName: targetPrinter.portName,
            },
            requiresManualFlip: updatedOrder.requiresManualFlip || false,
            createdAt: Date.now(),
          },
        });
      }
    }

    return reply.send({
      success: true,
      message: `Order #${id.substring(0, 8)} re-routed to ${targetPrinter.name} (${targetPrinter.portName})`,
      order: updatedOrder,
      targetPrinter,
    });
  });
};

