import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWebhookDelivery, buildWebhookSubscription } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { deliverWebhook, createDelivery } = await import('./webhook-delivery.js');

describe('Webhook Delivery Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deliverWebhook', () => {
    it('should successfully deliver a webhook', async () => {
      const webhook = buildWebhookSubscription({ id: 'wh_1', url: 'https://example.com/hook' });
      const delivery = {
        ...buildWebhookDelivery({ id: 'whd_1', webhookId: 'wh_1', payload: { test: true } }),
        webhook,
      };
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery);
      mockPrisma.webhookDelivery.update.mockResolvedValue({});

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      await deliverWebhook('whd_1');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/hook', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ test: true }),
      }));

      expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'whd_1' },
          data: expect.objectContaining({ status: 'delivered', responseStatus: 200 }),
        }),
      );
    });

    it('should handle failed delivery with retry', async () => {
      const webhook = buildWebhookSubscription({ id: 'wh_1', url: 'https://example.com/hook' });
      const delivery = {
        ...buildWebhookDelivery({ id: 'whd_1', webhookId: 'wh_1', attempts: 0, maxAttempts: 5, payload: {} }),
        webhook,
      };
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery);
      mockPrisma.webhookDelivery.update.mockResolvedValue({});

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await deliverWebhook('whd_1');

      expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'whd_1' },
          data: expect.objectContaining({
            status: 'pending',
            attempts: 1,
            responseStatus: 500,
            nextRetryAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should mark as failed when max attempts reached', async () => {
      const webhook = buildWebhookSubscription({ id: 'wh_1', url: 'https://example.com/hook' });
      const delivery = {
        ...buildWebhookDelivery({ id: 'whd_1', webhookId: 'wh_1', attempts: 4, maxAttempts: 5, payload: {} }),
        webhook,
      };
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery);
      mockPrisma.webhookDelivery.update.mockResolvedValue({});

      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      await deliverWebhook('whd_1');

      expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'whd_1' },
          data: expect.objectContaining({
            status: 'failed',
            attempts: 5,
          }),
        }),
      );
    });

    it('should include HMAC signature when secret is configured', async () => {
      const secret = 'test-secret';
      const webhook = buildWebhookSubscription({ id: 'wh_1', url: 'https://example.com/hook', secret });
      const payload = { event: 'lead.created', data: { id: 'lead_1' } };
      const delivery = {
        ...buildWebhookDelivery({ id: 'whd_1', webhookId: 'wh_1', payload }),
        webhook,
      };
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery);
      mockPrisma.webhookDelivery.update.mockResolvedValue({});

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      await deliverWebhook('whd_1');

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers['X-Webhook-Signature']).toBe(expectedSignature);
    });

    it('should handle network errors with retry', async () => {
      const webhook = buildWebhookSubscription({ id: 'wh_1', url: 'https://example.com/hook' });
      const delivery = {
        ...buildWebhookDelivery({ id: 'whd_1', webhookId: 'wh_1', attempts: 1, maxAttempts: 5, payload: {} }),
        webhook,
      };
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery);
      mockPrisma.webhookDelivery.update.mockResolvedValue({});

      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await deliverWebhook('whd_1');

      expect(mockPrisma.webhookDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'whd_1' },
          data: expect.objectContaining({
            status: 'pending',
            attempts: 2,
            responseStatus: null,
            responseBody: 'Connection refused',
          }),
        }),
      );
    });

    it('should return early if delivery not found', async () => {
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(null);

      await deliverWebhook('nonexistent');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('createDelivery', () => {
    it('should create a delivery record and queue it', async () => {
      const delivery = buildWebhookDelivery({ id: 'whd_new' });
      mockPrisma.webhookDelivery.create.mockResolvedValue(delivery);

      await createDelivery('wh_1', 'lead.created', { leadId: 'lead_1' });

      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          webhookId: 'wh_1',
          event: 'lead.created',
          payload: { leadId: 'lead_1' },
          status: 'pending',
          attempts: 0,
          maxAttempts: 5,
        }),
      });
    });
  });
});
