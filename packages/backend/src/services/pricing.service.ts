export type ColorMode = 'BW' | 'COLOR';
export type PaperSize = 'A4' | 'A3';
export type DuplexMode = 'SIMPLEX' | 'DUPLEX_LONG' | 'DUPLEX_SHORT';

export interface PricingInput {
  pageCount: number;
  pageRange?: string; // e.g. 'ALL', '1-5, 8, 11-14'
  colorMode: ColorMode;
  paperSize: PaperSize;
  duplexMode: DuplexMode;
  copies: number;
}

export interface PricingRateCard {
  paperSheetCents: Record<PaperSize, number>;
  tonerImpressionCents: Record<PaperSize, Record<ColorMode, number>>;
  convenienceFeeCents: number;
}

export const DEFAULT_RATE_CARD: PricingRateCard = {
  paperSheetCents: {
    A4: 50,  // Base media cost per physical A4 sheet (in cents/paise)
    A3: 120, // Base media cost per physical A3 sheet
  },
  tonerImpressionCents: {
    A4: {
      BW: 50,    // Black & White per-side impression
      COLOR: 300, // Full Color per-side impression
    },
    A3: {
      BW: 100,
      COLOR: 600,
    },
  },
  convenienceFeeCents: 100, // Platform / queue processing fee
};

export interface PricingCalculationResult {
  effectivePages: number;
  pageRangeResolved: number[];
  sheetsPerCopy: number;
  totalSheets: number;
  totalImpressions: number;
  basePaperCents: number;
  tonerCents: number;
  subtotalCents: number;
  itemTotalCents: number;
  breakdown: {
    pageCountTotal: number;
    copies: number;
    colorMode: ColorMode;
    paperSize: PaperSize;
    duplexMode: DuplexMode;
    paperUnitRateCents: number;
    tonerUnitRateCents: number;
  };
}

/**
 * Pure deterministic parser resolving page range expressions against total document pages.
 * Supports: 'ALL', '1-5, 8, 11-14', individual numbers, whitespace tolerance.
 */
export function parsePageRange(pageRange: string | undefined, totalPages: number): number[] {
  if (!pageRange || pageRange.trim().toUpperCase() === 'ALL') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pagesSet = new Set<number>();
  const tokens = pageRange.split(',');

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) continue;

    if (token.includes('-')) {
      const parts = token.split('-').map((p) => parseInt(p.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const start = Math.max(1, Math.min(parts[0], parts[1]));
        const end = Math.min(totalPages, Math.max(parts[0], parts[1]));
        for (let p = start; p <= end; p++) {
          pagesSet.add(p);
        }
      }
    } else {
      const pageNum = parseInt(token, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pagesSet.add(pageNum);
      }
    }
  }

  const sortedPages = Array.from(pagesSet).sort((a, b) => a - b);
  // Fallback to all pages if no valid page was parsed
  return sortedPages.length > 0 ? sortedPages : Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Exact Sheet-Level Pricing Engine.
 * Never trust client prices. Computes exact physical media sheets and toner impressions.
 */
export function calculateItemPrice(
  input: PricingInput,
  rateCard: PricingRateCard = DEFAULT_RATE_CARD
): PricingCalculationResult {
  const copies = Math.max(1, Math.floor(input.copies || 1));
  const totalDocPages = Math.max(1, Math.floor(input.pageCount || 1));

  // 1. Resolve effective pages from range
  const resolvedPages = parsePageRange(input.pageRange, totalDocPages);
  const effectivePages = resolvedPages.length;

  // 2. Calculate physical sheets per copy based on duplex mode
  const isDuplex = input.duplexMode === 'DUPLEX_LONG' || input.duplexMode === 'DUPLEX_SHORT';
  const sheetsPerCopy = isDuplex ? Math.ceil(effectivePages / 2) : effectivePages;

  // 3. Aggregate sheets and impressions across all copies
  const totalSheets = sheetsPerCopy * copies;
  const totalImpressions = effectivePages * copies;

  // 4. Rate card lookups
  const paperUnitRateCents = rateCard.paperSheetCents[input.paperSize];
  const tonerUnitRateCents = rateCard.tonerImpressionCents[input.paperSize][input.colorMode];

  // 5. Cost components
  const basePaperCents = totalSheets * paperUnitRateCents;
  const tonerCents = totalImpressions * tonerUnitRateCents;
  const subtotalCents = basePaperCents + tonerCents;
  const itemTotalCents = subtotalCents;

  return {
    effectivePages,
    pageRangeResolved: resolvedPages,
    sheetsPerCopy,
    totalSheets,
    totalImpressions,
    basePaperCents,
    tonerCents,
    subtotalCents,
    itemTotalCents,
    breakdown: {
      pageCountTotal: totalDocPages,
      copies,
      colorMode: input.colorMode,
      paperSize: input.paperSize,
      duplexMode: input.duplexMode,
      paperUnitRateCents,
      tonerUnitRateCents,
    },
  };
}

