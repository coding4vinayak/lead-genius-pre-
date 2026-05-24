import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildInboundWebhook } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: inboundWebhookRoutes } = await import('./inbound-webhooks.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/inbound-webhooks', inboundWebhookRoutes);
  app.use(errorHandler);
  return app;
}

describe('Inbound Webhooks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/inbound-webhooks', () => {
    it('should list inbound webhooks with pagination', async () => {
      const webhooks = [buildInboundWebhook(), buildInboundWebhook()];
      mockPrisma.inboundWebhook.findMany.mockResolvedValue(webhooks);
      mockPrisma.inboundWebhook.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/inbound-webhooks?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('GET /api/inbound-webhooks/:id', () => {
    it('should return an inbound webhook', async () => {
      const webhook = buildInboundWebhook({ id: 'iwh_1' });
      mockPrisma.inboundWebhook.findUnique.mockResolvedValue(webhook);

      const res = await request(createApp()).get('/api/inbound-webhooks/iwh_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('iwh_1');
    });

    it('should return 404 for non-existent webhook', async () => {
      mockPrisma.inboundWebhook.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/inbound-webhooks/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
    });
  });

  describe('POST /api/inbound-webhooks', () => {
    it('should create an inbound webhook with generated token', async () => {
      const newWebhook = buildInboundWebhook({ id: 'iwh_new', name: 'New Hook' });
      mockPrisma.inboundWebhook.create.mockResolvedValue(newWebhook);

      const res = await request(createApp())
        .post('/api/inbound-webhooks')
        .send({ name: 'New Hook', description: 'Test hook' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Hook');
      expect(mockPrisma.inboundWebhook.create.mock.calls[0][0].data.token).toBeDefined();
    });

    it('should reject missing name', async () => {
      const res = await request(createApp())
        .post('/api/inbound-webhooks')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/inbound-webhooks/:id', () => {
    it('should update an inbound webhook', async () => {
      const updated = buildInboundWebhook({ id: 'iwh_1', name: 'Updated' });
      mockPrisma.inboundWebhook.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/inbound-webhooks/iwh_1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/inbound-webhooks/:id', () => {
    it('should delete an inbound webhook', async () => {
      mockPrisma.inboundWebhook.delete.mockResolvedValue(buildInboundWebhook({ id: 'iwh_1' }));

      const res = await request(createApp()).delete('/api/inbound-webhooks/iwh_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('iwh_1');
    });
  });
});
