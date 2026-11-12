export type ColorMode = 'BW' | 'COLOR';
export type PaperSize = 'A4' | 'A3';
export type DuplexMode = 'SIMPLEX' | 'DUPLEX_LONG' | 'DUPLEX_SHORT';

export interface UploadedDocument {
  id: string;
  fileName: string;
  pageCount: number;
  fileSizeBytes: number;
  sha256Hash: string;
  downloadUrl: string;
  createdAt?: string;
}

export interface DocumentPrintConfig {
  documentId: string;
  document: UploadedDocument;
  pageRange: string;
  colorMode: ColorMode;
  paperSize: PaperSize;
  duplexMode: DuplexMode;
  copies: number;
  pricing?: PricingQuote;
  isCalculating?: boolean;
}

export interface PricingQuote {
  pageCount?: number;
  effectivePages: number;
  pageRangeResolved?: number[];
  sheetsPerCopy: number;
  totalSheets: number;
  impressionsCount?: number;
  totalImpressions?: number;
  paperCostCents?: number;
  basePaperCents?: number;
  tonerCostCents?: number;
  tonerCents?: number;
  subtotalCents?: number;
  itemTotalCents: number;
  breakdown?: {
    paperCostPerSheetCents: number;
    tonerCostPerImpressionCents: number;
  };
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  documentId: string;
  pageRange: string;
  colorMode: ColorMode;
  paperSize: PaperSize;
  duplexMode: DuplexMode;
  copies: number;
  computedSheets: number;
  itemTotalCents: number;
  document?: UploadedDocument;
}

export interface OrderRecord {
  id: string;
  studentId: string;
  centerId: string;
  status: string;
  collectionOtp: string;
  totalSheets: number;
  subtotalCents: number;
  convenienceFeeCents: number;
  totalAmountCents: number;
  cancellationReason?: string;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  aheadJobsCount?: number;
  aheadSheets?: number;
  createdAt: string;
  updatedAt: string;
  items?: OrderItemRecord[];
}

export interface ConnectedAgentInfo {
  connectionId: string;
  centerId: string;
  deviceModel: string;
  appVersion: string;
  connectedAt: string;
  lastHeartbeat: string;
}

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
}

export interface PrinterMatchResult {
  printer: PrinterDevice;
  requiresManualFlip: boolean;
  matchScore: number;
  reason: string;
}

export interface EnrichedOperatorOrder {
  id: string;
  studentId: string;
  studentName?: string;
  studentPhone?: string;
  centerId: string;
  status: string;
  collectionOtp: string;
  totalSheets: number;
  subtotalCents: number;
  convenienceFeeCents: number;
  totalAmountCents: number;
  cancellationReason?: string;
  assignedPrinterId?: string | null;
  assignedPrinterName?: string | null;
  assignedPrinterPort?: string | null;
  requiresManualFlip?: boolean;
  isUrgent?: boolean;
  priorityScore?: number;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    orderId: string;
    documentId: string;
    documentName: string;
    totalPages: number;
    pageRange: string;
    colorMode: ColorMode;
    paperSize: PaperSize;
    duplexMode: DuplexMode;
    copies: number;
    computedSheets: number;
    itemTotalCents: number;
    compatiblePrinters?: PrinterMatchResult[];
    requiresManualFlip?: boolean;
  }>;
}

export interface SubscriptionStatusInfo {
  isSubscribed: boolean;
  currentPeriodEnd: string | null;
  tier: 'STARTER_INTRO' | 'STARTER_RENEWAL' | 'ANNUAL';
  status: 'INACTIVE' | 'ACTIVE' | 'EXPIRED';
  eligiblePromo: boolean;
  daysRemaining: number;
  hasUsedIntroPromo: boolean;
}

export interface SubscribeOrderResponse {
  success: boolean;
  paymentUrl: string;
  qrString?: string;
  amount: number;
  tier: string;
  clientOrderId: string;
}

export type PresetRange =
  | 'today'
  | 'yesterday'
  | 'week'
  | '15days'
  | 'month'
  | 'last_month'
  | 'year'
  | 'custom';

export interface HourlyDistributionItem {
  hour: number;
  label: string;
  orderCount: number;
  sheetCount: number;
  revenue: number;
}

export interface CollectionLedgerItem {
  orderId: string;
  createdAt: string;
  collectedAt: string | null;
  studentName: string;
  studentPhone: string;
  documentName: string;
  documentId: string;
  paperSize: 'A4' | 'A3';
  duplexMode: string;
  colorMode: 'BW' | 'COLOR';
  copies: number;
  totalSheets: number;
  amountRupees: number;
  status: string;
  isPurged: boolean;
  purgedAt: string | null;
}

export interface OperatorAnalyticsResponse {
  dateRange: {
    preset: PresetRange;
    startDate: string;
    endDate: string;
  };
  metrics: {
    grossRevenueRupees: number;
    totalOrdersCount: number;
    completedOrdersCount: number;
    cancelledOrdersCount: number;
    pendingOrdersCount: number;
    a4SimplexSheets: number;
    a4DuplexSheets: number;
    a3SimplexSheets: number;
    a3DuplexSheets: number;
    totalSheets: number;
    colorImpressions: number;
    bwImpressions: number;
    paperStockA4: number;
    paperStockA3: number;
    lowPaperAlert: boolean;
  };
  hourlyDistribution: HourlyDistributionItem[];
  ledger: CollectionLedgerItem[];
}

export interface ShopSettings {
  id: string;
  name: string;
  slug: string;
  isOpen: boolean;
  isSpoolerPaused?: boolean;
  autoDeleteOnCollection: boolean;
  bwRatePerSheet: number;
  colorRatePerSheet: number;
  a3Multiplier: number;
  paperStockA4: number;
  paperStockA3: number;
}


