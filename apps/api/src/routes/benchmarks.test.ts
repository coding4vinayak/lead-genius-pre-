import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildPerformanceBenchmark } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: benchmarkRoutes } = await import('./benchmarks.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/benchmarks', benchmarkRoutes);
  app.use(errorHandler);
  return app;
}

describe('Benchmarks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/benchmarks', () => {
    it('should return existing benchmarks', async () => {
      const benchmarks = [buildPerformanceBenchmark(), buildPerformanceBenchmark()];
      mockPrisma.performanceBenchmark.findMany.mockResolvedValue(benchmarks);

      const res = await request(createApp()).get('/api/benchmarks');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should calculate fresh benchmarks when none exist', async () => {
      mockPrisma.performanceBenchmark.findMany.mockResolvedValue([]);
      mockPrisma.message.count
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(800)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(50);
      mockPrisma.performanceBenchmark.create.mockResolvedValue(buildPerformanceBenchmark());

      const res = await request(createApp()).get('/api/benchmarks');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
    });
  });

  describe('GET /api/benchmarks/suggestions', () => {
    it('should return suggestions based on benchmarks', async () => {
      const benchmarks = [
        buildPerformanceBenchmark({ suggestions: ['Try A/B testing'] }),
        buildPerformanceBenchmark({ suggestions: ['Verify emails'] }),
      ];
      mockPrisma.performanceBenchmark.findMany.mockResolvedValue(benchmarks);

      const res = await request(createApp()).get('/api/benchmarks/suggestions');

      expect(res.status).toBe(200);
      expect(res.body.data.suggestions).toContain('Try A/B testing');
      expect(res.body.data.suggestions).toContain('Verify emails');
    });

    it('should return default suggestions when no benchmarks', async () => {
      mockPrisma.performanceBenchmark.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/benchmarks/suggestions');

      expect(res.status).toBe(200);
      expect(res.body.data.suggestions.length).toBeGreaterThan(0);
    });
  });
});
