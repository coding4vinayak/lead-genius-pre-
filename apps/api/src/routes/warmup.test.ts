import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../services/webhook-delivery.js', () => ({ dispatchWebhookEvent: vi.fn() }));
vi.mock('../services/warmup.js', () => ({
  scheduleNextWarmupStep: vi.fn().mockResolvedValue(undefined),
  executeWarmupStep: vi.fn().mockResolvedValue({ steps: 1 }),
}));

const { default: warmupRoutes } = await import('./warmup.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/warmup', warmupRoutes);
  app.use(errorHandler);
  return app;
}

describe('Warmup API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/warmup/settings', () => {
    it('should return existing settings', async () => {
      mockPrisma.warmupSettings.findUnique.mockResolvedValue({
        id: 'global',
        enabled: true,
        maxActiveWarmups: 20,
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        minDelayMinutes: 720,
        maxDelayMinutes: 2880,
      });

      const res = await request(createApp()).get('/api/warmup/settings');

      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.maxActiveWarmups).toBe(20);
    });

    it('should create default settings if none exist', async () => {
      mockPrisma.warmupSettings.findUnique.mockResolvedValue(null);
      mockPrisma.warmupSettings.create.mockResolvedValue({
        id: 'global',
        enabled: false,
        maxActiveWarmups: 20,
      } as any);

      const res = await request(createApp()).get('/api/warmup/settings');

      expect(res.status).toBe(200);
      expect(mockPrisma.warmupSettings.create).toHaveBeenCalledWith({ data: { id: 'global' } });
    });
  });

  describe('PUT /api/warmup/settings', () => {
    it('should upsert settings', async () => {
      mockPrisma.warmupSettings.upsert.mockResolvedValue({
        id: 'global',
        enabled: true,
        maxActiveWarmups: 10,
      });

      const res = await request(createApp())
        .put('/api/warmup/settings')
        .send({ enabled: true, maxActiveWarmups: 10 });

      expect(res.status).toBe(200);
      expect(mockPrisma.warmupSettings.upsert).toHaveBeenCalled();
      expect(mockPrisma.leadTimeline.create).toHaveBeenCalled();
    });

    it('should return 400 for invalid body', async () => {
      const res = await request(createApp())
        .put('/api/warmup/settings')
        .send({ enabled: 'yes' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/warmup/start', () => {
    it('should start warming leads', async () => {
      mockPrisma.warmupSettings.findUnique.mockResolvedValue({
        id: 'global',
        enabled: true,
        maxActiveWarmups: 20,
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        minDelayMinutes: 720,
        maxDelayMinutes: 2880,
      });
      mockPrisma.lead.count.mockResolvedValue(0);
      mockPrisma.lead.findMany.mockResolvedValue([
        {
          id: 'lead_1',
          email: 'test@example.com',
          linkedinUrl: null,
          warmupActive: false,
        },
      ]);
      mockPrisma.lead.update.mockResolvedValue({} as any);

      const res = await request(createApp())
        .post('/api/warmup/start')
        .send({ leadIds: ['lead_1'] });

      expect(res.status).toBe(200);
      expect(res.body.data.started).toBe(1);
    });

    it('should return 400 if warmup is disabled', async () => {
      mockPrisma.warmupSettings.findUnique.mockResolvedValue({
        id: 'global',
        enabled: false,
        maxActiveWarmups: 20,
      });

      const res = await request(createApp())
        .post('/api/warmup/start')
        .send({ leadIds: ['lead_1'] });

      expect(res.status).toBe(400);
    });

    it('should return 404 if no leads found', async () => {
      mockPrisma.warmupSettings.findUnique.mockResolvedValue({
        id: 'global',
        enabled: true,
        maxActiveWarmups: 20,
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        minDelayMinutes: 720,
        maxDelayMinutes: 2880,
      });
      mockPrisma.lead.count.mockResolvedValue(0);
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/warmup/start')
        .send({ leadIds: ['lead_none'] });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/warmup/stop', () => {
    it('should stop warming leads', async () => {
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 2 });

      const res = await request(createApp())
        .post('/api/warmup/stop')
        .send({ leadIds: ['lead_1', 'lead_2'] });

      expect(res.status).toBe(200);
      expect(res.body.data.stopped).toBe(2);
      expect(mockPrisma.leadTimeline.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/warmup/active', () => {
    it('should return active warming leads', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        { id: 'lead_1', name: 'John', warmupActive: true, warmupStep: 3 },
      ]);

      const res = await request(createApp()).get('/api/warmup/active');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockPrisma.lead.findMany.mock.calls[0][0].where.warmupActive).toBe(true);
    });
  });

  describe('GET /api/warmup/tasks', () => {
    it('should return all warmup tasks', async () => {
      mockPrisma.warmupTask.findMany.mockResolvedValue([
        { id: 'task_1', leadId: 'lead_1', step: 1, status: 'completed' },
      ]);

      const res = await request(createApp()).get('/api/warmup/tasks');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter tasks by leadId', async () => {
      mockPrisma.warmupTask.findMany.mockResolvedValue([]);

      await request(createApp()).get('/api/warmup/tasks?leadId=lead_1');

      expect(mockPrisma.warmupTask.findMany.mock.calls[0][0].where.leadId).toBe('lead_1');
    });
  });
});
