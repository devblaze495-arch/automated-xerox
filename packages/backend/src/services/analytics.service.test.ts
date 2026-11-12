import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsService, PresetRange } from './analytics.service.js';

describe('Operator Analytics & Shop Configuration Service Tests', () => {
  test('resolves standard date range presets accurately', () => {
    // 1. Today
    const today = AnalyticsService.resolveDateRange('today');
    assert.equal(today.preset, 'today');
    assert.ok(today.startDate <= today.endDate);
    assert.equal(today.startDate.getHours(), 0);
    assert.equal(today.startDate.getMinutes(), 0);
    assert.equal(today.endDate.getHours(), 23);
    assert.equal(today.endDate.getMinutes(), 59);

    // 2. Yesterday
    const yesterday = AnalyticsService.resolveDateRange('yesterday');
    assert.equal(yesterday.preset, 'yesterday');
    assert.ok(yesterday.startDate < today.startDate);
    assert.ok(yesterday.endDate < today.endDate);

    // 3. Week (7 days)
    const week = AnalyticsService.resolveDateRange('week');
    assert.equal(week.preset, 'week');
    const dayDiffWeek = (week.endDate.getTime() - week.startDate.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(dayDiffWeek >= 6.9 && dayDiffWeek <= 8);

    // 4. 15 Days
    const fifteenDays = AnalyticsService.resolveDateRange('15days');
    assert.equal(fifteenDays.preset, '15days');
    const dayDiff15 = (fifteenDays.endDate.getTime() - fifteenDays.startDate.getTime()) / (1000 * 60 * 60 * 24);
    assert.ok(dayDiff15 >= 14.9 && dayDiff15 <= 16);

    // 5. Month
    const month = AnalyticsService.resolveDateRange('month');
    assert.equal(month.preset, 'month');
    assert.equal(month.startDate.getDate(), 1);

    // 6. Indian Financial Year (April 1 to March 31)
    const year = AnalyticsService.resolveDateRange('year');
    assert.equal(year.preset, 'year');
    assert.equal(year.startDate.getMonth(), 3); // April is index 3
    assert.equal(year.startDate.getDate(), 1);
    assert.equal(year.endDate.getMonth(), 2); // March is index 2
    assert.equal(year.endDate.getDate(), 31);

    // 7. Custom Range
    const custom = AnalyticsService.resolveDateRange('custom', '2026-01-01', '2026-01-31');
    assert.equal(custom.preset, 'custom');
    assert.equal(custom.startDate.getFullYear(), 2026);
    assert.equal(custom.startDate.getMonth(), 0);
    assert.equal(custom.startDate.getDate(), 1);
    assert.equal(custom.endDate.getDate(), 31);
  });

  test('reads and updates shop settings (rates, stock, open status, auto-delete)', async () => {
    const initial = await AnalyticsService.getShopSettings();
    assert.ok(initial);
    assert.equal(typeof initial.isOpen, 'boolean');
    assert.equal(typeof initial.autoDeleteOnCollection, 'boolean');
    assert.ok(initial.paperStockA4 >= 0);
    assert.ok(initial.paperStockA3 >= 0);

    // Update settings
    const updated = await AnalyticsService.updateShopSettings(initial.id, {
      isOpen: false,
      autoDeleteOnCollection: true,
      bwRatePerSheet: 2.5,
      colorRatePerSheet: 12.0,
      paperStockA4: 450,
      paperStockA3: 90,
    });

    assert.equal(updated.isOpen, false);
    assert.equal(updated.autoDeleteOnCollection, true);
    assert.equal(updated.bwRatePerSheet, 2.5);
    assert.equal(updated.colorRatePerSheet, 12.0);
    assert.equal(updated.paperStockA4, 450);
    assert.equal(updated.paperStockA3, 90);

    // Reset back to open
    const reset = await AnalyticsService.updateShopSettings(initial.id, {
      isOpen: true,
      paperStockA4: 500,
      paperStockA3: 100,
    });
    assert.equal(reset.isOpen, true);
    assert.equal(reset.paperStockA4, 500);
  });

  test('deducts paper stock correctly and floors at zero', async () => {
    await AnalyticsService.updateShopSettings(undefined, {
      paperStockA4: 50,
      paperStockA3: 10,
    });

    // Deduct 20 A4 sheets and 5 A3 sheets
    await AnalyticsService.deductPaperStock([
      { paperSize: 'A4', computedSheets: 20 },
      { paperSize: 'A3', computedSheets: 5 },
    ]);

    let current = await AnalyticsService.getShopSettings();
    assert.equal(current.paperStockA4, 30);
    assert.equal(current.paperStockA3, 5);

    // Over-deduct to test flooring at 0
    await AnalyticsService.deductPaperStock([
      { paperSize: 'A4', computedSheets: 100 },
      { paperSize: 'A3', computedSheets: 50 },
    ]);

    current = await AnalyticsService.getShopSettings();
    assert.equal(current.paperStockA4, 0);
    assert.equal(current.paperStockA3, 0);

    // Restore stock
    await AnalyticsService.updateShopSettings(undefined, {
      paperStockA4: 500,
      paperStockA3: 100,
    });
  });

  test('computes analytics response with financial metrics, hourly distribution, and ledger', async () => {
    const analytics = await AnalyticsService.getAnalytics({ preset: 'today' });

    assert.ok(analytics.dateRange);
    assert.equal(analytics.dateRange.preset, 'today');
    assert.ok(analytics.metrics);
    assert.equal(typeof analytics.metrics.grossRevenueRupees, 'number');
    assert.equal(typeof analytics.metrics.totalOrdersCount, 'number');
    assert.equal(typeof analytics.metrics.completedOrdersCount, 'number');
    assert.equal(typeof analytics.metrics.cancelledOrdersCount, 'number');
    assert.equal(typeof analytics.metrics.a4SimplexSheets, 'number');
    assert.equal(typeof analytics.metrics.a4DuplexSheets, 'number');
    assert.equal(typeof analytics.metrics.a3SimplexSheets, 'number');
    assert.equal(typeof analytics.metrics.a3DuplexSheets, 'number');
    assert.equal(typeof analytics.metrics.totalSheets, 'number');
    assert.equal(typeof analytics.metrics.colorImpressions, 'number');
    assert.equal(typeof analytics.metrics.bwImpressions, 'number');
    assert.equal(typeof analytics.metrics.lowPaperAlert, 'boolean');

    // 24 hourly buckets
    assert.equal(analytics.hourlyDistribution.length, 24);
    assert.equal(analytics.hourlyDistribution[0].hour, 0);
    assert.equal(analytics.hourlyDistribution[23].hour, 23);

    // Ledger is an array
    assert.ok(Array.isArray(analytics.ledger));
    if (analytics.ledger.length > 0) {
      const item = analytics.ledger[0];
      assert.ok(item.orderId);
      assert.ok(item.studentName);
      assert.ok(item.documentName);
      assert.ok(item.paperSize === 'A4' || item.paperSize === 'A3');
      assert.equal(typeof item.totalSheets, 'number');
      assert.equal(typeof item.amountRupees, 'number');
      assert.equal(typeof item.isPurged, 'boolean');
    }
  });

  test('exports valid RFC 4180 CSV with standard headers', async () => {
    const csv = await AnalyticsService.exportAnalyticsCsv({ preset: 'today' });

    assert.ok(typeof csv === 'string');
    assert.ok(csv.includes('Order ID,Date & Time,Student Name,Document Name,Paper Size,Duplex Mode,Color Mode,Copies,Sheets Consumed,Amount (INR),Status,Document Retention'));
  });

  test('purges document physical blob while preserving analytical metadata', async () => {
    const purgeResult = await AnalyticsService.purgeDocument('mock-doc-to-purge');

    assert.equal(purgeResult.success, true);
    assert.equal(purgeResult.isPurged, true);
    assert.ok(purgeResult.purgedAt);
    assert.ok(purgeResult.message.includes('purged'));
  });
});
