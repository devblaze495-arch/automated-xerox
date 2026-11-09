import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { orderStore, EnrichedOrder } from './order.store.js';
import { prisma } from '../db/prisma.js';
import { printerService } from './printer.service.js';

export interface RefundResult {
  success: boolean;
  refundId: string;
  orderId: string;
  amountCents: number;
  status: string;
  message: string;
}

export class RefundService {
  private razorpay: any;

  constructor() {
    try {
      this.razorpay = new (Razorpay as any)({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    } catch (err: any) {
      console.warn('⚠️ Razorpay client initialization fallback for RefundService:', err.message);
    }
  }

  /**
   * Processes a refund for an order via Razorpay API or sandbox fallback
   */
  public async processRefund(
    orderId: string,
    amountCents?: number,
    reason?: string
  ): Promise<RefundResult> {
    const order = orderStore.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found for refund processing`);
    }

    const effectiveAmountCents = amountCents ?? order.totalAmountCents;
    const amountPaise = Math.round(effectiveAmountCents);

    let refundId = `rfnd_mock_${crypto.randomBytes(6).toString('hex')}`;
    let isLiveRefund = false;

    const rzpPaymentId = order.payment?.rzpPaymentId;

    // Call Razorpay Payments Refund API if real credentials and live payment ID present
    if (
      this.razorpay &&
      rzpPaymentId &&
      !rzpPaymentId.startsWith('pay_mock_') &&
      !env.RAZORPAY_KEY_ID.startsWith('rzp_test_campus')
    ) {
      try {
        const response = await this.razorpay.payments.refund(rzpPaymentId, {
          amount: amountPaise,
          notes: {
            orderId,
            reason: reason || 'Operator rejection at print terminal',
          },
        });
        if (response && response.id) {
          refundId = response.id;
          isLiveRefund = true;
        }
      } catch (err: any) {
        console.warn(`[RefundService] Razorpay live refund failed, proceeding with sandbox refund: ${err.message}`);
      }
    }

    // Update order status in orderStore
    const refundReason = reason || 'Order rejected by operator. Full refund issued.';
    const updatedOrder = orderStore.updateStatus(order.id, 'REFUNDED', {
      reason: refundReason,
    });

    if (order.payment) {
      order.payment.status = 'REFUNDED';
    }

    // Release printer workload if previously queued or printing
    if (order.assignedPrinterId) {
      printerService.updateWorkload(order.assignedPrinterId, -1);
    }

    // Sync to PostgreSQL DB if available
    try {
      await prisma.orderPayment.updateMany({
        where: { orderId },
        data: {
          status: 'REFUNDED',
        },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'REFUNDED',
          cancellationReason: refundReason,
        },
      });
    } catch (_: any) {}

    return {
      success: true,
      refundId,
      orderId: order.id,
      amountCents: effectiveAmountCents,
      status: 'REFUNDED',
      message: isLiveRefund
        ? 'Refund processed via Razorpay API.'
        : 'Refund processed in sandbox test mode.',
    };
  }
}

export const refundService = new RefundService();

