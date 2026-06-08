import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../services/lead-scoring.js', () => ({
  scoreLead: vi.fn(),
  scoreAllLeads: vi.fn(),
  getLeadScoreFactors: vi.fn(),
}));

const { default: scoringRoutes } = await import('./scoring.js');
const { scoreLead, scoreAllLeads, getLeadScoreFactors } = await import('../services/lead-scoring.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/scoring', scoringRoutes);
  app.use(errorHandler);
  return app;
}

describe('Scoring API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/scoring/score/:leadId', () => {
    it('should score a single lead', async () => {
      vi.mocked(scoreLead).mockResolvedValue(75);
      mockPrisma.lead.findUnique.mockResolvedValue({ id: 'lead_1' });

      const res = await request(createApp()).post('/api/scoring/score/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBe(75);
    });

    it('should return 404 for non-existent lead', async () => {
      vi.mocked(scoreLead).mockResolvedValue(0);
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/scoring/score/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/scoring/score-batch', () => {
    it('should score multiple leads', async () => {
      vi.mocked(scoreLead).mockResolvedValue(50);

      const res = await request(createApp())
        .post('/api/scoring/score-batch')
        .send({ leadIds: ['lead_1', 'lead_2'] });

      expect(res.status).toBe(200);
      expect(res.body.data.scored).toBe(2);
      expect(scoreLead).toHaveBeenCalledTimes(2);
    });

    it('should return 400 without leadIds', async () => {
      const res = await request(createApp())
        .post('/api/scoring/score-batch')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for too many leads', async () => {
      const res = await request(createApp())
        .post('/api/scoring/score-batch')
        .send({ leadIds: Array(501).fill('x') });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/scoring/rescore-all', () => {
    it('should rescore all leads', async () => {
      vi.mocked(scoreAllLeads).mockResolvedValue(10);

      const res = await request(createApp()).post('/api/scoring/rescore-all');

      expect(res.status).toBe(200);
      expect(res.body.data.scored).toBe(10);
    });
  });

  describe('GET /api/scoring/factors/:leadId', () => {
    it('should return score factors', async () => {
      vi.mocked(getLeadScoreFactors).mockResolvedValue({
        score: 75,
        factors: { completeness: 25, engagement: 20, stage: 15, source: 8, recency: 7 },
      });

      const res = await request(createApp()).get('/api/scoring/factors/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBe(75);
      expect(res.body.data.factors.completeness).toBe(25);
    });

    it('should return 404 for non-existent lead', async () => {
      vi.mocked(getLeadScoreFactors).mockResolvedValue(null);

      const res = await request(createApp()).get('/api/scoring/factors/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/scoring/segments', () => {
    it('should return segment counts', async () => {
      mockPrisma.lead.count.mockResolvedValueOnce(5).mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8).mockResolvedValueOnce(3).mockResolvedValueOnce(2);

      const res = await request(createApp()).get('/api/scoring/segments');

      expect(res.status).toBe(200);
      expect(res.body.data.segments).toHaveLength(5);
      expect(res.body.data.total).toBe(28);
      expect(res.body.data.segments[0].label).toBe('Hot');
      expect(res.body.data.segments[0].count).toBe(5);
      expect(res.body.data.segments[4].label).toBe('Unscored');
      expect(res.body.data.segments[4].count).toBe(2);
    });
  });
});
