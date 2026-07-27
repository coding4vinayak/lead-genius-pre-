import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildTrackingDomain } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: trackingDomainRoutes } = await import('./tracking-domains.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tracking-domains', trackingDomainRoutes);
  app.use(errorHandler);
  return app;
}

describe('Tracking Domains API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tracking-domains', () => {
    it('should list all tracking domains', async () => {
      const domains = [buildTrackingDomain(), buildTrackingDomain()];
      mockPrisma.trackingDomain.findMany.mockResolvedValue(domains);

      const res = await request(createApp()).get('/api/tracking-domains');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/tracking-domains', () => {
    it('should create a tracking domain', async () => {
      const domain = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);
      mockPrisma.trackingDomain.create.mockResolvedValue(domain);

      const res = await request(createApp())
        .post('/api/tracking-domains')
        .send({ domain: 'track.example.com', cnameTarget: 'tracking.leadgenius.io' });

      expect(res.status).toBe(201);
      expect(res.body.data.domain).toBe('track.example.com');
    });

    it('should reject missing domain', async () => {
      const res = await request(createApp())
        .post('/api/tracking-domains')
        .send({ cnameTarget: 'tracking.leadgenius.io' });

      expect(res.status).toBe(400);
    });

    it('should reject missing cnameTarget', async () => {
      const res = await request(createApp())
        .post('/api/tracking-domains')
        .send({ domain: 'track.example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/tracking-domains/:id', () => {
    it('should return a domain by id', async () => {
      const domain = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(domain);

      const res = await request(createApp()).get(`/api/tracking-domains/${domain.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(domain.id);
    });

    it('should return 404 for non-existent domain', async () => {
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/tracking-domains/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tracking-domains/:id', () => {
    it('should delete a tracking domain', async () => {
      const domain = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(domain);
      mockPrisma.trackingDomain.delete.mockResolvedValue(domain);

      const res = await request(createApp()).delete(`/api/tracking-domains/${domain.id}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent domain', async () => {
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).delete('/api/tracking-domains/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/tracking-domains/:id/verify', () => {
    it('should attempt DNS verification', async () => {
      const domain = buildTrackingDomain();
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(domain);
      mockPrisma.trackingDomain.update.mockResolvedValue({ ...domain, status: 'failed' });

      const res = await request(createApp()).post(`/api/tracking-domains/${domain.id}/verify`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('verified');
      expect(res.body.data).toHaveProperty('message');
    });

    it('should return 404 for non-existent domain', async () => {
      mockPrisma.trackingDomain.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/tracking-domains/nonexistent/verify');

      expect(res.status).toBe(404);
    });
  });
});
