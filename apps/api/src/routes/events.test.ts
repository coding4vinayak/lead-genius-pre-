import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildEvent } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: eventRoutes } = await import('./events.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/events', eventRoutes);
  app.use(errorHandler);
  return app;
}

describe('Events API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/events', () => {
    it('should list events with pagination', async () => {
      const events = [buildEvent(), buildEvent()];
      mockPrisma.event.findMany.mockResolvedValue(events);
      mockPrisma.event.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/events?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
    });

    it('should filter by type', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      await request(createApp()).get('/api/events?type=lead.created&page=1&pageSize=10');

      expect(mockPrisma.event.findMany.mock.calls[0][0].where.type).toBe('lead.created');
    });

    it('should filter by entityType and entityId', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      await request(createApp()).get('/api/events?entityType=lead&entityId=lead_1&page=1&pageSize=10');

      const where = mockPrisma.event.findMany.mock.calls[0][0].where;
      expect(where.entityType).toBe('lead');
      expect(where.entityId).toBe('lead_1');
    });

    it('should filter by date range', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      const from = '2025-01-01T00:00:00Z';
      const to = '2025-01-31T23:59:59Z';
      await request(createApp()).get(`/api/events?from=${from}&to=${to}&page=1&pageSize=10`);

      const where = mockPrisma.event.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date(from));
      expect(where.createdAt.lte).toEqual(new Date(to));
    });

    it('should filter with only from date', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      const from = '2025-01-01T00:00:00Z';
      await request(createApp()).get(`/api/events?from=${from}&page=1&pageSize=10`);

      const where = mockPrisma.event.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date(from));
      expect(where.createdAt.lte).toBeUndefined();
    });

    it('should use default pagination values', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      await request(createApp()).get('/api/events');

      expect(mockPrisma.event.count).toHaveBeenCalledOnce();
    });
  });

  describe('GET /api/events/:id', () => {
    it('should return an event by id', async () => {
      const event = buildEvent({ id: 'evt_1', type: 'task.completed', payload: { taskId: 'task_1' } });
      mockPrisma.event.findUnique.mockResolvedValue(event);

      const res = await request(createApp()).get('/api/events/evt_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('evt_1');
      expect(res.body.data.type).toBe('task.completed');
      expect(res.body.data.payload).toEqual({ taskId: 'task_1' });
    });

    it('should return 404 for non-existent event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/events/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
      expect(res.body.error.message).toBe('Event not found');
    });
  });
});
