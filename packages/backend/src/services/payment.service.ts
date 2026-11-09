import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { orderStore, EnrichedOrder } from './order.store.js';
import { prisma } from '../db/prisma.js';
import { enqueuePrintDispatch } from './queue.service.js';

export interface CreateOrderResult {
  rzpOrderId: string;
  amount: number; // in paise
  currency: string;
  keyId: string;
}

export class PaymentService {
  private razorpay: any;

  constructor() {
    try {
      this.razorpay = new (Razorpay as any)({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    } catch (err: any) {
      console.warn('⚠️ Razorpay client initialization fallback:', err.message);
    }
  }

  /**
   * Creates a Razorpay order in INR (100 paise = 100 cents)
   * Falls back to deterministic mock ID if offline or mock credentials used
   */
  public async createRazorpayOrder(orderId: string, amountCents?: number): Promise<CreateOrderResult> {
    const order = orderStore.getOrder(orderId);
    const effectiveAmountCents = amountCents ?? (order?.totalAmountCents || 100);
    const amountPaise = Math.round(effectiveAmountCents);

    let rzpOrderId = `order_mock_${crypto.randomBytes(6).toString('hex')}`;

    if (this.razorpay && !env.RAZORPAY_KEY_ID.startsWith('rzp_test_campus')) {
      try {
        const response = await this.razorpay.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt: orderId.substring(0, 40),
          notes: {
            orderId,
            platform: 'CampusPrint',
          },
        });
        if (response && response.id) {
          rzpOrderId = response.id;
        }
      } catch (err: any) {
        console.warn(`[PaymentService] Live Razorpay order creation failed, using sandbox fallback: ${err.message}`);
      }
    }

    // Persist rzpOrderId in orderStore
    if (order) {
      if (!order.payment) {
        order.payment = {
          status: 'PENDING',
          amountCents: effectiveAmountCents,
        };
      }
      order.payment.rzpOrderId = rzpOrderId;
      orderStore.saveOrder(order);
    }

    // Also persist to DB if available
    try {
      await prisma.orderPayment.upsert({
        where: { orderId },
        update: {
          rzpOrderId,
          status: 'PENDING',
          amountCents: effectiveAmountCents,
        },
        create: {
          orderId,
          rzpOrderId,
          status: 'PENDING',
          amountCents: effectiveAmountCents,
          currency: 'INR',
        },
      });
    } catch (_: any) {}

    return {
      rzpOrderId,
      amount: amountPaise,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * Verifies Razorpay payment signature using timing-safe comparison
   */
  public verifyPaymentSignature(
    rzpOrderId: string,
    rzpPaymentId: string,
    rzpSignature?: string
  ): boolean {
    if (!rzpSignature) {
      // In dev mode allow unsigned if mock
      return env.NODE_ENV !== 'production';
    }

    // Allow mock signature in non-production
    if (
      env.NODE_ENV !== 'production' &&
      (rzpSignature === 'mock_signature_verified' || rzpSignature.startsWith('mock_'))
    ) {
      return true;
    }

    const payload = `${rzpOrderId}|${rzpPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const receivedBuffer = Buffer.from(rzpSignature, 'utf-8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  /**
   * Verifies Razorpay Webhook signature from X-Razorpay-Signature header
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    if (!signatureHeader) return false;

    if (env.NODE_ENV !== 'production' && signatureHeader === 'mock_webhook_signature') {
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8'))
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const receivedBuffer = Buffer.from(signatureHeader, 'utf-8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  /**
   * Idempotent payment reconciliation & print dispatch
   */
  public async reconcilePaymentSuccess(params: {
    orderId: string;
    rzpOrderId?: string;
    rzpPaymentId?: string;
    rzpSignature?: string;
  }): Promise<{ success: boolean; alreadyProcessed: boolean; order: EnrichedOrder | null }> {
    const { orderId, rzpOrderId, rzpPaymentId, rzpSignature } = params;

    const existingOrder = orderStore.getOrder(orderId);
    if (!existingOrder) {
      return { success: false, alreadyProcessed: false, order: null };
    }

    // Idempotency check: if order is already captured and moved to verification or queue
    const activeStatuses = ['PAYMENT_VERIFIED', 'QUEUED', 'PRINTING', 'READY_FOR_COLLECTION', 'COLLECTED'];
    if (activeStatuses.includes(existingOrder.status)) {
      return { success: true, alreadyProcessed: true, order: existingOrder };
    }

    // Transition state
    existingOrder.status = 'PAYMENT_VERIFIED';
    existingOrder.updatedAt = new Date();
    if (!existingOrder.payment) {
      existingOrder.payment = {
        status: 'CAPTURED',
        amountCents: existingOrder.totalAmountCents,
        rzpOrderId,
        rzpPaymentId,
      };
    } else {
      existingOrder.payment.status = 'CAPTURED';
      if (rzpOrderId) existingOrder.payment.rzpOrderId = rzpOrderId;
      if (rzpPaymentId) existingOrder.payment.rzpPaymentId = rzpPaymentId;
    }
    orderStore.saveOrder(existingOrder);

    // Sync to PostgreSQL DB if available
    try {
      await prisma.orderPayment.updateMany({
        where: { orderId },
        data: {
          rzpOrderId,
          rzpPaymentId,
          rzpSignature: rzpSignature || 'mock_verified_signature',
          status: 'CAPTURED',
        },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAYMENT_VERIFIED' },
      });
    } catch (_: any) {}

    // Dispatch items to the connected Android Operator Terminal via WebSocket
    for (const item of existingOrder.items) {
      const downloadFileName = item.documentName ? item.documentName.split('/').pop() : 'campus_test_document.pdf';
      const downloadUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${downloadFileName}`;

      await enqueuePrintDispatch({
        orderId: existingOrder.id,
        orderItemId: item.id,
        centerId: existingOrder.centerId,
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

    return { success: true, alreadyProcessed: false, order: existingOrder };
  }

  /**
   * Reconciles payment failure
   */
  public async reconcilePaymentFailure(orderId: string, reason?: string): Promise<boolean> {
    const existingOrder = orderStore.getOrder(orderId);
    if (!existingOrder) return false;

    // Do not fail if already captured or completed
    if (['PAYMENT_VERIFIED', 'QUEUED', 'PRINTING', 'READY_FOR_COLLECTION', 'COLLECTED'].includes(existingOrder.status)) {
      return false;
    }

    existingOrder.status = 'PAYMENT_FAILED';
    existingOrder.cancellationReason = reason || 'Payment transaction failed or was declined';
    existingOrder.updatedAt = new Date();
    if (existingOrder.payment) {
      existingOrder.payment.status = 'FAILED';
    }
    orderStore.saveOrder(existingOrder);

    try {
      await prisma.orderPayment.updateMany({
        where: { orderId },
        data: { status: 'FAILED' },
      });
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAYMENT_FAILED', cancellationReason: existingOrder.cancellationReason },
      });
    } catch (_: any) {}

    return true;
  }
}

export const paymentService = new PaymentService();

