// packages/backend/src/services/notification.service.ts
import { env } from '../config/env.js';

export interface OrderReadyAlertParams {
  phone: string;       // 10-digit Indian mobile (without +91 prefix)
  studentName: string;
  orderId: string;
  pickupOtp: string;
  centerName: string;
}

class NotificationService {
  /**
   * Formats the standard "Ready for Pickup" message
   */
  private formatMessage(params: OrderReadyAlertParams): string {
    const shortOrderId = params.orderId.substring(0, 8).toUpperCase();
    return `Hi ${params.studentName}, your prints for Order #${shortOrderId} are READY at ${params.centerName}! Show Pickup OTP: ${params.pickupOtp} at the counter to collect.`;
  }

  /**
   * Fire-and-forget notification - never throws, never blocks.
   */
  async sendOrderReadyAlert(params: OrderReadyAlertParams): Promise<void> {
    // Fire and forget
    this._send(params).catch((err) => {
      console.error(`[Notify] Failed to send alert for order ${params.orderId}:`, err?.message || err);
    });
  }

  private async _send(params: OrderReadyAlertParams): Promise<void> {
    const provider = env.NOTIFY_PROVIDER;
    const message = this.formatMessage(params);
    const phone = params.phone.replace(/\D/g, '').slice(-10); // normalize to 10 digits

    switch (provider) {
      case 'fast2sms':
        await this.sendFast2Sms(phone, message);
        break;
      case 'whatsapp_cloud':
        await this.sendWhatsAppCloud(phone, params);
        break;
      case 'console':
      default:
        this.logToConsole(phone, message, params);
        break;
    }
  }

  private logToConsole(phone: string, message: string, params: OrderReadyAlertParams): void {
    const separator = '─'.repeat(60);
    console.log(`\n${separator}`);
    console.log(`📱 [NotifyService] ORDER READY ALERT (console/dev mode)`);
    console.log(`   Provider: console`);
    console.log(`   To:       +91${phone}`);
    console.log(`   Student:  ${params.studentName}`);
    console.log(`   Order ID: ${params.orderId}`);
    console.log(`   OTP:      ${params.pickupOtp}`);
    console.log(`   Center:   ${params.centerName}`);
    console.log(`   Message:  ${message}`);
    console.log(`${separator}\n`);
  }

  private async sendFast2Sms(phone: string, message: string): Promise<void> {
    const apiKey = env.FAST2SMS_API_KEY;
    if (!apiKey) {
      console.warn('[Notify] FAST2SMS_API_KEY not configured, falling back to console log');
      console.log(`[Notify/fast2sms] Would send to +91${phone}: ${message}`);
      return;
    }

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: phone,
      }),
    });

    const result = await response.json() as any;
    if (!response.ok || result.return === false) {
      throw new Error(`Fast2SMS error: ${JSON.stringify(result)}`);
    }
    console.log(`[Notify/fast2sms] SMS sent to +91${phone} - Request ID: ${result.request_id}`);
  }

  private async sendWhatsAppCloud(phone: string, params: OrderReadyAlertParams): Promise<void> {
    const token = env.WHATSAPP_TOKEN;
    const phoneId = env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
      console.warn('[Notify] WHATSAPP_TOKEN or WHATSAPP_PHONE_ID not configured, falling back to console log');
      console.log(`[Notify/whatsapp_cloud] Would send WhatsApp to +91${phone}: ${this.formatMessage(params)}`);
      return;
    }

    const to = `91${phone}`;
    const shortOrderId = params.orderId.substring(0, 8).toUpperCase();

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: 'campus_print_order_ready',
            language: { code: 'en_IN' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: params.studentName },
                  { type: 'text', text: shortOrderId },
                  { type: 'text', text: params.centerName },
                  { type: 'text', text: params.pickupOtp },
                ],
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json() as any;
      throw new Error(`WhatsApp Cloud API error: ${JSON.stringify(err?.error || err)}`);
    }

    const result = await response.json() as any;
    console.log(`[Notify/whatsapp_cloud] WhatsApp sent to ${to} - Message ID: ${result?.messages?.[0]?.id}`);
  }
}

export const notificationService = new NotificationService();
