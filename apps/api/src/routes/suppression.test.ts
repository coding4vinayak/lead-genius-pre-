import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSuppressionEntry } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: suppressionRoutes } = await import('./suppression.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/suppression', suppressionRoutes);
  app.use(errorHandler);
  return app;
}

describe('Suppression API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/suppression', () => {
    it('should list suppression entries with pagination', async () => {
      const entries = [buildSuppressionEntry(), buildSuppressionEntry()];
      mockPrisma.suppressionEntry.findMany.mockResolvedValue(entries);
      mockPrisma.suppressionEntry.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/suppression?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/suppression', () => {
    it('should add an email to suppression list', async () => {
      const entry = buildSuppressionEntry({ email: 'bounce@test.com', reason: 'bounce' });
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(entry);

      const res = await request(createApp())
        .post('/api/suppression')
        .send({ email: 'bounce@test.com', reason: 'bounce', source: 'manual' });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('bounce@test.com');
    });

    it('should reject invalid reason', async () => {
      const res = await request(createApp())
        .post('/api/suppression')
        .send({ email: 'test@test.com', reason: 'invalid_reason' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid email', async () => {
      const res = await request(createApp())
        .post('/api/suppression')
        .send({ email: 'not-an-email', reason: 'bounce' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/suppression/:id', () => {
    it('should remove a suppression entry', async () => {
      const entry = buildSuppressionEntry({ id: 'sup_123' });
      mockPrisma.suppressionEntry.delete.mockResolvedValue(entry);

      const res = await request(createApp()).delete('/api/suppression/sup_123');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('sup_123');
    });
  });

  describe('POST /api/suppression/import', () => {
    it('should import suppression entries', async () => {
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(buildSuppressionEntry());

      const res = await request(createApp())
        .post('/api/suppression/import')
        .send({
          entries: [
            { email: 'a@test.com', reason: 'bounce' },
            { email: 'b@test.com', reason: 'complaint' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.imported).toBe(2);
    });

    it('should reject empty entries array', async () => {
      const res = await request(createApp())
        .post('/api/suppression/import')
        .send({ entries: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/suppression/export', () => {
    it('should export all suppression entries', async () => {
      const entries = [buildSuppressionEntry(), buildSuppressionEntry()];
      mockPrisma.suppressionEntry.findMany.mockResolvedValue(entries);

      const res = await request(createApp()).get('/api/suppression/export');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/suppression/check/:email', () => {
    it('should check if email is suppressed', async () => {
      mockPrisma.suppressionEntry.count.mockResolvedValue(1);

      const res = await request(createApp()).get('/api/suppression/check/test@test.com');

      expect(res.status).toBe(200);
      expect(res.body.data.suppressed).toBe(true);
    });

    it('should return false for non-suppressed email', async () => {
      mockPrisma.suppressionEntry.count.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/suppression/check/clean@test.com');

      expect(res.status).toBe(200);
      expect(res.body.data.suppressed).toBe(false);
    });
  });
});
