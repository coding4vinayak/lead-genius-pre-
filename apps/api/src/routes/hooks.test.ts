import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildInboundWebhook } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const mockExecuteAutomation = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/automation-engine.js', () => ({
  executeAutomation: (...args: unknown[]) => mockExecuteAutomation(...args),
}));

const { default: hooksRoutes } = await import('./hooks.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/hooks', hooksRoutes);
  app.use(errorHandler);
  return app;
}

describe('Hooks API (Inbound Webhook Receiver)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/hooks/:token', () => {
    it('should process a valid webhook', async () => {
      const webhook = buildInboundWebhook({ token: 'valid-token', isActive: true });
      mockPrisma.inboundWebhook.findFirst.mockResolvedValue(webhook);
      mockPrisma.event.create.mockResolvedValue({ id: 'evt_1' });

      const res = await request(createApp())
        .post('/api/hooks/valid-token')
        .send({ data: 'test payload' });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it('should return 404 for invalid token', async () => {
      mockPrisma.inboundWebhook.findFirst.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/hooks/invalid-token')
        .send({ data: 'test' });

      expect(res.status).toBe(404);
    });

    it('should return 404 for inactive webhook', async () => {
      const webhook = buildInboundWebhook({ token: 'inactive-token', isActive: false });
      mockPrisma.inboundWebhook.findFirst.mockResolvedValue(webhook);

      const res = await request(createApp())
        .post('/api/hooks/inactive-token')
        .send({ data: 'test' });

      expect(res.status).toBe(404);
    });

    it('should verify signature when secret is configured', async () => {
      const secret = 'my-webhook-secret';
      const webhook = buildInboundWebhook({ token: 'signed-token', isActive: true, secret });
      mockPrisma.inboundWebhook.findFirst.mockResolvedValue(webhook);
      mockPrisma.event.create.mockResolvedValue({ id: 'evt_1' });

      const body = { data: 'signed payload' };
      const signature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      const res = await request(createApp())
        .post('/api/hooks/signed-token')
        .set('X-Webhook-Signature', signature)
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const secret = 'my-webhook-secret';
      const webhook = buildInboundWebhook({ token: 'signed-token', isActive: true, secret });
      mockPrisma.inboundWebhook.findFirst.mockResolvedValue(webhook);

      const res = await request(createApp())
        .post('/api/hooks/signed-token')
        .set('X-Webhook-Signature', 'invalid-signature')
        .send({ data: 'test' });

      expect(res.status).toBe(401);
    });

    it('should reject missing signature when secret is configured', async () => {
      const secret = 'my-webhook-secret';
      const webhook = buildInboundWebhook({ token: 'signed-token', isActive: true, secret });
      mockPrisma.inboundWebhook.findFirst.mockResolvedValue(webhook);

      const res = await request(createApp())
        .post('/api/hooks/signed-token')
        .send({ data: 'test' });

      expect(res.status).toBe(401);
    });

    it('should trigger automation when automationId is linked', async () => {
      const webhook = buildInboundWebhook({
        token: 'auto-token',
        isActive: true,
        automationId: 'auto_1',
      });
      mockPrisma.inboundWebhook.findFirst.mockResolvedValue(webhook);
      mockPrisma.event.create.mockResolvedValue({ id: 'evt_1' });

      const res = await request(createApp())
        .post('/api/hooks/auto-token')
        .send({ data: 'trigger automation' });

      expect(res.status).toBe(200);
      expect(mockExecuteAutomation).toHaveBeenCalledWith('auto_1', {
        inboundWebhookId: webhook.id,
        body: { data: 'trigger automation' },
      });
    });
  });
});
