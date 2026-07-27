import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildAbTest, buildAbTestVariant } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: abTestRoutes } = await import('./ab-tests.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ab-tests', abTestRoutes);
  app.use(errorHandler);
  return app;
}

describe('A/B Tests API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/ab-tests', () => {
    it('should list tests with pagination', async () => {
      const tests = [buildAbTest(), buildAbTest()];
      mockPrisma.abTest.findMany.mockResolvedValue(tests);
      mockPrisma.abTest.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/ab-tests?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
    });
  });

  describe('POST /api/ab-tests', () => {
    it('should create an A/B test', async () => {
      const test = buildAbTest();
      const variants = [buildAbTestVariant({ name: 'A' }), buildAbTestVariant({ name: 'B' })];
      mockPrisma.abTest.create.mockResolvedValue({ ...test, variants });

      const res = await request(createApp())
        .post('/api/ab-tests')
        .send({
          sequenceStepId: 'seqstep_1',
          name: 'Subject Test',
          variants: [
            { name: 'A', subject: 'Hello', weight: 50 },
            { name: 'B', subject: 'Hi there', weight: 50 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.variants).toHaveLength(2);
    });

    it('should reject missing fields', async () => {
      const res = await request(createApp())
        .post('/api/ab-tests')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should reject less than 2 variants', async () => {
      const res = await request(createApp())
        .post('/api/ab-tests')
        .send({
          sequenceStepId: 'seqstep_1',
          name: 'Test',
          variants: [{ name: 'Only One' }],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/ab-tests/:id', () => {
    it('should return a test by id', async () => {
      const test = buildAbTest();
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [] });

      const res = await request(createApp()).get(`/api/ab-tests/${test.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(test.id);
    });

    it('should return 404 for nonexistent test', async () => {
      mockPrisma.abTest.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/ab-tests/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/ab-tests/:id/start', () => {
    it('should start a test', async () => {
      const test = buildAbTest({ status: 'draft' });
      const variants = [buildAbTestVariant(), buildAbTestVariant()];
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants });
      mockPrisma.abTest.update.mockResolvedValue({ ...test, status: 'running', startedAt: new Date() });

      const res = await request(createApp()).post(`/api/ab-tests/${test.id}/start`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('running');
    });

    it('should return 400 if test is already running', async () => {
      const test = buildAbTest({ status: 'running' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [] });

      const res = await request(createApp()).post(`/api/ab-tests/${test.id}/start`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/ab-tests/:id/complete', () => {
    it('should complete a test and select winner', async () => {
      const variantA = buildAbTestVariant({ sentCount: 100, openCount: 60 });
      const variantB = buildAbTestVariant({ sentCount: 100, openCount: 40 });
      const test = buildAbTest({ status: 'running' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [variantA, variantB] });
      mockPrisma.abTest.update.mockResolvedValue({ ...test, status: 'completed', winnerVariantId: variantA.id });

      const res = await request(createApp()).post(`/api/ab-tests/${test.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });
  });

  describe('GET /api/ab-tests/:id/results', () => {
    it('should return test results with rates', async () => {
      const variants = [
        buildAbTestVariant({ sentCount: 100, openCount: 40, clickCount: 10, replyCount: 5 }),
        buildAbTestVariant({ sentCount: 100, openCount: 60, clickCount: 20, replyCount: 8 }),
      ];
      const test = buildAbTest();
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants });

      const res = await request(createApp()).get(`/api/ab-tests/${test.id}/results`);

      expect(res.status).toBe(200);
      expect(res.body.data.variants[0].openRate).toBe(40);
      expect(res.body.data.variants[1].openRate).toBe(60);
    });
  });
});
