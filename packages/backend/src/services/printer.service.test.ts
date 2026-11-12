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

  test('Smart Routing: A3 selection always routes to imageRUNNER 2224', () => {
    const optimal = printerService.selectOptimalPrinter('CTR-CAMPUS-01', {
      paperSize: 'A3',
      colorMode: 'BW',
      duplexMode: 'SIMPLEX',
      totalSheets: 5,
    });
    assert.ok(optimal, 'Must find optimal printer for A3');
    assert.strictEqual(optimal.name, 'Canon imageRUNNER 2224');
  });

  test('Smart Routing: Color selection routes to G2010 or G3070, never monochrome imageRUNNER', () => {
    const optimal = printerService.selectOptimalPrinter('CTR-CAMPUS-01', {
      paperSize: 'A4',
      colorMode: 'COLOR',
      duplexMode: 'SIMPLEX',
      totalSheets: 4,
    });
    assert.ok(optimal, 'Must find optimal color printer');
    assert.ok(
      optimal.name === 'Canon PIXMA G2010' || optimal.name === 'Canon PIXMA G3070',
      'Must route to a color-capable printer'
    );
  });

  test('Smart Routing: Fast-Lane jobs (<= 5 sheets) pick eligible printer with queuedJobs === 0 first', () => {
    // Send telemetry: G2010 has 3 queued jobs, G3070 has 0 queued jobs
    printerService.updateFromTelemetry('CTR-CAMPUS-01', [
      {
        name: 'Canon PIXMA G2010',
        port: 'USB001',
        status: 'ONLINE',
        queuedJobs: 3,
        queuedPages: 12,
        supportsColor: true,
        supportsA3: false,
        supportsAutoDuplex: false,
      },
      {
        name: 'Canon PIXMA G3070',
        port: 'USB003',
        status: 'ONLINE',
        queuedJobs: 0,
        queuedPages: 0,
        supportsColor: true,
        supportsA3: false,
        supportsAutoDuplex: false,
      },
    ]);

    const optimal = printerService.selectOptimalPrinter('CTR-CAMPUS-01', {
      paperSize: 'A4',
      colorMode: 'COLOR',
      duplexMode: 'SIMPLEX',
      totalSheets: 3, // fast-lane job
    });

    assert.ok(optimal);
    assert.strictEqual(optimal.name, 'Canon PIXMA G3070', 'Fast lane must prioritize idle printer with 0 jobs');
  });

  test('Smart Routing: Load-balances by lowest (queuedPages * 2 + queuedJobs) score', () => {
    // Both color printers have active jobs, test load score comparison
    // G2010: 2 jobs, 4 pages -> score = 4*2 + 2 = 10
    // G3070: 1 job, 8 pages -> score = 8*2 + 1 = 17
    printerService.updateFromTelemetry('CTR-CAMPUS-01', [
      {
        name: 'Canon PIXMA G2010',
        port: 'USB001',
        status: 'ONLINE',
        queuedJobs: 2,
        queuedPages: 4,
        supportsColor: true,
        supportsA3: false,
        supportsAutoDuplex: false,
      },
      {
        name: 'Canon PIXMA G3070',
        port: 'USB003',
        status: 'ONLINE',
        queuedJobs: 1,
        queuedPages: 8,
        supportsColor: true,
        supportsA3: false,
        supportsAutoDuplex: false,
      },
    ]);

    const optimal = printerService.selectOptimalPrinter('CTR-CAMPUS-01', {
      paperSize: 'A4',
      colorMode: 'COLOR',
      duplexMode: 'SIMPLEX',
      totalSheets: 8, // non fast-lane
    });

    assert.ok(optimal);
    assert.strictEqual(optimal.name, 'Canon PIXMA G2010', 'Should pick lower load score printer');
  });

  test('Smart Routing: B&W A4 Duplex > 10 sheets prefers autoDuplex unless queue exceeds 150 pages while idle alt exists', () => {
    // Case 1: imageRUNNER normal queue (20 pages), G2010 idle
    printerService.updateFromTelemetry('CTR-CAMPUS-01', [
      {
        name: 'Canon imageRUNNER 2224',
        port: 'USB002',
        status: 'ONLINE',
        queuedJobs: 1,
        queuedPages: 20,
        supportsColor: false,
        supportsA3: true,
        supportsAutoDuplex: true,
      },
      {
        name: 'Canon PIXMA G2010',
        port: 'USB001',
        status: 'ONLINE',
        queuedJobs: 0,
        queuedPages: 0,
        supportsColor: true,
        supportsA3: false,
        supportsAutoDuplex: false,
      },
    ]);

    let optimal = printerService.selectOptimalPrinter('CTR-CAMPUS-01', {
      paperSize: 'A4',
      colorMode: 'BW',
      duplexMode: 'DUPLEX_LONG',
      totalSheets: 25, // > 10 sheets
    });
    assert.strictEqual(optimal?.name, 'Canon imageRUNNER 2224', 'Should prefer hardware autoDuplex');

    // Case 2: imageRUNNER backed up to 180 pages (>150 pages) while G2010 is idle
    printerService.updateFromTelemetry('CTR-CAMPUS-01', [
      {
        name: 'Canon imageRUNNER 2224',
        port: 'USB002',
        status: 'ONLINE',
        queuedJobs: 6,
        queuedPages: 180,
        supportsColor: false,
        supportsA3: true,
        supportsAutoDuplex: true,
      },
      {
        name: 'Canon PIXMA G2010',
        port: 'USB001',
        status: 'ONLINE',
        queuedJobs: 0,
        queuedPages: 0,
        supportsColor: true,
        supportsA3: false,
        supportsAutoDuplex: false,
      },
    ]);

    optimal = printerService.selectOptimalPrinter('CTR-CAMPUS-01', {
      paperSize: 'A4',
      colorMode: 'BW',
      duplexMode: 'DUPLEX_LONG',
      totalSheets: 25,
    });
    assert.strictEqual(optimal?.name, 'Canon PIXMA G2010', 'Should offload to idle G2010 when imageRUNNER exceeds 150 pages');
  });

  test('Smart Routing: Skips OFFLINE and PAPER_OUT printers', () => {
    printerService.updateFromTelemetry('CTR-CAMPUS-01', [
      {
        name: 'Canon PIXMA G2010',
        port: 'USB001',
        status: 'PAPER_OUT',
        queuedJobs: 0,
        queuedPages: 0,
        supportsColor: true,
        supportsA3: false,
        supportsAutoDuplex: false,
      },
      {
        name: 'Canon PIXMA G3070',
        port: 'USB003',
        status: 'ONLINE',
        queuedJobs: 1,
        queuedPages: 2,
        supportsColor: true,
        supportsA3: false,
        supportsAutoDuplex: false,
      },
    ]);

    const optimal = printerService.selectOptimalPrinter('CTR-CAMPUS-01', {
      paperSize: 'A4',
      colorMode: 'COLOR',
      duplexMode: 'SIMPLEX',
      totalSheets: 1,
    });

    assert.ok(optimal);
    assert.strictEqual(optimal.name, 'Canon PIXMA G3070', 'Must skip PAPER_OUT printer');
  });
});

