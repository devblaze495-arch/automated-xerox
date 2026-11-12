import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionService } from './subscription.service.js';

describe('Super-Admin SaaS & Multi-Shop Onboarding Tests', () => {
  it('calculates platform SaaS revenue accurately', async () => {
    const revenue = await subscriptionService.getTotalSaasRevenueInr();
    assert.ok(typeof revenue === 'number');
    assert.ok(revenue >= 0);
  });

  it('manually overrides and extends SaaS license for a center', async () => {
    const testCenterId = '00000000-0000-0000-0000-000000000002';
    const updated = await subscriptionService.overrideSubscription(testCenterId, {
      days: 45,
      status: 'ACTIVE',
      tier: 'ANNUAL',
    });

    assert.equal(updated.status, 'ACTIVE');
    assert.equal(updated.tier, 'ANNUAL');
    assert.ok(updated.currentPeriodEnd);
    assert.ok(new Date(updated.currentPeriodEnd).getTime() > Date.now());
  });

  it('reports all registered subscriptions', () => {
    const all = subscriptionService.getAllSubscriptions();
    assert.ok(Array.isArray(all));
    assert.ok(all.length >= 1);
  });
});

