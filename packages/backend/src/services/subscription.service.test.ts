import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { subscriptionService } from './subscription.service.js';
import { upiGatewayService } from './upiGateway.service.js';
import { env } from '../config/env.js';

describe('SaaS Subscription & UPI Gateway Tests', () => {
  const testUserId = 'test-student-sub-user-123';

  it('new student is initially inactive and eligible for intro promo', async () => {
    const status = await subscriptionService.getSubscriptionStatus(testUserId);
    assert.equal(status.isSubscribed, false);
    assert.equal(status.eligiblePromo, true);
    assert.equal(status.hasUsedIntroPromo, false);
  });

  it('calculates ₹99 intro promo price for first month subscription', async () => {
    const order = await subscriptionService.createSubscriptionOrder(testUserId, 'MONTHLY');
    assert.equal(order.amount, 99);
    assert.equal(order.tier, 'STARTER_INTRO');
    assert.ok(order.clientOrderId.startsWith('SUB-'));
    assert.ok(order.paymentUrl.length > 0);
  });

  it('verifies valid HMAC SHA256 webhook signature with timing-safe comparison', () => {
    const payload = JSON.stringify({
      event: 'order.paid',
      data: { client_order_id: 'SUB-123', amount: 99, status: 'paid' },
    });
    const validSig = crypto
      .createHmac('sha256', env.UPI_GATEWAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    const isValid = upiGatewayService.verifyWebhookSignature(payload, validSig);
    assert.equal(isValid, true, 'Valid signature should verify');

    const isInvalid = upiGatewayService.verifyWebhookSignature(payload, 'wrong_hex_signature');
    assert.equal(isInvalid, false, 'Invalid signature should fail');
  });

  it('activates subscription for 30 days upon webhook order.paid event', async () => {
    const order = await subscriptionService.createSubscriptionOrder(testUserId, 'MONTHLY');
    const webhookRes = await subscriptionService.handleWebhookOrderPaid(
      order.clientOrderId,
      'UTR9876543210',
      99
    );

    assert.equal(webhookRes.success, true);
    assert.equal(webhookRes.alreadyProcessed, false);

    const status = await subscriptionService.getSubscriptionStatus(testUserId);
    assert.equal(status.isSubscribed, true);
    assert.equal(status.status, 'ACTIVE');
    assert.equal(status.tier, 'STARTER_INTRO');
    assert.equal(status.hasUsedIntroPromo, true);
    assert.equal(status.eligiblePromo, false);
    assert.ok(status.daysRemaining >= 29);
  });

  it('subsequent monthly subscription order charges renewal price of ₹249', async () => {
    // Student already claimed ₹99 promo
    const renewalOrder = await subscriptionService.createSubscriptionOrder(testUserId, 'MONTHLY');
    assert.equal(renewalOrder.amount, 249);
    assert.equal(renewalOrder.tier, 'STARTER_RENEWAL');
  });

  it('annual plan charges ₹2,488 and grants 365 days access', async () => {
    const annualUserId = 'annual-student-user-456';
    const order = await subscriptionService.createSubscriptionOrder(annualUserId, 'ANNUAL');
    assert.equal(order.amount, 2488);
    assert.equal(order.tier, 'ANNUAL');

    await subscriptionService.handleWebhookOrderPaid(order.clientOrderId, 'UTR_ANNUAL_001', 2488);
    const status = await subscriptionService.getSubscriptionStatus(annualUserId);
    assert.equal(status.isSubscribed, true);
    assert.equal(status.tier, 'ANNUAL');
    assert.ok(status.daysRemaining >= 364);
  });

  it('webhook handling is idempotent: duplicate callbacks do not duplicate extension', async () => {
    const idempotentUserId = 'idempotent-student-789';
    const order = await subscriptionService.createSubscriptionOrder(idempotentUserId, 'MONTHLY');

    // First webhook call
    const firstCall = await subscriptionService.handleWebhookOrderPaid(
      order.clientOrderId,
      'UTR_IDEMPOTENT_1',
      99
    );
    assert.equal(firstCall.alreadyProcessed, false);

    const statusAfterFirst = await subscriptionService.getSubscriptionStatus(idempotentUserId);
    const firstEnd = statusAfterFirst.currentPeriodEnd;

    // Second webhook call (retry)
    const secondCall = await subscriptionService.handleWebhookOrderPaid(
      order.clientOrderId,
      'UTR_IDEMPOTENT_1',
      99
    );
    assert.equal(secondCall.alreadyProcessed, true);

    const statusAfterSecond = await subscriptionService.getSubscriptionStatus(idempotentUserId);
    assert.equal(statusAfterSecond.currentPeriodEnd, firstEnd, 'End date must remain unchanged on duplicate webhook');
  });
});

