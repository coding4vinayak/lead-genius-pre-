import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildEnrichmentLog, buildGroup } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const mockAdd = vi.fn().mockResolvedValue({ id: 'job_1' });
vi.mock('../queue/index.js', () => ({
  enrichmentQueue: { add: (...args: unknown[]) => mockAdd(...args) },
}));

const { default: enrichmentRoutes } = await import('./enrichment.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', enrichmentRoutes);
  app.use(errorHandler);
  return app;
}

describe('Enrichment API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/leads/:id/enrich', () => {
    it('should enrich a lead and return results', async () => {
      const lead = buildLead({ email: 'john@acme.com', title: 'VP of Engineering' });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.enrichmentLog.create.mockResolvedValue(buildEnrichmentLog());
      mockPrisma.enrichmentLog.update.mockResolvedValue(buildEnrichmentLog());
      mockPrisma.lead.update.mockResolvedValue(lead);

      const res = await request(createApp())
        .post(`/api/leads/${lead.id}/enrich`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].provider).toBe('domain-lookup');
      expect(res.body.data[1].provider).toBe('role-inference');
    });

    it('should accept specific providers', async () => {
      const lead = buildLead({ email: 'john@acme.com', title: 'CEO' });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.enrichmentLog.create.mockResolvedValue(buildEnrichmentLog());
      mockPrisma.enrichmentLog.update.mockResolvedValue(buildEnrichmentLog());
      mockPrisma.lead.update.mockResolvedValue(lead);

      const res = await request(createApp())
        .post(`/api/leads/${lead.id}/enrich`)
        .send({ providers: ['domain-lookup'] });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].provider).toBe('domain-lookup');
    });

    it('should return 404 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/leads/nonexistent/enrich')
        .send({});

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/groups/:id/enrich', () => {
    it('should queue bulk enrichment job', async () => {
      const group = buildGroup();
      mockPrisma.leadGroup.findUnique.mockResolvedValue(group);
      mockPrisma.groupMember.findMany.mockResolvedValue([
        { leadId: 'lead_1', groupId: group.id, assignedAt: new Date() },
        { leadId: 'lead_2', groupId: group.id, assignedAt: new Date() },
      ]);

      const res = await request(createApp())
        .post(`/api/groups/${group.id}/enrich`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.queued).toBe(2);
      expect(res.body.data.groupId).toBe(group.id);
      expect(mockAdd).toHaveBeenCalledWith(
        'bulk-enrich',
        expect.objectContaining({ leadIds: ['lead_1', 'lead_2'] }),
        expect.any(Object),
      );
    });

    it('should return 404 for non-existent group', async () => {
      mockPrisma.leadGroup.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/groups/nonexistent/enrich')
        .send({});

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/leads/:id/enrichment-history', () => {
    it('should return enrichment history for a lead', async () => {
      const lead = buildLead();
      const logs = [buildEnrichmentLog(), buildEnrichmentLog({ provider: 'role-inference' })];
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.enrichmentLog.findMany.mockResolvedValue(logs);

      const res = await request(createApp())
        .get(`/api/leads/${lead.id}/enrichment-history`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 404 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .get('/api/leads/nonexistent/enrichment-history');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/leads/find-email', () => {
    it('should return email patterns', async () => {
      const res = await request(createApp())
        .post('/api/leads/find-email')
        .send({ firstName: 'John', lastName: 'Doe', domain: 'acme.com' });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(8);
      expect(res.body.data[0].email).toBe('john.doe@acme.com');
      expect(res.body.data[0].verification).toBe('unverified');
    });

    it('should validate required fields', async () => {
      const res = await request(createApp())
        .post('/api/leads/find-email')
        .send({ firstName: '', lastName: 'Doe', domain: 'acme.com' });

      expect(res.status).toBe(400);
    });
  });
});
