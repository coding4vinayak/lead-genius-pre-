import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWebhookSubscription, buildWebhookDelivery } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: webhookSubscriptionRoutes } = await import('./webhook-subscriptions.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhook-subscriptions', webhookSubscriptionRoutes);
  app.use(errorHandler);
  return app;
}

describe('Webhook Subscriptions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/webhook-subscriptions', () => {
    it('should list webhook subscriptions with pagination', async () => {
      const subscriptions = [buildWebhookSubscription(), buildWebhookSubscription()];
      mockPrisma.webhookSubscription.findMany.mockResolvedValue(subscriptions);
      mockPrisma.webhookSubscription.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/webhook-subscriptions?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('GET /api/webhook-subscriptions/:id', () => {
    it('should return a webhook subscription with recent deliveries', async () => {
      const subscription = { ...buildWebhookSubscription({ id: 'wh_1' }), deliveries: [] };
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(subscription);

      const res = await request(createApp()).get('/api/webhook-subscriptions/wh_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('wh_1');
    });

    it('should return 404 for non-existent subscription', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/webhook-subscriptions/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
    });
  });

  describe('POST /api/webhook-subscriptions', () => {
    it('should create a webhook subscription', async () => {
      const newSub = buildWebhookSubscription({ id: 'wh_new', name: 'New Webhook' });
      mockPrisma.webhookSubscription.create.mockResolvedValue(newSub);

      const res = await request(createApp())
        .post('/api/webhook-subscriptions')
        .send({
          name: 'New Webhook',
          url: 'https://example.com/webhook',
          events: ['lead.created'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Webhook');
    });

    it('should reject missing required fields', async () => {
      const res = await request(createApp())
        .post('/api/webhook-subscriptions')
        .send({ name: 'Incomplete' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/webhook-subscriptions/:id', () => {
    it('should update a webhook subscription', async () => {
      const updated = buildWebhookSubscription({ id: 'wh_1', name: 'Updated' });
      mockPrisma.webhookSubscription.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/webhook-subscriptions/wh_1')
        .send({
          name: 'Updated',
          url: 'https://example.com/webhook',
          events: ['lead.created'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/webhook-subscriptions/:id', () => {
    it('should delete a webhook subscription', async () => {
      mockPrisma.webhookSubscription.delete.mockResolvedValue(buildWebhookSubscription({ id: 'wh_1' }));

      const res = await request(createApp()).delete('/api/webhook-subscriptions/wh_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('wh_1');
    });
  });

  describe('POST /api/webhook-subscriptions/:id/activate', () => {
    it('should activate a webhook subscription', async () => {
      const activated = buildWebhookSubscription({ id: 'wh_1', isActive: true });
      mockPrisma.webhookSubscription.update.mockResolvedValue(activated);

      const res = await request(createApp()).post('/api/webhook-subscriptions/wh_1/activate');

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });
  });

  describe('POST /api/webhook-subscriptions/:id/deactivate', () => {
    it('should deactivate a webhook subscription', async () => {
      const deactivated = buildWebhookSubscription({ id: 'wh_1', isActive: false });
      mockPrisma.webhookSubscription.update.mockResolvedValue(deactivated);

      const res = await request(createApp()).post('/api/webhook-subscriptions/wh_1/deactivate');

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('GET /api/webhook-subscriptions/:id/deliveries', () => {
    it('should list deliveries for a subscription', async () => {
      const deliveries = [buildWebhookDelivery(), buildWebhookDelivery()];
      mockPrisma.webhookDelivery.findMany.mockResolvedValue(deliveries);
      mockPrisma.webhookDelivery.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/webhook-subscriptions/wh_1/deliveries?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/webhook-subscriptions/:id/test', () => {
    it('should queue a test delivery', async () => {
      const webhook = buildWebhookSubscription({ id: 'wh_1' });
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(webhook);
      mockPrisma.webhookDelivery.create.mockResolvedValue(buildWebhookDelivery());

      const res = await request(createApp()).post('/api/webhook-subscriptions/wh_1/test');

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Test');
    });

    it('should return 404 for non-existent subscription', async () => {
      mockPrisma.webhookSubscription.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/webhook-subscriptions/nonexistent/test');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/webhook-subscriptions/:id/deliveries/:deliveryId/retry', () => {
    it('should retry a failed delivery', async () => {
      const delivery = buildWebhookDelivery({ id: 'whd_1', webhookId: 'wh_1', status: 'failed' });
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(delivery);
      mockPrisma.webhookDelivery.update.mockResolvedValue({ ...delivery, status: 'pending', attempts: 0 });

      const res = await request(createApp()).post('/api/webhook-subscriptions/wh_1/deliveries/whd_1/retry');

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('retry');
    });

    it('should return 404 for non-existent delivery', async () => {
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/webhook-subscriptions/wh_1/deliveries/nonexistent/retry');

      expect(res.status).toBe(404);
    });
  });
});
