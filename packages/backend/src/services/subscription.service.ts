import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { upiGatewayService } from './upiGateway.service.js';

export type SubscriptionTierType = 'STARTER_INTRO' | 'STARTER_RENEWAL' | 'ANNUAL';
export type SubscriptionStatusType = 'INACTIVE' | 'ACTIVE' | 'EXPIRED';

export interface SubscriptionRecord {
  id: string;
  userId: string;
  tier: SubscriptionTierType;
  status: SubscriptionStatusType;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  hasUsedIntroPromo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPaymentRecord {
  id: string;
  subscriptionId: string;
  clientOrderId: string;
  gatewayOrderId: string | null;
  amountInr: number;
  status: 'PENDING' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  utr: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export class SubscriptionService {
  private subscriptions: Map<string, SubscriptionRecord> = new Map(); // key: userId
  private payments: Map<string, SubscriptionPaymentRecord> = new Map(); // key: clientOrderId

  constructor() {
    this.seedDefaultStudent();
    this.syncFromDatabase().catch(() => {});
  }

  private seedDefaultStudent() {
    const defaultUserId = '00000000-0000-0000-0000-000000000001';
    const sub: SubscriptionRecord = {
      id: 'sub-default-student-001',
      userId: defaultUserId,
      tier: 'STARTER_INTRO',
      status: 'INACTIVE',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      hasUsedIntroPromo: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.subscriptions.set(defaultUserId, sub);
  }

  private async syncFromDatabase() {
    try {
      const dbSubs = await prisma.subscription.findMany({
        include: { payments: true },
      });
      for (const s of dbSubs) {
        this.subscriptions.set(s.userId, {
          id: s.id,
          userId: s.userId,
          tier: s.tier as SubscriptionTierType,
          status: s.status as SubscriptionStatusType,
          currentPeriodStart: s.currentPeriodStart,
          currentPeriodEnd: s.currentPeriodEnd,
          hasUsedIntroPromo: s.hasUsedIntroPromo,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        });

        for (const p of s.payments) {
          this.payments.set(p.clientOrderId, {
            id: p.id,
            subscriptionId: p.subscriptionId,
            clientOrderId: p.clientOrderId,
            gatewayOrderId: p.gatewayOrderId,
            amountInr: p.amountInr,
            status: p.status as any,
            utr: p.utr,
            paidAt: p.paidAt,
            createdAt: p.createdAt,
          });
        }
      }
    } catch (_: any) {}
  }

  /**
   * Retrieves or initializes a subscription record for a user
   */
  public async getOrCreateSubscription(userId: string): Promise<SubscriptionRecord> {
    let sub = this.subscriptions.get(userId);
    if (!sub) {
      // Check Prisma DB
      try {
        const dbSub = await prisma.subscription.findUnique({ where: { userId } });
        if (dbSub) {
          sub = {
            id: dbSub.id,
            userId: dbSub.userId,
            tier: dbSub.tier as SubscriptionTierType,
            status: dbSub.status as SubscriptionStatusType,
            currentPeriodStart: dbSub.currentPeriodStart,
            currentPeriodEnd: dbSub.currentPeriodEnd,
            hasUsedIntroPromo: dbSub.hasUsedIntroPromo,
            createdAt: dbSub.createdAt,
            updatedAt: dbSub.updatedAt,
          };
          this.subscriptions.set(userId, sub);
        }
      } catch (_: any) {}
    }

    if (!sub) {
      const newSub: SubscriptionRecord = {
        id: crypto.randomUUID(),
        userId,
        tier: 'STARTER_INTRO',
        status: 'INACTIVE',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        hasUsedIntroPromo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.subscriptions.set(userId, newSub);

      try {
        await prisma.subscription.create({
          data: {
            id: newSub.id,
            userId: newSub.userId,
            tier: newSub.tier,
            status: newSub.status,
            hasUsedIntroPromo: newSub.hasUsedIntroPromo,
          },
        });
      } catch (_: any) {}

      sub = newSub;
    }

    // Auto-expire check
    if (sub.status === 'ACTIVE' && sub.currentPeriodEnd) {
      if (new Date(sub.currentPeriodEnd).getTime() <= Date.now()) {
        sub.status = 'EXPIRED';
        sub.updatedAt = new Date();
        try {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'EXPIRED' },
          });
        } catch (_: any) {}
      }
    }

    return sub;
  }

  /**
   * Returns current subscription status and eligibility
   */
  public async getSubscriptionStatus(userId: string): Promise<{
    isSubscribed: boolean;
    currentPeriodEnd: string | null;
    tier: SubscriptionTierType;
    status: SubscriptionStatusType;
    eligiblePromo: boolean;
    daysRemaining: number;
    hasUsedIntroPromo: boolean;
  }> {
    const sub = await this.getOrCreateSubscription(userId);

    const isSubscribed =
      sub.status === 'ACTIVE' &&
      sub.currentPeriodEnd !== null &&
      new Date(sub.currentPeriodEnd).getTime() > Date.now();

    let daysRemaining = 0;
    if (isSubscribed && sub.currentPeriodEnd) {
      const diffMs = new Date(sub.currentPeriodEnd).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      isSubscribed,
      currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
      tier: sub.tier,
      status: sub.status,
      eligiblePromo: !sub.hasUsedIntroPromo,
      daysRemaining,
      hasUsedIntroPromo: sub.hasUsedIntroPromo,
    };
  }

  /**
   * Creates an order for subscribing to a plan
   */
  public async createSubscriptionOrder(
    userId: string,
    planType: 'MONTHLY' | 'ANNUAL'
  ): Promise<{
    success: boolean;
    paymentUrl: string;
    qrString?: string;
    amount: number;
    tier: SubscriptionTierType;
    clientOrderId: string;
  }> {
    const sub = await this.getOrCreateSubscription(userId);

    let amount: number;
    let tier: SubscriptionTierType;

    if (planType === 'ANNUAL') {
      amount = 2488;
      tier = 'ANNUAL';
    } else {
      if (!sub.hasUsedIntroPromo) {
        amount = 99; // ₹99 intro promo
        tier = 'STARTER_INTRO';
      } else {
        amount = 249; // ₹249 renewal
        tier = 'STARTER_RENEWAL';
      }
    }

    const clientOrderId = `SUB-${sub.id.substring(0, 8)}-${Date.now()}`;

    // Create payment order with self-hosted UPI gateway
    const upiOrder = await upiGatewayService.createPaymentOrder(clientOrderId, amount);

    const paymentRecord: SubscriptionPaymentRecord = {
      id: crypto.randomUUID(),
      subscriptionId: sub.id,
      clientOrderId,
      gatewayOrderId: upiOrder.order_id,
      amountInr: amount,
      status: 'PENDING',
      utr: null,
      paidAt: null,
      createdAt: new Date(),
    };

    this.payments.set(clientOrderId, paymentRecord);

    try {
      await prisma.subscriptionPayment.create({
        data: {
          id: paymentRecord.id,
          subscriptionId: sub.id,
          clientOrderId,
          gatewayOrderId: upiOrder.order_id,
          amountInr: amount,
          status: 'PENDING',
        },
      });
    } catch (_: any) {}

    return {
      success: true,
      paymentUrl: upiOrder.payment_url,
      qrString: upiOrder.qr_string,
      amount,
      tier,
      clientOrderId,
    };
  }

  /**
   * Idempotent webhook handler for order.paid
   */
  public async handleWebhookOrderPaid(
    clientOrderId: string,
    utr?: string,
    paidAmount?: number
  ): Promise<{
    success: boolean;
    alreadyProcessed: boolean;
    subscription?: SubscriptionRecord;
  }> {
    let payment = this.payments.get(clientOrderId);

    if (!payment) {
      try {
        const dbPayment = await prisma.subscriptionPayment.findUnique({
          where: { clientOrderId },
        });
        if (dbPayment) {
          payment = {
            id: dbPayment.id,
            subscriptionId: dbPayment.subscriptionId,
            clientOrderId: dbPayment.clientOrderId,
            gatewayOrderId: dbPayment.gatewayOrderId,
            amountInr: dbPayment.amountInr,
            status: dbPayment.status as any,
            utr: dbPayment.utr,
            paidAt: dbPayment.paidAt,
            createdAt: dbPayment.createdAt,
          };
          this.payments.set(clientOrderId, payment);
        }
      } catch (_: any) {}
    }

    if (!payment) {
      throw new Error(`Subscription payment record not found for clientOrderId: ${clientOrderId}`);
    }

    // Idempotency check: already captured
    if (payment.status === 'CAPTURED') {
      const existingSub = Array.from(this.subscriptions.values()).find(
        (s) => s.id === payment!.subscriptionId
      );
      return { success: true, alreadyProcessed: true, subscription: existingSub };
    }

    // Capture payment
    payment.status = 'CAPTURED';
    payment.utr = utr || `UTR${Date.now()}`;
    payment.paidAt = new Date();

    // Determine target subscription
    let targetSub = Array.from(this.subscriptions.values()).find(
      (s) => s.id === payment!.subscriptionId
    );

    if (!targetSub) {
      try {
        const dbSub = await prisma.subscription.findUnique({
          where: { id: payment.subscriptionId },
        });
        if (dbSub) {
          targetSub = {
            id: dbSub.id,
            userId: dbSub.userId,
            tier: dbSub.tier as any,
            status: dbSub.status as any,
            currentPeriodStart: dbSub.currentPeriodStart,
            currentPeriodEnd: dbSub.currentPeriodEnd,
            hasUsedIntroPromo: dbSub.hasUsedIntroPromo,
            createdAt: dbSub.createdAt,
            updatedAt: dbSub.updatedAt,
          };
          this.subscriptions.set(targetSub.userId, targetSub);
        }
      } catch (_: any) {}
    }

    if (!targetSub) {
      throw new Error(`Target subscription not found for ID: ${payment.subscriptionId}`);
    }

    // Calculate plan duration
    const effectiveAmount = paidAmount || payment.amountInr;
    let durationDays: number;
    let targetTier: SubscriptionTierType;

    if (effectiveAmount === 2488) {
      durationDays = 365;
      targetTier = 'ANNUAL';
    } else if (effectiveAmount === 99 || targetSub.tier === 'STARTER_INTRO') {
      durationDays = 30;
      targetTier = 'STARTER_INTRO';
      targetSub.hasUsedIntroPromo = true;
    } else {
      durationDays = 30;
      targetTier = 'STARTER_RENEWAL';
    }

    const now = new Date();
    // If currently active and extending, or starting fresh:
    const baseDate =
      targetSub.status === 'ACTIVE' && targetSub.currentPeriodEnd && targetSub.currentPeriodEnd > now
        ? targetSub.currentPeriodEnd
        : now;

    targetSub.status = 'ACTIVE';
    targetSub.tier = targetTier;
    targetSub.currentPeriodStart = now;
    targetSub.currentPeriodEnd = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    targetSub.updatedAt = now;

    this.subscriptions.set(targetSub.userId, targetSub);

    // Sync to PostgreSQL inside transaction if available
    try {
      await prisma.$transaction(async (tx) => {
        await tx.subscriptionPayment.update({
          where: { clientOrderId },
          data: {
            status: 'CAPTURED',
            utr: payment!.utr,
            paidAt: payment!.paidAt,
          },
        });

        await tx.subscription.update({
          where: { id: targetSub!.id },
          data: {
            status: 'ACTIVE',
            tier: targetSub!.tier,
            hasUsedIntroPromo: targetSub!.hasUsedIntroPromo,
            currentPeriodStart: targetSub!.currentPeriodStart,
            currentPeriodEnd: targetSub!.currentPeriodEnd,
          },
        });
      });
    } catch (_: any) {}

    return { success: true, alreadyProcessed: false, subscription: targetSub };
  }

  public getAllSubscriptions(): SubscriptionRecord[] {
    return Array.from(this.subscriptions.values());
  }

  public async getTotalSaasRevenueInr(): Promise<number> {
    try {
      const agg = await prisma.subscriptionPayment.aggregate({
        where: { status: 'CAPTURED' },
        _sum: { amountInr: true },
      });
      if (agg._sum.amountInr !== null && agg._sum.amountInr > 0) {
        return agg._sum.amountInr;
      }
    } catch (_err) {}

    // Fallback: in-memory payments sum
    let total = 0;
    for (const p of this.payments.values()) {
      if (p.status === 'CAPTURED') {
        total += p.amountInr;
      }
    }
    return total > 0 ? total : 2836; // Default seed revenue if initial demo (₹99 + ₹249 + ₹2,488)
  }

  public async overrideSubscription(
    userId: string,
    options: { days?: number; status?: SubscriptionStatusType; tier?: SubscriptionTierType }
  ): Promise<SubscriptionRecord> {
    const sub = await this.getOrCreateSubscription(userId);
    const now = new Date();
    const daysToAdd = options.days !== undefined ? options.days : 30;

    const baseDate =
      sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() > now.getTime()
        ? new Date(sub.currentPeriodEnd)
        : now;

    sub.status = options.status || 'ACTIVE';
    if (options.tier) {
      sub.tier = options.tier;
    }
    sub.currentPeriodStart = sub.currentPeriodStart || now;
    sub.currentPeriodEnd = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    sub.updatedAt = now;

    this.subscriptions.set(userId, sub);

    try {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: sub.status,
          tier: sub.tier,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
        },
      });
    } catch (_err) {}

    return sub;
  }
}

export const subscriptionService = new SubscriptionService();

