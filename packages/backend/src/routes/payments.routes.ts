import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { paymentService } from '../services/payment.service.js';
import { orderStore } from '../services/order.store.js';

const createOrderSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  amountCents: z.number().int().positive().optional(),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  rzpOrderId: z.string().default('order_mock_123'),
  rzpPaymentId: z.string().default('pay_mock_123'),
  rzpSignature: z.string().optional(),
});

export const paymentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/v1/payments/create-order
   * Initializes a Razorpay order in INR paise and attaches rzpOrderId to the order
   */
  app.post('/api/v1/payments/create-order', async (req, reply) => {
    const parseResult = createOrderSchema.safeParse(req.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { orderId, amountCents } = parseResult.data;

    try {
      const orderResult = await paymentService.createRazorpayOrder(orderId, amountCents);
      return reply.send({
        success: true,
        ...orderResult,
        orderId,
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Order Creation Failed',
        message: err.message,
      });
    }
  });

  /**
   * POST /api/v1/payments/verify
   * Student frontend verification callback after Razorpay checkout
   * Performs timing-safe HMAC validation, captures payment, and enqueues print jobs
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

    // 1. Timing-safe cryptographic HMAC verification
    const isValid = paymentService.verifyPaymentSignature(rzpOrderId, rzpPaymentId, rzpSignature);
    if (!isValid) {
      return reply.status(400).send({
        error: 'Invalid Payment Signature',
        message: 'Cryptographic signature verification failed. The transaction may have been tampered with.',
      });
    }

    // 2. Idempotent payment reconciliation & print dispatch
    const result = await paymentService.reconcilePaymentSuccess({
      orderId,
      rzpOrderId,
      rzpPaymentId,
      rzpSignature,
    });

    if (!result.success) {
      return reply.status(404).send({
        error: 'Order Not Found',
        message: `Order ${orderId} does not exist in active records.`,
      });
    }

    return reply.send({
      success: true,
      message: result.alreadyProcessed
        ? 'Payment already verified and queued.'
        : 'Payment verified and print jobs dispatched to operator terminal.',
      orderId,
      status: 'QUEUED',
      alreadyProcessed: result.alreadyProcessed,
    });
  });

  /**
   * POST /api/v1/payments/webhook
   * Ingress handler for asynchronous Razorpay webhooks (payment.captured, payment.failed)
   * Validates X-Razorpay-Signature and reconciles order state idempotently
   */
  app.post('/api/v1/payments/webhook', async (req, reply) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // Cryptographic webhook HMAC signature verification
    const isValid = paymentService.verifyWebhookSignature(bodyString, signature);
    if (!isValid) {
      return reply.status(400).send({
        error: 'Invalid Webhook Signature',
        message: 'X-Razorpay-Signature did not match the configured webhook secret.',
      });
    }

    const payload = (req.body || {}) as any;
    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;

    if (!paymentEntity) {
      return reply.send({ success: true, message: 'Unhandled payload entity' });
    }

    const rzpOrderId = paymentEntity.order_id;
    const rzpPaymentId = paymentEntity.id;

    // Locate internal orderId from notes or matching orderStore
    let internalOrderId = paymentEntity.notes?.orderId;
    if (!internalOrderId && rzpOrderId) {
      const allOrders = orderStore.getAllOrders();
      const matched = allOrders.find(
        (o) => o.payment?.rzpOrderId === rzpOrderId || o.id === rzpOrderId
      );
      if (matched) internalOrderId = matched.id;
    }

    if (!internalOrderId) {
      return reply.send({
        success: true,
        message: 'Order reference not found in webhook notes; acknowledged without state change.',
      });
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      await paymentService.reconcilePaymentSuccess({
        orderId: internalOrderId,
        rzpOrderId,
        rzpPaymentId,
      });
      return reply.send({ success: true, event, orderId: internalOrderId, status: 'CAPTURED' });
    }

    if (event === 'payment.failed') {
      const reason = paymentEntity.error_description || 'Payment failed via webhook notification';
      await paymentService.reconcilePaymentFailure(internalOrderId, reason);
      return reply.send({ success: true, event, orderId: internalOrderId, status: 'FAILED' });
    }

    return reply.send({ success: true, event, message: 'Event recorded' });
  });
};
