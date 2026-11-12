import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notificationService } from './notification.service.js';

describe('Notification Service Tests', () => {
  it('sends order ready alert without throwing errors in console mode', async () => {
    // Should never throw, even with various phone formats
    await assert.doesNotReject(async () => {
      await notificationService.sendOrderReadyAlert({
        phone: '9876543210',
        studentName: 'Rohan Sharma',
        orderId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        pickupOtp: '4821',
        centerName: 'Central Library Print Station',
      });
    });
  });

  it('gracefully handles missing or non-standard phone numbers', async () => {
    await assert.doesNotReject(async () => {
      await notificationService.sendOrderReadyAlert({
        phone: '+91 99887-76655',
        studentName: 'Priya Patel',
        orderId: '12345678-0000-0000-0000-000000000000',
        pickupOtp: '1122',
        centerName: 'Tech Block Xerox',
      });
    });
  });
});

