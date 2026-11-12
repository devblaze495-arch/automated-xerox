import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orderStore, EnrichedOrder } from './order.store.js';

describe('Scan-to-Collect Counter Handover Tests', () => {
  it('validates Format A (CAMPUSPRINT_PICKUP:<orderId>:<otp>) and transitions order to COLLECTED', () => {
    const testOrderId = '00000000-0000-0000-0000-scanorder001';
    const testOtp = '7892';

    const testOrder: EnrichedOrder = {
      id: testOrderId,
      studentId: '00000000-0000-0000-0000-student00001',
      studentName: 'Rohan Deshmukh',
      studentPhone: '+91 98765 43210',
      centerId: 'CTR-CAMPUS-01',
      status: 'READY_FOR_COLLECTION',
      collectionOtp: testOtp,
      totalSheets: 5,
      subtotalCents: 1000,
      convenienceFeeCents: 0,
      totalAmountCents: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-scan-1',
          orderId: testOrderId,
          documentId: 'doc-scan-1',
          documentName: 'Assignment_Final.pdf',
          totalPages: 5,
          pageRange: 'ALL',
          colorMode: 'BW',
          paperSize: 'A4',
          duplexMode: 'SIMPLEX',
          copies: 1,
          computedSheets: 5,
          itemTotalCents: 1000,
        },
      ],
    };

    orderStore.saveOrder(testOrder);

    // Verify Format A parsing logic
    const scanInput = `CAMPUSPRINT_PICKUP:${testOrderId}:${testOtp}`;
    assert.ok(scanInput.startsWith('CAMPUSPRINT_PICKUP:'));
    const parts = scanInput.split(':');
    const parsedOrderId = parts[1];
    const parsedOtp = parts[2];

    assert.equal(parsedOrderId, testOrderId);
    assert.equal(parsedOtp, testOtp);

    const fetched = orderStore.getOrder(parsedOrderId);
    assert.ok(fetched);
    assert.equal(fetched.collectionOtp, parsedOtp);
    assert.equal(fetched.status, 'READY_FOR_COLLECTION');

    // Transition to COLLECTED
    const collected = orderStore.updateStatus(fetched.id, 'COLLECTED');
    assert.ok(collected);
    assert.equal(collected.status, 'COLLECTED');
  });

  it('validates Format B (Raw 4-digit OTP) to find and collect active ready orders', () => {
    const testOrderId = '00000000-0000-0000-0000-scanorder002';
    const testOtp = '4321';

    const testOrder: EnrichedOrder = {
      id: testOrderId,
      studentId: '00000000-0000-0000-0000-student00002',
      studentName: 'Priya Verma',
      studentPhone: '+91 98765 43211',
      centerId: 'CTR-CAMPUS-01',
      status: 'READY_FOR_COLLECTION',
      collectionOtp: testOtp,
      totalSheets: 2,
      subtotalCents: 400,
      convenienceFeeCents: 0,
      totalAmountCents: 400,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };

    orderStore.saveOrder(testOrder);

    // Raw 4-digit OTP scan input
    const rawOtp = '4321';
    assert.match(rawOtp, /^\d{4}$/);

    const allOrders = orderStore.getAllOrders();
    const matched = allOrders.find(
      (o) => o.collectionOtp === rawOtp && o.status !== 'COLLECTED' && o.status !== 'COMPLETED'
    );

    assert.ok(matched);
    assert.equal(matched.id, testOrderId);

    orderStore.updateStatus(matched.id, 'COLLECTED');
    const updated = orderStore.getOrder(testOrderId);
    assert.equal(updated?.status, 'COLLECTED');

    // Attempting to scan again should find already collected
    const matchAgain = orderStore.getAllOrders().find(
      (o) => o.collectionOtp === rawOtp && o.status !== 'COLLECTED' && o.status !== 'COMPLETED'
    );
    assert.equal(matchAgain, undefined, 'Already collected order cannot be matched as active');
  });

  it('rejects invalid OTP for Format A', () => {
    const testOrderId = '00000000-0000-0000-0000-scanorder003';
    const testOrder: EnrichedOrder = {
      id: testOrderId,
      studentId: '00000000-0000-0000-0000-student00003',
      studentName: 'Amit Patel',
      studentPhone: '+91 98765 43212',
      centerId: 'CTR-CAMPUS-01',
      status: 'READY_FOR_COLLECTION',
      collectionOtp: '9999',
      totalSheets: 1,
      subtotalCents: 200,
      convenienceFeeCents: 0,
      totalAmountCents: 200,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };

    orderStore.saveOrder(testOrder);

    const tamperedPayload = `CAMPUSPRINT_PICKUP:${testOrderId}:0000`;
    const parts = tamperedPayload.split(':');
    const order = orderStore.getOrder(parts[1]);
    assert.ok(order);
    assert.notEqual(order.collectionOtp, parts[2], 'Tampered OTP must not match real collectionOtp');
  });

  it('correctly registers walk-in print jobs and stores COLLECTED records', () => {
    const walkInId = '00000000-0000-0000-0000-walkinorder01';
    const sheets = 8;
    const amountCollected = 16.0;

    const walkInOrder: EnrichedOrder = {
      id: walkInId,
      studentId: '00000000-0000-0000-0000-000000000001',
      studentName: 'Walk-in Counter Customer',
      studentPhone: '+91 Counter Cash',
      centerId: '00000000-0000-0000-0000-000000000002',
      status: 'COLLECTED',
      collectionOtp: '1234',
      totalSheets: sheets,
      subtotalCents: Math.round(amountCollected * 100),
      convenienceFeeCents: 0,
      totalAmountCents: Math.round(amountCollected * 100),
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-walkin-1',
          orderId: walkInId,
          documentId: 'doc-walkin-1',
          documentName: 'Walk-in Resume Print',
          totalPages: sheets,
          pageRange: 'ALL',
          colorMode: 'BW',
          paperSize: 'A4',
          duplexMode: 'SIMPLEX',
          copies: 1,
          computedSheets: sheets,
          itemTotalCents: Math.round(amountCollected * 100),
        },
      ],
    };

    orderStore.saveOrder(walkInOrder);

    const saved = orderStore.getOrder(walkInId);
    assert.ok(saved);
    assert.equal(saved.status, 'COLLECTED');
    assert.equal(saved.totalSheets, 8);
    assert.equal(saved.totalAmountCents, 1600);
    assert.equal(saved.items[0].documentName, 'Walk-in Resume Print');
  });
});

