import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { paymentService } from './payment.service.js';
import { refundService } from './refund.service.js';
import { orderStore, EnrichedOrder } from './order.store.js';
import { env } from '../config/env.js';

describe('Payment & Refund Service Tests', () => {
  const testOrderId = 'test-order-payment-uuid-001';

  // Seed a test order
  const testOrder: EnrichedOrder = {
    id: testOrderId,
    studentId: 'test-student-001',
    studentName: 'Test Student',
    studentPhone: '+91 99999 88888',
    centerId: 'CTR-CAMPUS-01',
    status: 'PAYMENT_PENDING',
    collectionOtp: '1234',
    totalSheets: 5,
    subtotalCents: 500,
    convenienceFeeCents: 100,
    totalAmountCents: 600,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'item-test-01',
        orderId: testOrderId,
        documentId: 'doc-test-01',
        documentName: 'Assignment.pdf',
        totalPages: 5,
        pageRange: 'ALL',
        colorMode: 'BW',
        paperSize: 'A4',
        duplexMode: 'SIMPLEX',
        copies: 1,
        computedSheets: 5,
        itemTotalCents: 500,
      },
    ],
    payment: {
      status: 'PENDING',
      amountCents: 600,
    },
  };

  orderStore.saveOrder(testOrder);

  it('creates Razorpay order with correct paise amount and keyId', async () => {
    const res = await paymentService.createRazorpayOrder(testOrderId, 600);
    assert.ok(res.rzpOrderId, 'rzpOrderId should exist');
    assert.equal(res.amount, 600, 'Amount should match in paise');
    assert.equal(res.currency, 'INR');
    assert.equal(res.keyId, env.RAZORPAY_KEY_ID);

    const stored = orderStore.getOrder(testOrderId);
    assert.equal(stored?.payment?.rzpOrderId, res.rzpOrderId);
  });

  it('verifies valid HMAC SHA256 payment signature with constant-time comparison', () => {
    const rzpOrderId = 'order_test_12345';
    const rzpPaymentId = 'pay_test_67890';
    const validSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest('hex');

    const isValid = paymentService.verifyPaymentSignature(rzpOrderId, rzpPaymentId, validSignature);
    assert.equal(isValid, true, 'Valid signature should verify successfully');

    const isInvalid = paymentService.verifyPaymentSignature(rzpOrderId, rzpPaymentId, 'invalid_signature_hex');
    assert.equal(isInvalid, false, 'Invalid signature should fail verification');
  });

  it('verifies valid webhook signature with constant-time comparison', () => {
    const payload = JSON.stringify({ event: 'payment.captured', id: 'evt_test_1' });
    const validSig = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    const isValid = paymentService.verifyWebhookSignature(payload, validSig);
    assert.equal(isValid, true, 'Valid webhook signature should verify');

    const isInvalid = paymentService.verifyWebhookSignature(payload, 'wrong_sig');
    assert.equal(isInvalid, false, 'Invalid webhook signature should fail');
  });

  it('reconciles payment success idempotently without duplicate transitions', async () => {
    const firstCall = await paymentService.reconcilePaymentSuccess({
      orderId: testOrderId,
      rzpOrderId: 'order_test_12345',
      rzpPaymentId: 'pay_test_67890',
    });

    assert.equal(firstCall.success, true);
    assert.equal(firstCall.alreadyProcessed, false);
    assert.equal(orderStore.getOrder(testOrderId)?.status, 'PAYMENT_VERIFIED');
    assert.equal(orderStore.getOrder(testOrderId)?.payment?.status, 'CAPTURED');

    // Duplicate call (simulating multiple webhooks or race conditions)
    const secondCall = await paymentService.reconcilePaymentSuccess({
      orderId: testOrderId,
      rzpOrderId: 'order_test_12345',
      rzpPaymentId: 'pay_test_67890',
    });

    assert.equal(secondCall.success, true);
    assert.equal(secondCall.alreadyProcessed, true, 'Duplicate call should be recognized as already processed');
  });

  it('processes refund and updates order status to REFUNDED', async () => {
    const refundRes = await refundService.processRefund(testOrderId, 600, 'Defective page printing');
    assert.equal(refundRes.success, true);
    assert.ok(refundRes.refundId.startsWith('rfnd_'));
    assert.equal(refundRes.status, 'REFUNDED');

    const updated = orderStore.getOrder(testOrderId);
    assert.equal(updated?.status, 'REFUNDED');
    assert.equal(updated?.payment?.status, 'REFUNDED');
  });
});

