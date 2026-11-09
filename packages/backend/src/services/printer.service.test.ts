import { test, describe } from 'node:test';
import assert from 'node:assert';
import { printerService } from './printer.service.js';

describe('Capability-Based Printer Routing Engine', () => {
  test('A3 document routing: matches only A3-capable printers (imageRUNNER 2224)', () => {
    const matches = printerService.findCompatiblePrinters({
      paperSize: 'A3',
      colorMode: 'BW',
      duplexMode: 'SIMPLEX',
      copies: 1,
    });

    assert.ok(matches.length > 0, 'Should find at least one matching printer');
    const printerNames = matches.map((m) => m.printer.name);
    assert.ok(printerNames.includes('Canon imageRUNNER 2224'), 'Must match imageRUNNER 2224');
    assert.strictEqual(printerNames.includes('Canon PIXMA G2010'), false, 'G2010 cannot print A3');
    assert.strictEqual(printerNames.includes('Canon PIXMA G3070'), false, 'G3070 cannot print A3');
  });

  test('Full Color routing: matches G2010 and G3070, excludes monochrome imageRUNNER 2224', () => {
    const matches = printerService.findCompatiblePrinters({
      paperSize: 'A4',
      colorMode: 'COLOR',
      duplexMode: 'SIMPLEX',
      copies: 1,
    });

    assert.ok(matches.length >= 2, 'Should match both color ink tanks');
    const printerNames = matches.map((m) => m.printer.name);
    assert.ok(printerNames.includes('Canon PIXMA G2010'));
    assert.ok(printerNames.includes('Canon PIXMA G3070'));
    assert.strictEqual(printerNames.includes('Canon imageRUNNER 2224'), false, 'Monochrome printer cannot print color');
  });

  test('Color Duplex routing: routes to G2010 with requiresManualFlip flag set to true', () => {
    const matches = printerService.findCompatiblePrinters({
      paperSize: 'A4',
      colorMode: 'COLOR',
      duplexMode: 'DUPLEX_LONG',
      copies: 1,
    });

    assert.ok(matches.length > 0, 'Should find compatible printer');
    const g2010Match = matches.find((m) => m.printer.name === 'Canon PIXMA G2010');
    assert.ok(g2010Match, 'G2010 supports manual duplex');
    assert.strictEqual(g2010Match?.requiresManualFlip, true, 'Must flag manual flip required');

    // G3070 does not support manual duplex or auto duplex, so it should not match duplex
    const g3070Match = matches.find((m) => m.printer.name === 'Canon PIXMA G3070');
    assert.strictEqual(g3070Match, undefined, 'G3070 does not support duplex');
  });

  test('B&W Duplex routing: prioritizes hardware Auto-Duplex on imageRUNNER 2224', () => {
    const matches = printerService.findCompatiblePrinters({
      paperSize: 'A4',
      colorMode: 'BW',
      duplexMode: 'DUPLEX_LONG',
      copies: 1,
    });

    assert.ok(matches.length > 0);
    // Top recommendation should be imageRUNNER 2224 because it has hardware autoDuplex: true
    assert.strictEqual(matches[0].printer.name, 'Canon imageRUNNER 2224');
    assert.strictEqual(matches[0].requiresManualFlip, false);
    assert.strictEqual(matches[0].reason, 'Hardware Auto-Duplex Compatible');
  });

  test('Offline filtering: toggled offline printers are excluded from routing matches', async () => {
    // Toggle G2010 offline
    await printerService.togglePrinterOnline('prn-g2010', false);

    const matches = printerService.findCompatiblePrinters({
      paperSize: 'A4',
      colorMode: 'COLOR',
      duplexMode: 'SIMPLEX',
      copies: 1,
    });

    const g2010Present = matches.some((m) => m.printer.id === 'prn-g2010');
    assert.strictEqual(g2010Present, false, 'Offline printer must not be matched');

    // Re-enable G2010 online
    await printerService.togglePrinterOnline('prn-g2010', true);

    const matchesAfter = printerService.findCompatiblePrinters({
      paperSize: 'A4',
      colorMode: 'COLOR',
      duplexMode: 'SIMPLEX',
      copies: 1,
    });

    assert.strictEqual(matchesAfter.some((m) => m.printer.id === 'prn-g2010'), true);
  });
});

