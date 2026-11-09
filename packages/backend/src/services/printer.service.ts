import { prisma } from '../db/prisma.js';

export interface PrinterCapabilities {
  a4: boolean;
  a3: boolean;
  color: boolean;
  bw: boolean;
  autoDuplex: boolean;
  manualDuplex: boolean;
  maxCopies: number;
  ppmSpeed?: number;
}

export interface PrinterDevice {
  id: string;
  name: string;
  model: string;
  portName: string;
  connectionType: 'USB' | 'NETWORK_IPP' | 'NETWORK_RAW';
  capabilities: PrinterCapabilities;
  isOnline: boolean;
  isActive: boolean;
  centerId: string;
  currentQueueCount: number;
}

export interface PrinterMatchResult {
  printer: PrinterDevice;
  requiresManualFlip: boolean;
  matchScore: number;
  reason: string;
}

export interface JobSpecs {
  paperSize: 'A4' | 'A3';
  colorMode: 'BW' | 'COLOR';
  duplexMode: 'SIMPLEX' | 'DUPLEX_LONG' | 'DUPLEX_SHORT';
  copies?: number;
}

const PRINTER_UUID_MAP: Record<string, string> = {
  'prn-g2010': '00000000-0000-0000-0000-000000000201',
  'prn-g3070': '00000000-0000-0000-0000-000000000202',
  'prn-ir2224': '00000000-0000-0000-0000-000000000203',
};

// In-memory printer registry with default campus hardware configuration
const defaultPrinters: PrinterDevice[] = [
  {
    id: 'prn-g2010',
    name: 'Canon PIXMA G2010',
    model: 'PIXMA G2010 All-in-One Ink Tank',
    portName: 'USB001',
    connectionType: 'USB',
    capabilities: {
      a4: true,
      a3: false,
      color: true,
      bw: true,
      autoDuplex: false,
      manualDuplex: true,
      maxCopies: 99,
      ppmSpeed: 8,
    },
    isOnline: true,
    isActive: true,
    centerId: 'CTR-CAMPUS-01',
    currentQueueCount: 0,
  },
  {
    id: 'prn-g3070',
    name: 'Canon PIXMA G3070',
    model: 'PIXMA G3070 Wireless All-in-One',
    portName: 'USB003',
    connectionType: 'USB',
    capabilities: {
      a4: true,
      a3: false,
      color: true,
      bw: true,
      autoDuplex: false,
      manualDuplex: false,
      maxCopies: 99,
      ppmSpeed: 11,
    },
    isOnline: true,
    isActive: true,
    centerId: 'CTR-CAMPUS-01',
    currentQueueCount: 0,
  },
  {
    id: 'prn-ir2224',
    name: 'Canon imageRUNNER 2224',
    model: 'imageRUNNER 2224 Heavy-Duty Workgroup MFP',
    portName: 'USB002',
    connectionType: 'USB',
    capabilities: {
      a4: true,
      a3: true,
      color: false,
      bw: true,
      autoDuplex: true,
      manualDuplex: true,
      maxCopies: 999,
      ppmSpeed: 24,
    },
    isOnline: true,
    isActive: true,
    centerId: 'CTR-CAMPUS-01',
    currentQueueCount: 0,
  },
];

class PrinterService {
  private printers: Map<string, PrinterDevice> = new Map();

  constructor() {
    for (const p of defaultPrinters) {
      this.printers.set(p.id, { ...p });
    }
    this.syncFromDatabase().catch(() => {});
  }

  private async syncFromDatabase() {
    try {
      const dbPrinters = await prisma.printer.findMany();
      if (dbPrinters.length > 0) {
        for (const dp of dbPrinters) {
          const existing = this.printers.get(dp.id);
          const caps = (dp.capabilities as any) || existing?.capabilities;
          this.printers.set(dp.id, {
            id: dp.id,
            name: dp.name,
            model: dp.model,
            portName: dp.portName || existing?.portName || 'USB001',
            connectionType: dp.connectionType as any,
            capabilities: caps,
            isOnline: dp.isOnline,
            isActive: dp.isActive,
            centerId: dp.centerId,
            currentQueueCount: existing?.currentQueueCount || 0,
          });
        }
      } else {
        // Seed database if empty
        for (const p of defaultPrinters) {
          const printerDbId = PRINTER_UUID_MAP[p.id] || p.id;
          await prisma.printer.upsert({
            where: { id: printerDbId },
            create: {
              id: printerDbId,
              name: p.name,
              model: p.model,
              portName: p.portName,
              connectionType: p.connectionType as any,
              capabilities: p.capabilities as any,
              isActive: p.isActive,
              isOnline: p.isOnline,
              centerId: '00000000-0000-0000-0000-000000000002',
            },
            update: {
              isOnline: p.isOnline,
              isActive: p.isActive,
            },
          }).catch(() => {});
        }
      }
    } catch (_: any) {
      // Offline mock fallback silently active
    }
  }

  /**
   * Returns all printers in the registry.
   */
  public getAllPrinters(): PrinterDevice[] {
    return Array.from(this.printers.values());
  }

  /**
   * Returns a single printer by ID.
   */
  public getPrinterById(id: string): PrinterDevice | undefined {
    return this.printers.get(id);
  }

  /**
   * Toggles the online/offline availability of a printer.
   */
  public async togglePrinterOnline(id: string, isOnline?: boolean): Promise<PrinterDevice | null> {
    const printer = this.printers.get(id);
    if (!printer) return null;

    printer.isOnline = isOnline !== undefined ? isOnline : !printer.isOnline;
    this.printers.set(id, printer);

    // Sync to DB if available
    try {
      const printerDbId = PRINTER_UUID_MAP[id] || id;
      await prisma.printer.update({
        where: { id: printerDbId },
        data: { isOnline: printer.isOnline, lastSeenAt: new Date() },
      });
    } catch (_: any) {}

    return printer;
  }

  /**
   * Evaluates compatible printers for given print job specifications.
   *
   * Routing Rules:
   * 1. A3 Paper Size: Requires a3: true (only imageRUNNER 2224).
   * 2. Full Color: Requires color: true (G2010 or G3070).
   * 3. Duplex Mode (SIMPLEX vs DUPLEX):
   *    - Prioritize autoDuplex: true (imageRUNNER 2224 for BW Duplex).
   *    - If only manualDuplex: true matches (like G2010 for Color Duplex), attach requiresManualFlip: true.
   * 4. Exclude offline/disabled printers.
   * 5. Sort matches by lowest current queue count first.
   */
  public findCompatiblePrinters(specs: JobSpecs): PrinterMatchResult[] {
    const isA3 = specs.paperSize === 'A3';
    const isColor = specs.colorMode === 'COLOR';
    const isDuplex = specs.duplexMode !== 'SIMPLEX';

    const matches: PrinterMatchResult[] = [];

    for (const printer of this.printers.values()) {
      // Must be active and online
      if (!printer.isActive || !printer.isOnline) {
        continue;
      }

      const caps = printer.capabilities;

      // 1. Paper Size Filter
      if (isA3 && !caps.a3) {
        continue;
      }
      if (!isA3 && !caps.a4) {
        continue;
      }

      // 2. Color Mode Filter
      if (isColor && !caps.color) {
        continue;
      }

      // 3. Duplex Compatibility
      let requiresManualFlip = false;
      let matchScore = 100;
      let reason = 'Fully Compatible';

      if (isDuplex) {
        if (caps.autoDuplex) {
          matchScore += 50; // Highest priority: hardware duplex
          reason = 'Hardware Auto-Duplex Compatible';
        } else if (caps.manualDuplex) {
          requiresManualFlip = true;
          matchScore += 10;
          reason = 'Manual Paper Flip Required (Operator Intervention)';
        } else {
          // Does not support any duplex
          continue;
        }
      } else {
        matchScore += 20; // Simplex runs on any compatible paper/color engine
      }

      // Penalize busy printers
      matchScore -= printer.currentQueueCount * 15;

      matches.push({
        printer,
        requiresManualFlip,
        matchScore,
        reason,
      });
    }

    // Sort by matchScore descending (highest score / lowest workload first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches;
  }

  /**
   * Adjusts active workload counter for a printer.
   */
  public updateWorkload(printerId: string, delta: number): void {
    const printer = this.printers.get(printerId);
    if (printer) {
      printer.currentQueueCount = Math.max(0, printer.currentQueueCount + delta);
    }
  }
}

export const printerService = new PrinterService();

