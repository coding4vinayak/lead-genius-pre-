import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSendTimePreference, buildMessage } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: sendOptimizationRoutes } = await import('./send-optimization.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/send-optimization', sendOptimizationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Send Optimization API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/send-optimization/lead/:leadId', () => {
    it('should return optimal send time for a lead', async () => {
      const pref = buildSendTimePreference({ preferredHour: 14, preferredDay: 3, dataPoints: 12 });
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(pref);

      const res = await request(createApp()).get('/api/send-optimization/lead/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.hour).toBe(14);
      expect(res.body.data.day).toBe(3);
      expect(res.body.data.confidence).toBe('high');
    });

    it('should return default when no data exists', async () => {
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/send-optimization/lead/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.confidence).toBe('low');
    });
  });

  describe('GET /api/send-optimization/timezone/:tz', () => {
    it('should return optimal time for a timezone', async () => {
      const prefs = [
        buildSendTimePreference({ preferredHour: 9, preferredDay: 1 }),
        buildSendTimePreference({ preferredHour: 11, preferredDay: 3 }),
      ];
      mockPrisma.sendTimePreference.findMany.mockResolvedValue(prefs);

      const res = await request(createApp()).get('/api/send-optimization/timezone/America%2FNew_York');

      expect(res.status).toBe(200);
      expect(res.body.data.hour).toBe(10);
      expect(res.body.data.timezone).toBe('America/New_York');
    });

    it('should return defaults for unknown timezone', async () => {
      mockPrisma.sendTimePreference.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/send-optimization/timezone/Unknown');

      expect(res.status).toBe(200);
      expect(res.body.data.confidence).toBe('low');
    });
  });

  describe('POST /api/send-optimization/schedule', () => {
    it('should schedule a message at optimal time', async () => {
      const message = buildMessage();
      mockPrisma.message.findUnique.mockResolvedValue(message);
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(
        buildSendTimePreference({ preferredHour: 10, preferredDay: 2, dataPoints: 10 })
      );

      const res = await request(createApp())
        .post('/api/send-optimization/schedule')
        .send({ messageId: message.id, leadId: 'lead_1' });

      expect(res.status).toBe(200);
      expect(res.body.data.messageId).toBe(message.id);
      expect(res.body.data.scheduledFor).toBeDefined();
    });

    it('should reject missing messageId', async () => {
      const res = await request(createApp())
        .post('/api/send-optimization/schedule')
        .send({ leadId: 'lead_1' });

      expect(res.status).toBe(400);
    });

    it('should reject missing leadId', async () => {
      const res = await request(createApp())
        .post('/api/send-optimization/schedule')
        .send({ messageId: 'msg_1' });

      expect(res.status).toBe(400);
    });
  });
});
