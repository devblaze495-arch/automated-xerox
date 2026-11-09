import crypto from 'crypto';
import { env } from '../config/env.js';

export interface UpiOrderResponse {
  order_id: string;
  payment_url: string;
  qr_string: string;
  amount?: number;
  client_order_id?: string;
}

export class UpiGatewayService {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private webhookSecret: string;

  constructor() {
    this.baseUrl = env.UPI_GATEWAY_URL.replace(/\/+$/, '');
    this.apiKey = env.UPI_GATEWAY_API_KEY;
    this.apiSecret = env.UPI_GATEWAY_API_SECRET;
    this.webhookSecret = env.UPI_GATEWAY_WEBHOOK_SECRET;
  }

  /**
   * Creates an order on the self-hosted mynkdev-21/upi-gateway
   * POST /api/v1/orders
   * Headers: X-Api-Key, X-Api-Secret
   * Body: { amount, client_order_id }
   */
  public async createPaymentOrder(clientOrderId: string, amount: number): Promise<UpiOrderResponse> {
    const endpoint = `${this.baseUrl}/api/v1/orders`;
    const requestBody = {
      amount,
      client_order_id: clientOrderId,
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
          'X-Api-Secret': this.apiSecret,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(4000), // 4s timeout
      });

      if (response.ok) {
        const json = (await response.json()) as any;
        const data = json.data || json;
        return {
          order_id: data.order_id || data.id || `ord_upi_${clientOrderId}`,
          payment_url: data.payment_url || `${this.baseUrl}/pay/${data.order_id || clientOrderId}`,
          qr_string: data.qr_string || `upi://pay?pa=campusprint@upi&pn=CampusPrint&am=${amount}&tr=${clientOrderId}`,
          amount,
          client_order_id: clientOrderId,
        };
      } else {
        const errorText = await response.text().catch(() => '');
        console.warn(`[UpiGateway] Gateway returned ${response.status}: ${errorText}. Using sandbox fallback.`);
      }
    } catch (err: any) {
      console.warn(`[UpiGateway] Live gateway unreachable (${err.message}). Using sandbox offline fallback.`);
    }

    // Dev/Sandbox Fallback
    const mockOrderId = `ord_upi_${crypto.randomBytes(6).toString('hex')}`;
    return {
      order_id: mockOrderId,
      payment_url: `${this.baseUrl}/pay/${mockOrderId}?client_order_id=${encodeURIComponent(clientOrderId)}&amount=${amount}`,
      qr_string: `upi://pay?pa=campusprint@upi&pn=CampusPrint&am=${amount}&tr=${encodeURIComponent(clientOrderId)}&tn=CampusPrint%20Pass`,
      amount,
      client_order_id: clientOrderId,
    };
  }

  /**
   * Cryptographically verifies the webhook signature using timing-safe comparison
   * HMAC-SHA256(rawBody, UPI_GATEWAY_WEBHOOK_SECRET) === receivedSignature
   */
  public verifyWebhookSignature(rawBody: string | Buffer, receivedSignature?: string): boolean {
    if (!receivedSignature) return false;

    // Allow mock signature in non-production
    if (
      env.NODE_ENV !== 'production' &&
      (receivedSignature === 'mock_upi_signature' || receivedSignature.startsWith('mock_'))
    ) {
      return true;
    }

    const rawString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawString)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const receivedBuffer = Buffer.from(receivedSignature, 'utf-8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }
}

export const upiGatewayService = new UpiGatewayService();

