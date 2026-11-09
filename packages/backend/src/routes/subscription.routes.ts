import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { subscriptionService } from '../services/subscription.service.js';
import { upiGatewayService } from '../services/upiGateway.service.js';

const subscribeSchema = z.object({
  userId: z.string().optional().default('00000000-0000-0000-0000-000000000001'),
  planType: z.enum(['MONTHLY', 'ANNUAL']),
});

const statusQuerySchema = z.object({
  userId: z.string().optional().default('00000000-0000-0000-0000-000000000001'),
});

export const subscriptionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /api/v1/subscription/subscribe
   * Initiates subscription order via self-hosted mynkdev-21/upi-gateway
   */
  app.post('/api/v1/subscription/subscribe', async (req, reply) => {
    const parseResult = subscribeSchema.safeParse(req.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { userId, planType } = parseResult.data;

    try {
      const orderData = await subscriptionService.createSubscriptionOrder(userId, planType);
      return reply.status(200).send(orderData);
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Subscription Order Failed',
        message: err.message,
      });
    }
  });

  /**
   * POST /api/v1/subscription/webhook
   * Ingress handler for self-hosted mynkdev-21/upi-gateway webhooks
   * Cryptographically validates X-Signature and reconciles subscription state idempotently
   */
  app.post(
    '/api/v1/subscription/webhook',
    { config: { rawBody: true } },
    async (req, reply) => {
      const signature =
        (req.headers['x-signature'] as string) ||
        (req.headers['x-api-signature'] as string) ||
        (req.headers['x-gateway-signature'] as string);

      const rawBody =
        (req as any).rawBody ||
        (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      // Cryptographic signature check
      const isValid = upiGatewayService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        return reply.status(400).send({
          error: 'Invalid Webhook Signature',
          message: 'X-Signature failed cryptographic verification against configured secret.',
        });
      }

      const body = (req.body || {}) as any;
      const data = body.data || body;
      const event = body.event || (data.status === 'paid' ? 'order.paid' : 'unknown');

      // Extract clientOrderId and details
      const clientOrderId = data.client_order_id || data.clientOrderId;
      const utr = data.utr || data.bank_ref_no || data.transaction_id;
      const amount = data.amount ? Number(data.amount) : undefined;

      if (!clientOrderId) {
        return reply.status(400).send({
          error: 'Missing client_order_id',
          message: 'Webhook payload does not contain client_order_id',
        });
      }

      if (event === 'order.paid' || data.status === 'paid' || data.status === 'success') {
        try {
          const result = await subscriptionService.handleWebhookOrderPaid(clientOrderId, utr, amount);
          return reply.send({
            success: true,
            event: 'order.paid',
            clientOrderId,
            message: result.alreadyProcessed
              ? 'Payment previously processed (idempotent)'
              : 'Subscription activated successfully',
            subscription: result.subscription,
          });
        } catch (err: any) {
          return reply.status(500).send({
            error: 'Webhook Reconciliation Failed',
            message: err.message,
          });
        }
      }

      return reply.send({
        success: true,
        message: `Event '${event}' acknowledged without subscription transition`,
      });
    }
  );

  /**
   * GET /api/v1/subscription/status
   * Evaluates if student has active zero-queue printing access
   */
  app.get('/api/v1/subscription/status', async (req, reply) => {
    const parseResult = statusQuerySchema.safeParse(req.query);
    const userId = parseResult.success
      ? parseResult.data.userId
      : '00000000-0000-0000-0000-000000000001';

    try {
      const status = await subscriptionService.getSubscriptionStatus(userId);
      return reply.send({
        success: true,
        data: status,
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: 'Failed to retrieve subscription status',
        message: err.message,
      });
    }
  });
};

