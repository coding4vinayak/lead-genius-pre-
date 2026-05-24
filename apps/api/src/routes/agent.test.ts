import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildAgentSettings } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: agentRoutes } = await import('./agent.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/agent', agentRoutes);
  app.use(errorHandler);
  return app;
}

describe('Agent Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/agent', () => {
    it('should return existing agent settings', async () => {
      mockPrisma.agentSettings.findUnique.mockResolvedValue(buildAgentSettings());

      const res = await request(createApp()).get('/api/agent');

      expect(res.status).toBe(200);
      expect(res.body.data.aiProvider).toBe('openai');
      expect(res.body.data.tone).toBe('professional');
    });

    it('should create default settings when none exist', async () => {
      mockPrisma.agentSettings.findUnique.mockResolvedValue(null);
      mockPrisma.agentSettings.create.mockResolvedValue(buildAgentSettings());

      const res = await request(createApp()).get('/api/agent');

      expect(res.status).toBe(200);
      expect(res.body.data.aiProvider).toBe('openai');
    });
  });

  describe('PUT /api/agent', () => {
    it('should update agent settings', async () => {
      const updated = buildAgentSettings({ tone: 'friendly', autoReplyThreshold: 85 });
      mockPrisma.agentSettings.upsert.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/agent')
        .send({ tone: 'friendly', autoReplyThreshold: 85 });

      expect(res.status).toBe(200);
      expect(res.body.data.tone).toBe('friendly');
      expect(res.body.data.autoReplyThreshold).toBe(85);
    });

    it('should reject invalid threshold', async () => {
      const res = await request(createApp())
        .put('/api/agent')
        .send({ autoReplyThreshold: 150 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/agent/toggle-autopilot', () => {
    it('should toggle autopilot from off to on', async () => {
      mockPrisma.agentSettings.findUnique.mockResolvedValue(
        buildAgentSettings({ isAutoPilotActive: false }),
      );
      mockPrisma.agentSettings.update.mockResolvedValue(
        buildAgentSettings({ isAutoPilotActive: true }),
      );

      const res = await request(createApp()).post('/api/agent/toggle-autopilot');

      expect(res.status).toBe(200);
      expect(res.body.data.isAutoPilotActive).toBe(true);
    });

    it('should toggle autopilot from on to off', async () => {
      mockPrisma.agentSettings.findUnique.mockResolvedValue(
        buildAgentSettings({ isAutoPilotActive: true }),
      );
      mockPrisma.agentSettings.update.mockResolvedValue(
        buildAgentSettings({ isAutoPilotActive: false }),
      );

      const res = await request(createApp()).post('/api/agent/toggle-autopilot');

      expect(res.status).toBe(200);
      expect(res.body.data.isAutoPilotActive).toBe(false);
    });

    it('should return 404 when settings not found', async () => {
      mockPrisma.agentSettings.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/agent/toggle-autopilot');

      expect(res.status).toBe(404);
    });
  });
});
