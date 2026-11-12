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
  status?: 'ONLINE' | 'PAPER_OUT' | 'OFFLINE' | 'ERROR';
  queuedJobs?: number;
  queuedPages?: number;
  lastTelemetryAt?: Date;
}

export interface PrinterTelemetry {
  name: string;
  port: string;
  status: 'ONLINE' | 'PAPER_OUT' | 'OFFLINE' | 'ERROR';
  queuedJobs: number;
  queuedPages: number;
  supportsColor: boolean;
  supportsA3: boolean;
  supportsAutoDuplex: boolean;
  lastUpdated?: Date;
}

export interface OptimalPrinterJobConfig {
  paperSize: 'A4' | 'A3';
  colorMode: 'BW' | 'COLOR';
  duplexMode?: 'SIMPLEX' | 'DUPLEX_LONG' | 'DUPLEX_SHORT' | string;
  totalSheets?: number;
  sheets?: number;
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
  private centerTelemetry: Map<string, Map<string, PrinterTelemetry>> = new Map();

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
          const shortId = Object.keys(PRINTER_UUID_MAP).find((k) => PRINTER_UUID_MAP[k] === dp.id);
          const targetId = shortId || dp.id;
          const existing = this.printers.get(targetId);
          const caps = (dp.capabilities as any) || existing?.capabilities;
          const printerObj: PrinterDevice = {
            id: targetId,
            name: dp.name,
            model: dp.model,
            portName: dp.portName || existing?.portName || 'USB001',
            connectionType: dp.connectionType as any,
            capabilities: caps,
            isOnline: dp.isOnline,
            isActive: dp.isActive,
            centerId: dp.centerId,
            currentQueueCount: existing?.currentQueueCount || 0,
          };
          this.printers.set(targetId, printerObj);
          this.printers.set(dp.id, printerObj);
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
    const seen = new Set<string>();
    const list: PrinterDevice[] = [];
    for (const p of this.printers.values()) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        list.push(p);
      }
    }
    return list;
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
    const printer = this.printers.get(id) || this.printers.get(PRINTER_UUID_MAP[id] || '');
    if (!printer) return null;

    printer.isOnline = isOnline !== undefined ? isOnline : !printer.isOnline;
    printer.status = printer.isOnline ? 'ONLINE' : 'OFFLINE';
    this.printers.set(id, printer);
    this.printers.set(printer.id, printer);
    if (PRINTER_UUID_MAP[printer.id]) {
      this.printers.set(PRINTER_UUID_MAP[printer.id], printer);
    }

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
    const seen = new Set<string>();

    for (const printer of this.printers.values()) {
      if (seen.has(printer.name)) continue;
      seen.add(printer.name);

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

  /**
   * Ingests real-time hardware telemetry reported from the Windows Print Agent
   */
  public updateFromTelemetry(centerId: string, telemetryList: PrinterTelemetry[]): void {
    if (!this.centerTelemetry.has(centerId)) {
      this.centerTelemetry.set(centerId, new Map());
    }
    const centerMap = this.centerTelemetry.get(centerId)!;

    for (const t of telemetryList) {
      centerMap.set(t.name, { ...t, lastUpdated: new Date() });

      // Match all printer instances in registry
      for (const printer of this.printers.values()) {
        const isMatch =
          printer.name.toLowerCase() === t.name.toLowerCase() ||
          printer.portName.toLowerCase() === t.port.toLowerCase() ||
          (printer.name.includes('G2010') && t.name.includes('G2010')) ||
          (printer.name.includes('G3070') && t.name.includes('G3070')) ||
          (printer.name.includes('2224') && (t.name.includes('UFR') || t.name.includes('2224')));

        if (isMatch) {
          printer.status = t.status;
          printer.isOnline = t.status === 'ONLINE';
          printer.queuedJobs = t.queuedJobs;
          printer.queuedPages = t.queuedPages;
          printer.currentQueueCount = t.queuedJobs;
          printer.lastTelemetryAt = new Date();
        }
      }
    }
  }

  public getTelemetry(centerId: string): PrinterTelemetry[] {
    const map = this.centerTelemetry.get(centerId);
    if (!map) return [];
    return Array.from(map.values());
  }

  /**
   * Smart load-balancing printer selection:
   * 1. Filter printers that are ONLINE (skip OFFLINE, PAPER_OUT, or ERROR).
   * 2. Filter by hard capabilities:
   *    - A3 paper requires supportsA3 (imageRUNNER 2224)
   *    - Full color requires supportsColor (PIXMA G2010 or G3070)
   *    - Duplex requires autoDuplex or manualDuplex
   * 3. Load-balance among eligible printers:
   *    - Score: (queuedPages * 2 + queuedJobs)
   *    - For B&W A4 Duplex jobs > 10 sheets: prefer supportsAutoDuplex === true (imageRUNNER 2224)
   *      unless its queue exceeds 150 pages while G2010/G3070 are idle.
   *    - For fast-lane jobs (<= 5 sheets): pick eligible printer with queuedJobs === 0 first.
   *    - General: sort by lowest (queuedPages * 2 + queuedJobs) score.
   */
  public selectOptimalPrinter(
    centerId: string,
    jobConfig: OptimalPrinterJobConfig
  ): PrinterDevice | undefined {
    // Collect distinct printer engines by name
    const seenNames = new Set<string>();
    const allPrinters: PrinterDevice[] = [];
    for (const p of this.printers.values()) {
      if (!seenNames.has(p.name)) {
        seenNames.add(p.name);
        allPrinters.push(p);
      }
    }

    const candidates = allPrinters.filter(
      (p) =>
        !centerId ||
        p.centerId === centerId ||
        centerId === 'CTR-CAMPUS-01' ||
        p.centerId === '00000000-0000-0000-0000-000000000002'
    );
    const pool = candidates.length > 0 ? candidates : allPrinters;

    // 1. Filter printers that are ONLINE (skip OFFLINE, PAPER_OUT, ERROR)
    const onlinePrinters = pool.filter((p) => {
      if (!p.isActive) return false;
      if (p.status) {
        return p.status === 'ONLINE';
      }
      return p.isOnline;
    });

    if (onlinePrinters.length === 0) return undefined;

    // 2. Filter by hard capabilities
    const isA3 = jobConfig.paperSize === 'A3';
    const isColor = jobConfig.colorMode === 'COLOR';
    const isDuplex = !!jobConfig.duplexMode && jobConfig.duplexMode !== 'SIMPLEX';

    const eligible = onlinePrinters.filter((p) => {
      if (isA3 && !p.capabilities.a3) return false;
      if (!isA3 && !p.capabilities.a4) return false;
      if (isColor && !p.capabilities.color) return false;
      if (isDuplex && !p.capabilities.autoDuplex && !p.capabilities.manualDuplex) return false;
      return true;
    });

    if (eligible.length === 0) return undefined;
    if (eligible.length === 1) return eligible[0];

    const getQueuedJobs = (p: PrinterDevice) => p.queuedJobs ?? p.currentQueueCount ?? 0;
    const getQueuedPages = (p: PrinterDevice) => p.queuedPages ?? (getQueuedJobs(p) * 2);
    const getLoadScore = (p: PrinterDevice) => (getQueuedPages(p) * 2) + getQueuedJobs(p);

    const totalSheets = jobConfig.totalSheets ?? jobConfig.sheets ?? 1;

    // Rule A: B&W A4 Duplex > 10 sheets
    // Prefer supportsAutoDuplex === true (imageRUNNER 2224) unless its queue exceeds 150 pages while G2010/G3070 are idle.
    const isBwA4DuplexHeavy = !isColor && !isA3 && isDuplex && totalSheets > 10;
    if (isBwA4DuplexHeavy) {
      const autoDuplexPrinter = eligible.find((p) => p.capabilities.autoDuplex);
      const idleAlternative = eligible.find(
        (p) => !p.capabilities.autoDuplex && getQueuedJobs(p) === 0
      );

      if (autoDuplexPrinter) {
        if (getQueuedPages(autoDuplexPrinter) > 150 && idleAlternative) {
          // imageRUNNER is backed up (>150 pages) and G2010/G3070 is idle -> offload to idle printer
          return idleAlternative;
        }
        return autoDuplexPrinter;
      }
    }

    // Rule B: Fast-lane jobs (<= 5 sheets)
    // Pick the eligible printer with queuedJobs === 0 first.
    const isFastLane = totalSheets <= 5;
    if (isFastLane) {
      const idlePrinters = eligible.filter((p) => getQueuedJobs(p) === 0);
      if (idlePrinters.length > 0) {
        idlePrinters.sort((a, b) => getLoadScore(a) - getLoadScore(b));
        return idlePrinters[0];
      }
    }

    // Rule C: Load-balance among eligible printers by lowest score
    eligible.sort((a, b) => {
      const scoreA = getLoadScore(a);
      const scoreB = getLoadScore(b);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return (b.capabilities.ppmSpeed || 0) - (a.capabilities.ppmSpeed || 0);
    });

    return eligible[0];
  }
}

export const printerService = new PrinterService();

