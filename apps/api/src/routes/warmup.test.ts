import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWarmupSchedule, buildWarmupLog } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

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

  describe('GET /api/warmup', () => {
    it('should list warmup schedules with pagination', async () => {
      const schedules = [buildWarmupSchedule(), buildWarmupSchedule()];
      mockPrisma.warmupSchedule.findMany.mockResolvedValue(schedules);
      mockPrisma.warmupSchedule.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/warmup?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
    });

    it('should use default pagination', async () => {
      mockPrisma.warmupSchedule.findMany.mockResolvedValue([]);
      mockPrisma.warmupSchedule.count.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/warmup');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/warmup', () => {
    it('should create a warmup schedule', async () => {
      const schedule = buildWarmupSchedule();
      mockPrisma.warmupSchedule.create.mockResolvedValue(schedule);

      const res = await request(createApp())
        .post('/api/warmup')
        .send({ accountEmail: 'sender@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.data.accountEmail).toBe('sender@example.com');
    });

    it('should accept custom config', async () => {
      const schedule = buildWarmupSchedule({ maxDailyLimit: 100 });
      mockPrisma.warmupSchedule.create.mockResolvedValue(schedule);

      const res = await request(createApp())
        .post('/api/warmup')
        .send({ accountEmail: 'sender@example.com', maxDailyLimit: 100, rampPercentage: 30, bounceThreshold: 10 });

      expect(res.status).toBe(201);
    });

    it('should reject invalid email', async () => {
      const res = await request(createApp())
        .post('/api/warmup')
        .send({ accountEmail: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('should reject missing accountEmail', async () => {
      const res = await request(createApp())
        .post('/api/warmup')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/warmup/:id', () => {
    it('should return warmup schedule with progress', async () => {
      const schedule = { ...buildWarmupSchedule(), logs: [buildWarmupLog()] };
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);

      const res = await request(createApp()).get(`/api/warmup/${schedule.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(schedule.id);
    });

    it('should return 404 for non-existent schedule', async () => {
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/warmup/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/warmup/:id', () => {
    it('should update warmup config', async () => {
      const schedule = buildWarmupSchedule();
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupSchedule.update.mockResolvedValue({ ...schedule, maxDailyLimit: 100 });

      const res = await request(createApp())
        .put(`/api/warmup/${schedule.id}`)
        .send({ maxDailyLimit: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.maxDailyLimit).toBe(100);
    });

    it('should return 404 for non-existent schedule', async () => {
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/warmup/nonexistent')
        .send({ maxDailyLimit: 100 });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/warmup/:id/pause', () => {
    it('should pause a warming schedule', async () => {
      const schedule = buildWarmupSchedule({ status: 'warming' });
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupSchedule.update.mockResolvedValue({ ...schedule, status: 'paused', pausedReason: 'manual' });

      const res = await request(createApp()).post(`/api/warmup/${schedule.id}/pause`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paused');
    });

    it('should return 404 for non-existent schedule', async () => {
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/warmup/nonexistent/pause');

      expect(res.status).toBe(404);
    });

    it('should reject pausing a completed schedule', async () => {
      const schedule = buildWarmupSchedule({ status: 'completed' });
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);

      const res = await request(createApp()).post(`/api/warmup/${schedule.id}/pause`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/warmup/:id/resume', () => {
    it('should resume a paused schedule', async () => {
      const schedule = buildWarmupSchedule({ status: 'paused' });
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupSchedule.update.mockResolvedValue({ ...schedule, status: 'warming', pausedReason: null });

      const res = await request(createApp()).post(`/api/warmup/${schedule.id}/resume`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('warming');
    });

    it('should return 404 for non-existent schedule', async () => {
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/warmup/nonexistent/resume');

      expect(res.status).toBe(404);
    });

    it('should reject resuming a non-paused schedule', async () => {
      const schedule = buildWarmupSchedule({ status: 'warming' });
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);

      const res = await request(createApp()).post(`/api/warmup/${schedule.id}/resume`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/warmup/:id/logs', () => {
    it('should return warmup logs for a schedule', async () => {
      const schedule = buildWarmupSchedule();
      const logs = [buildWarmupLog({ day: 1 }), buildWarmupLog({ day: 2 })];
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupLog.findMany.mockResolvedValue(logs);

      const res = await request(createApp()).get(`/api/warmup/${schedule.id}/logs`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 404 for non-existent schedule', async () => {
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/warmup/nonexistent/logs');

      expect(res.status).toBe(404);
    });
  });
});
