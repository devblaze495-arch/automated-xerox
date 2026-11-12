import {
  UploadedDocument,
  PricingQuote,
  ColorMode,
  PaperSize,
  DuplexMode,
  OrderRecord,
  ConnectedAgentInfo,
  PrinterDevice,
  EnrichedOperatorOrder,
  SubscriptionStatusInfo,
  SubscribeOrderResponse,
  OperatorAnalyticsResponse,
  ShopSettings,
  PresetRange,
} from './types';

const API_BASE = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

/**
 * Uploads a PDF file via multipart/form-data
 */
export async function uploadDocument(file: File): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/v1/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || errorJson.error || `Upload failed with status ${res.status}`);
  }

  const json = await res.json();
  return {
    id: json.data.documentId,
    fileName: json.data.fileName,
    pageCount: json.data.pageCount,
    fileSizeBytes: json.data.fileSizeBytes,
    sha256Hash: json.data.sha256Hash,
    downloadUrl: json.data.downloadUrl,
    createdAt: json.data.createdAt,
  };
}

/**
 * Creates a mock test document on the fly for rapid local testing
 */
export async function createMockDocument(): Promise<UploadedDocument> {
  // Minimal valid PDF content
  const mockPdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 18 Tf
50 780 Td
(CampusPrint Sample Lecture Document - 4 Pages) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000415 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
500
%%EOF`;

  const blob = new Blob([mockPdfContent], { type: 'application/pdf' });
  const sampleTitles = [
    'CS201_Data_Structures_Assignment_3.pdf',
    'Machine_Learning_Lecture_Notes_W5.pdf',
    'Campus_Research_Paper_Draft_v2.pdf',
    'Operating_Systems_Lab_Manual.pdf',
  ];
  const file = new File([blob], sampleTitles[Math.floor(Math.random() * sampleTitles.length)], {
    type: 'application/pdf',
  });

  return uploadDocument(file);
}

/**
 * Calculates exact sheet-level pricing quote
 */
export async function calculatePricing(params: {
  pageCount: number;
  pageRange: string;
  colorMode: ColorMode;
  paperSize: PaperSize;
  duplexMode: DuplexMode;
  copies: number;
}): Promise<PricingQuote> {
  const res = await fetch(`${API_BASE}/api/v1/pricing/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Pricing calculation failed');
  }

  const json = await res.json();
  return json.data;
}

/**
 * Creates an order in PAYMENT_PENDING state
 */
export async function createOrder(params: {
  items: Array<{
    documentId: string;
    pageRange: string;
    colorMode: ColorMode;
    paperSize: PaperSize;
    duplexMode: DuplexMode;
    copies: number;
    pageCount: number;
  }>;
}): Promise<{
  orderId: string;
  status: string;
  collectionOtp: string;
  totalSheets: number;
  totalAmountCents: number;
  items: any[];
}> {
  const res = await fetch(`${API_BASE}/api/v1/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Order creation failed');
  }

  const json = await res.json();
  return json.data;
}

/**
 * Initiates Razorpay payment order on the backend
 */
export async function createRazorpayOrder(orderId: string, amountCents?: number): Promise<{
  success: boolean;
  rzpOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  orderId: string;
}> {
  const res = await fetch(`${API_BASE}/api/v1/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, amountCents }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || errorJson.error || 'Failed to initiate payment gateway order');
  }

  return res.json();
}

/**
 * Verifies payment and triggers dispatch to printer
 */
export async function verifyPayment(params: {
  orderId: string;
  rzpOrderId?: string;
  rzpPaymentId?: string;
  rzpSignature?: string;
}): Promise<{
  success: boolean;
  message: string;
  orderId: string;
  status: string;
}> {
  const res = await fetch(`${API_BASE}/api/v1/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Payment verification failed');
  }

  return res.json();
}

/**
 * Fetches order details with live queue position
 */
export async function getOrder(orderId: string): Promise<OrderRecord> {
  const res = await fetch(`${API_BASE}/api/v1/orders/${orderId}`);
  if (!res.ok) {
    throw new Error('Order not found');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Polls connected operator agents
 */
export async function getConnectedAgents(): Promise<{
  totalConnected: number;
  agents: ConnectedAgentInfo[];
}> {
  const res = await fetch(`${API_BASE}/api/v1/agent/connected`).catch(() => null);
  if (!res || !res.ok) {
    return { totalConnected: 0, agents: [] };
  }
  return res.json();
}

/**
 * Triggers test dispatch to connected agent
 */
export async function triggerTestDispatch(centerId?: string): Promise<{
  success: boolean;
  message: string;
  dispatchedPayload?: any;
}> {
  const query = centerId ? `?centerId=${encodeURIComponent(centerId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/agent/test-dispatch${query}`);
  return res.json();
}

// -------------------------------------------------------------
// OPERATOR & PRINTER API METHODS
// -------------------------------------------------------------

/**
 * Fetches all orders for the operator workbench
 */
export async function getOperatorOrders(): Promise<EnrichedOperatorOrder[]> {
  const res = await fetch(`${API_BASE}/api/v1/operator/orders`);
  if (!res.ok) {
    throw new Error('Failed to fetch operator orders');
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * Accepts and dispatches an order to the assigned/specified printer
 */
export async function acceptOperatorOrder(orderId: string, printerId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/operator/orders/${orderId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to accept order');
  }
  return res.json();
}

/**
 * Marks an order READY_FOR_COLLECTION
 */
export async function readyOperatorOrder(orderId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/operator/orders/${orderId}/ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to mark order ready');
  }
  return res.json();
}

/**
 * Validates the student's 4-digit Collection OTP and marks order COLLECTED
 */
export async function collectOperatorOrder(orderId: string, collectionOtp: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/operator/orders/${orderId}/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionOtp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to verify OTP');
  }
  return res.json();
}

/**
 * Rejects an order and initiates student refund
 */
export async function rejectOperatorOrder(orderId: string, reason?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/operator/orders/${orderId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reject order');
  }
  return res.json();
}

/**
 * Toggles Walk-in Mode (Pauses or Resumes digital print spooler)
 */
export async function toggleSpoolerPause(centerId: string, paused: boolean): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/operator/spooler/pause`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ centerId, paused }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to toggle spooler state');
  }
  return res.json();
}

/**
 * Bumps an order to the top of the operator queue (isUrgent = true)
 */
export async function bumpOrderPriority(orderId: string, isUrgent = true): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/operator/orders/${orderId}/priority`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isUrgent }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to bump order priority');
  }
  return res.json();
}

/**
 * Manually re-routes an order to a specified physical Canon printer
 */
export async function reRouteOrderPrinter(orderId: string, targetPrinterName: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/operator/orders/${orderId}/printer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetPrinterName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to re-route order printer');
  }
  return res.json();
}

/**
 * Lists all registered printers
 */
export async function getPrinters(): Promise<PrinterDevice[]> {
  const res = await fetch(`${API_BASE}/api/v1/printers`);
  if (!res.ok) {
    return [];
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * Toggles printer online/offline availability
 */
export async function togglePrinter(printerId: string, isOnline?: boolean): Promise<PrinterDevice> {
  const res = await fetch(`${API_BASE}/api/v1/printers/${printerId}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isOnline }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to toggle printer status');
  }
  const json = await res.json();
  return json.data;
}

// -------------------------------------------------------------
// SUBSCRIPTION & PAYWALL API METHODS (mynkdev-21/upi-gateway)
// -------------------------------------------------------------

/**
 * Fetches current subscription status for a student user
 */
export async function getSubscriptionStatus(userId?: string): Promise<SubscriptionStatusInfo> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/subscription/status${query}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch subscription status');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Initiates subscription checkout via self-hosted upi-gateway
 */
export async function subscribeToPlan(
  planType: 'MONTHLY' | 'ANNUAL',
  userId?: string
): Promise<SubscribeOrderResponse> {
  const res = await fetch(`${API_BASE}/api/v1/subscription/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planType, userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to initiate subscription order');
  }
  return res.json();
}

/**
 * Simulates UPI Gateway webhook confirmation for zero-friction local sandbox testing
 */
export async function simulateSubscriptionWebhook(
  clientOrderId: string,
  amount: number,
  utr?: string
): Promise<any> {
  const payload = {
    event: 'order.paid',
    data: {
      client_order_id: clientOrderId,
      amount,
      utr: utr || `UTR${Date.now()}`,
      status: 'paid',
    },
  };

  const res = await fetch(`${API_BASE}/api/v1/subscription/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': 'mock_upi_signature',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to trigger subscription webhook');
  }

  return res.json();
}

/**
 * Fetches comprehensive operator analytics, financial metrics, hourly volume, and ledger
 */
export async function getOperatorAnalytics(params?: {
  preset?: PresetRange;
  startDate?: string;
  endDate?: string;
  centerId?: string;
}): Promise<OperatorAnalyticsResponse> {
  const query = new URLSearchParams();
  if (params?.preset) query.set('preset', params.preset);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.centerId) query.set('centerId', params.centerId);

  const res = await fetch(`${API_BASE}/api/v1/operator/analytics?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to load operator analytics');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Downloads the itemized collection ledger as CSV
 */
export async function exportOperatorAnalyticsCsv(params?: {
  preset?: PresetRange;
  startDate?: string;
  endDate?: string;
  centerId?: string;
}): Promise<Blob> {
  const query = new URLSearchParams();
  if (params?.preset) query.set('preset', params.preset);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.centerId) query.set('centerId', params.centerId);

  const res = await fetch(`${API_BASE}/api/v1/operator/analytics/export?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to export CSV report');
  }
  return res.blob();
}

/**
 * Manually purges a document file blob from storage for privacy
 */
export async function purgeDocument(documentId: string): Promise<{
  success: boolean;
  documentId: string;
  isPurged: boolean;
  purgedAt: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/api/v1/operator/documents/${encodeURIComponent(documentId)}/purge`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to purge document');
  }
  return res.json();
}

/**
 * Retrieves shop open status, privacy auto-delete preference, per-sheet pricing rates, and paper stock
 */
export async function getShopSettings(centerId?: string): Promise<ShopSettings> {
  const query = centerId ? `?centerId=${encodeURIComponent(centerId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/operator/settings${query}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to load shop settings');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Updates shop configuration (isOpen, autoDeleteOnCollection, rates, paper stock)
 */
export async function updateShopSettings(updates: Partial<ShopSettings>): Promise<ShopSettings> {
  const res = await fetch(`${API_BASE}/api/v1/operator/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to update shop settings');
  }
  const json = await res.json();
  return json.data;
}


export interface AdminOverviewResponse {
  metrics: {
    totalActiveCenters: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    totalSaasRevenueInr: number;
    totalPrintOrders: number;
    totalPrintRevenueInr: number;
  };
  centers: Array<{
    id: string;
    name: string;
    code: string;
    location: string;
    ownerName: string;
    ownerPhone: string;
    upiVpa: string;
    agentSecret: string;
    isOpen: boolean;
    isActive: boolean;
    subscription: {
      status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE';
      tier: string;
      currentPeriodEnd: string | null;
      daysRemaining: number;
      isSubscribed: boolean;
    };
    agentStatus: {
      isOnline: boolean;
      deviceModel: string;
      appVersion: string;
      lastHeartbeat: string | null;
    };
    orderCount: number;
    revenueGeneratedInr: number;
  }>;
}

export async function getAdminOverview(adminSecret: string): Promise<AdminOverviewResponse> {
  const res = await fetch(`${API_BASE}/api/v1/admin/overview`, {
    headers: { 'x-admin-secret': adminSecret },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Admin authentication failed (HTTP ${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function createAdminCenter(
  adminSecret: string,
  payload: { name: string; code: string; location: string; ownerName?: string; ownerPhone?: string; upiVpa?: string }
) {
  const res = await fetch(`${API_BASE}/api/v1/admin/centers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': adminSecret,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to onboard center');
  }
  return res.json();
}

export async function extendCenterSubscription(
  adminSecret: string,
  centerId: string,
  extensionDays = 30
) {
  const res = await fetch(`${API_BASE}/api/v1/admin/centers/${centerId}/subscription`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': adminSecret,
    },
    body: JSON.stringify({ extensionDays, status: 'ACTIVE' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to extend subscription');
  }
  return res.json();
}

export interface ScanCollectResponse {
  success: boolean;
  message: string;
  purgedCount?: number;
  order: {
    id: string;
    shortId: string;
    studentName: string;
    totalSheets: number;
    amountPaid: number;
    documentNames: string[];
  };
}

/**
 * Instant Counter Handover via USB Scanner wedge or Webcam QR scanner
 */
export async function scanCollectOrder(
  centerId: string,
  scanInput: string
): Promise<ScanCollectResponse> {
  const res = await fetch(`${API_BASE}/api/v1/operator/orders/scan-collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ centerId, scanInput }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || errorJson.message || `Scan collect failed (HTTP ${res.status})`);
  }

  return res.json();
}

export interface WalkInOrderPayload {
  centerId?: string;
  paperSize: 'A4' | 'A3';
  sheets: number;
  colorMode: 'BW' | 'COLOR';
  amountCollected: number;
  note?: string;
}

export interface WalkInOrderResponse {
  success: boolean;
  message: string;
  order: {
    id: string;
    shortId: string;
    totalSheets: number;
    amountPaid: number;
    paperSize: string;
    colorMode: string;
    note: string;
  };
}

/**
 * Quick Counter / Walk-in Customer Logging
 */
export async function logWalkInOrder(payload: WalkInOrderPayload): Promise<WalkInOrderResponse> {
  const res = await fetch(`${API_BASE}/api/v1/operator/walk-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || errorJson.message || `Failed to log walk-in (HTTP ${res.status})`);
  }

  return res.json();
}


