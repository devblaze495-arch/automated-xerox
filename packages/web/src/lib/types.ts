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

