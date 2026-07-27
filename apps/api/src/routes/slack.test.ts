import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildIntegration, buildSlackNotification } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: slackRoutes } = await import('./slack.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/slack', slackRoutes);
  app.use(errorHandler);
  return app;
}

describe('Slack API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/slack/connect', () => {
    it('should connect Slack integration', async () => {
      const integration = buildIntegration({ type: 'slack' });
      mockPrisma.integration.create.mockResolvedValue(integration);

      const res = await request(createApp())
        .post('/api/slack/connect')
        .send({ code: 'oauth_code_123' });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('slack');
    });

    it('should reject missing code', async () => {
      const res = await request(createApp())
        .post('/api/slack/connect')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/slack/channels', () => {
    it('should return available channels', async () => {
      const integration = buildIntegration({ type: 'slack' });
      mockPrisma.integration.findUnique.mockResolvedValue(integration);

      const res = await request(createApp())
        .get('/api/slack/channels?integrationId=' + integration.id);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should require integrationId', async () => {
      const res = await request(createApp())
        .get('/api/slack/channels');

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent integration', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .get('/api/slack/channels?integrationId=nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/slack/notifications', () => {
    it('should configure notifications', async () => {
      const integration = buildIntegration({ type: 'slack' });
      const notification = buildSlackNotification({ integrationId: integration.id });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.slackNotification.findFirst.mockResolvedValue(null);
      mockPrisma.slackNotification.create.mockResolvedValue(notification);

      const res = await request(createApp())
        .put('/api/slack/notifications')
        .send({
          integrationId: integration.id,
          channel: '#sales',
          eventTypes: ['lead.created'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should reject missing required fields', async () => {
      const res = await request(createApp())
        .put('/api/slack/notifications')
        .send({ integrationId: 'int_1' });

      expect(res.status).toBe(400);
    });

    it('should reject empty eventTypes', async () => {
      const res = await request(createApp())
        .put('/api/slack/notifications')
        .send({ integrationId: 'int_1', channel: '#sales', eventTypes: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/slack/test', () => {
    it('should send test notification', async () => {
      const integration = buildIntegration({ type: 'slack' });
      mockPrisma.integration.findUnique.mockResolvedValue(integration);

      const res = await request(createApp())
        .post('/api/slack/test')
        .send({ integrationId: integration.id });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('should reject missing integrationId', async () => {
      const res = await request(createApp())
        .post('/api/slack/test')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent integration', async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/slack/test')
        .send({ integrationId: 'nonexistent' });

      expect(res.status).toBe(404);
    });
  });
});
