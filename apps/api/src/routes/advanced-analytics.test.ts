import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSequence, buildSequenceEnrollment, buildLead } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: advancedAnalyticsRoutes } = await import('./advanced-analytics.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics/advanced', advancedAnalyticsRoutes);
  app.use(errorHandler);
  return app;
}

describe('Advanced Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/analytics/advanced/funnel/:sequenceId', () => {
    it('should return funnel data', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(10);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.message.count
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(15);
      mockPrisma.sequenceEnrollment.count.mockResolvedValueOnce(30);

      const res = await request(createApp()).get(`/api/analytics/advanced/funnel/${sequence.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.funnel.enrolled).toBe(100);
      expect(res.body.data.rates).toBeDefined();
    });

    it('should return 404 for nonexistent sequence', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/analytics/advanced/funnel/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/analytics/advanced/cohorts/:sequenceId', () => {
    it('should return cohort analysis', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ createdAt: new Date('2025-01-06T00:00:00Z'), status: 'completed' }),
        buildSequenceEnrollment({ createdAt: new Date('2025-01-13T00:00:00Z'), status: 'active' }),
      ]);

      const res = await request(createApp()).get(`/api/analytics/advanced/cohorts/${sequence.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cohorts.length).toBeGreaterThan(0);
    });

    it('should support month period', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ createdAt: new Date('2025-01-15T00:00:00Z'), status: 'completed' }),
      ]);

      const res = await request(createApp()).get(`/api/analytics/advanced/cohorts/${sequence.id}?period=month`);

      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('month');
    });
  });

  describe('GET /api/analytics/advanced/revenue/:sequenceId', () => {
    it('should return revenue attribution', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ leadId: 'lead_1' }),
      ]);
      mockPrisma.lead.findMany.mockResolvedValue([
        buildLead({ id: 'lead_1', enrichmentData: { dealValue: 5000 } }),
      ]);

      const res = await request(createApp()).get(`/api/analytics/advanced/revenue/${sequence.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRevenue).toBe(5000);
      expect(res.body.data.attributedDeals).toBe(1);
    });
  });

  describe('GET /api/analytics/advanced/export', () => {
    it('should export funnel data as CSV', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.message.count
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(8);
      mockPrisma.sequenceEnrollment.count.mockResolvedValueOnce(20);

      const res = await request(createApp())
        .get(`/api/analytics/advanced/export?type=funnel&sequenceId=${sequence.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Stage,Count,Rate (%)');
    });

    it('should reject missing type', async () => {
      const res = await request(createApp()).get('/api/analytics/advanced/export');

      expect(res.status).toBe(400);
    });
  });
});
