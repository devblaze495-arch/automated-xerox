import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orderStore, EnrichedOrder } from './order.store.js';
import { agentRegistry } from '../ws/agent.registry.js';

describe('Spooler Pause (Walk-in Mode) & Queue Priority Tests', () => {
  it('manages spooler pause state in agentRegistry per center', () => {
    const centerId = 'test-center-pause-01';

    // Default should be false
    assert.equal(agentRegistry.isSpoolerPaused(centerId), false);

    // Pause
    agentRegistry.setSpoolerPaused(centerId, true);
    assert.equal(agentRegistry.isSpoolerPaused(centerId), true);

    // Resume
    agentRegistry.setSpoolerPaused(centerId, false);
    assert.equal(agentRegistry.isSpoolerPaused(centerId), false);
  });

  it('bumps order priority: urgent orders sort ahead of standard FIFO orders', () => {
    const now = Date.now();
    const normalOrder1: EnrichedOrder = {
      id: '00000000-0000-0000-0000-testorder0001',
      studentId: '00000000-0000-0000-0000-student00001',
      studentName: 'Student Normal 1',
      studentPhone: '+91 98765 43210',
      centerId: 'CTR-CAMPUS-01',
      status: 'PAYMENT_VERIFIED',
      collectionOtp: '1111',
      totalSheets: 1,
      subtotalCents: 200,
      convenienceFeeCents: 0,
      totalAmountCents: 200,
      createdAt: new Date(now - 10000), // 10s ago
      updatedAt: new Date(now - 10000),
      items: [],
    };

    const normalOrder2: EnrichedOrder = {
      id: '00000000-0000-0000-0000-testorder0002',
      studentId: '00000000-0000-0000-0000-student00002',
      studentName: 'Student Normal 2',
      studentPhone: '+91 98765 43211',
      centerId: 'CTR-CAMPUS-01',
      status: 'PAYMENT_VERIFIED',
      collectionOtp: '2222',
      totalSheets: 1,
      subtotalCents: 200,
      convenienceFeeCents: 0,
      totalAmountCents: 200,
      createdAt: new Date(now - 5000), // 5s ago
      updatedAt: new Date(now - 5000),
      items: [],
    };

    orderStore.saveOrder(normalOrder1);
    orderStore.saveOrder(normalOrder2);

    // Normal FIFO: normalOrder1 came first, so it is ahead of normalOrder2
    let all = orderStore.getAllOrders();
    const idx1Before = all.findIndex((o) => o.id === normalOrder1.id);
    const idx2Before = all.findIndex((o) => o.id === normalOrder2.id);
    assert.ok(idx1Before < idx2Before, 'Older order should come before newer order by default');

    // Now bump normalOrder2 to urgent!
    const bumped = orderStore.setOrderPriority(normalOrder2.id, true, Date.now() + 1000);
    assert.ok(bumped, 'Order should be successfully bumped');
    assert.equal(bumped?.isUrgent, true);

    // Re-query: normalOrder2 should now sort before normalOrder1
    all = orderStore.getAllOrders();
    const idx1After = all.findIndex((o) => o.id === normalOrder1.id);
    const idx2After = all.findIndex((o) => o.id === normalOrder2.id);
    assert.ok(idx2After < idx1After, 'Urgent bumped order should jump ahead of standard orders');

    // Queue position for bumped order should be #1 among active jobs
    const pos = orderStore.calculateQueuePosition(normalOrder2.id);
    assert.equal(pos.queuePosition, 1, 'Urgent order should have queue position 1');
    assert.equal(pos.aheadJobsCount, 0, 'No jobs ahead of top urgent order');
  });

  it('multiple urgent orders are sorted by priorityScore descending', () => {
    const now = Date.now();
    const urgentA: EnrichedOrder = {
      id: '00000000-0000-0000-0000-testorder000a',
      studentId: '00000000-0000-0000-0000-student0000a',
      studentName: 'Urgent A',
      studentPhone: '+91 98765 43220',
      centerId: 'CTR-CAMPUS-01',
      status: 'QUEUED',
      collectionOtp: '3333',
      totalSheets: 1,
      subtotalCents: 200,
      convenienceFeeCents: 0,
      totalAmountCents: 200,
      createdAt: new Date(now - 2000),
      updatedAt: new Date(now - 2000),
      items: [],
    };

    const urgentB: EnrichedOrder = {
      id: '00000000-0000-0000-0000-testorder000b',
      studentId: '00000000-0000-0000-0000-student0000b',
      studentName: 'Urgent B',
      studentPhone: '+91 98765 43221',
      centerId: 'CTR-CAMPUS-01',
      status: 'QUEUED',
      collectionOtp: '4444',
      totalSheets: 1,
      subtotalCents: 200,
      convenienceFeeCents: 0,
      totalAmountCents: 200,
      createdAt: new Date(now - 1000),
      updatedAt: new Date(now - 1000),
      items: [],
    };

    orderStore.saveOrder(urgentA);
    orderStore.saveOrder(urgentB);

    // Bump A with score 100, then bump B with score 200
    orderStore.setOrderPriority(urgentA.id, true, 100);
    orderStore.setOrderPriority(urgentB.id, true, 200);

    const all = orderStore.getAllOrders();
    const idxA = all.findIndex((o) => o.id === urgentA.id);
    const idxB = all.findIndex((o) => o.id === urgentB.id);

    // Higher score (urgentB) should come before lower score (urgentA)
    assert.ok(idxB < idxA, 'Order with higher priorityScore should precede lower priorityScore');
  });
});
