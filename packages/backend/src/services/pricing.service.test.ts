import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateItemPrice, parsePageRange, DEFAULT_RATE_CARD } from './pricing.service.js';

describe('Pricing Engine - Page Range Parser', () => {
  test('resolves ALL pages when range is undefined or ALL', () => {
    assert.deepEqual(parsePageRange('ALL', 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(parsePageRange(undefined, 3), [1, 2, 3]);
    assert.deepEqual(parsePageRange('   ', 4), [1, 2, 3, 4]);
  });

  test('parses comma-separated single pages and sorts them', () => {
    assert.deepEqual(parsePageRange('4, 1, 3', 6), [1, 3, 4]);
  });

  test('parses hyphenated page ranges and clamps within total pages', () => {
    assert.deepEqual(parsePageRange('2-5', 10), [2, 3, 4, 5]);
    assert.deepEqual(parsePageRange('1-3, 8-10', 8), [1, 2, 3, 8]); // 9 and 10 clamped
  });

  test('handles mixed ranges with whitespace and duplicates', () => {
    assert.deepEqual(parsePageRange(' 1-3 , 2 , 5 ', 5), [1, 2, 3, 5]);
  });

  test('falls back gracefully to all pages if expression resolves to no valid page', () => {
    assert.deepEqual(parsePageRange('99-105', 10), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('Pricing Engine - Sheet Calculation & Costing', () => {
  test('Simplex sheet calculation: sheets = effectivePages * copies', () => {
    const result = calculateItemPrice({
      pageCount: 10,
      pageRange: '1-6', // 6 effective pages
      colorMode: 'BW',
      paperSize: 'A4',
      duplexMode: 'SIMPLEX',
      copies: 3,
    });

    assert.equal(result.effectivePages, 6);
    assert.equal(result.sheetsPerCopy, 6);
    assert.equal(result.totalSheets, 18); // 6 * 3
    assert.equal(result.totalImpressions, 18);
    // Base paper: 18 * 50 = 900 cents
    assert.equal(result.basePaperCents, 900);
    // Toner BW: 18 * 50 = 900 cents
    assert.equal(result.tonerCents, 900);
    assert.equal(result.itemTotalCents, 1800);
  });

  test('Duplex sheet calculation with odd pages rounds up per copy', () => {
    const result = calculateItemPrice({
      pageCount: 5,
      pageRange: 'ALL',
      colorMode: 'BW',
      paperSize: 'A4',
      duplexMode: 'DUPLEX_LONG',
      copies: 2,
    });

    assert.equal(result.effectivePages, 5);
    // Math.ceil(5 / 2) = 3 sheets per copy
    assert.equal(result.sheetsPerCopy, 3);
    assert.equal(result.totalSheets, 6); // 3 * 2
    assert.equal(result.totalImpressions, 10); // 5 * 2
    // Base paper: 6 * 50 = 300 cents
    assert.equal(result.basePaperCents, 300);
    // Toner BW: 10 * 50 = 500 cents
    assert.equal(result.tonerCents, 500);
    assert.equal(result.itemTotalCents, 800);
  });

  test('A3 Full Color duplex cost calculation', () => {
    const result = calculateItemPrice({
      pageCount: 4,
      pageRange: 'ALL',
      colorMode: 'COLOR',
      paperSize: 'A3',
      duplexMode: 'DUPLEX_SHORT',
      copies: 1,
    });

    assert.equal(result.effectivePages, 4);
    assert.equal(result.sheetsPerCopy, 2);
    assert.equal(result.totalSheets, 2);
    assert.equal(result.totalImpressions, 4);
    // A3 paper: 2 * 120 = 240 cents
    assert.equal(result.basePaperCents, 240);
    // A3 Color toner: 4 * 600 = 2400 cents
    assert.equal(result.tonerCents, 2400);
    assert.equal(result.itemTotalCents, 2640);
  });
});

