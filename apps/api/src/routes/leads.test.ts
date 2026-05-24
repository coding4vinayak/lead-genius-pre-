import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: leadRoutes } = await import('./leads.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/leads', leadRoutes);
  app.use(errorHandler);
  return app;
}

describe('Leads API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/leads', () => {
    it('should list leads with pagination', async () => {
      const leads = [buildLead(), buildLead()];
      mockPrisma.lead.findMany.mockResolvedValue(leads);
      mockPrisma.lead.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/leads?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
    });

    it('should filter by status', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(0);

      await request(createApp()).get('/api/leads?status=active&page=1&pageSize=50');

      expect(mockPrisma.lead.findMany.mock.calls[0][0].where.status).toBe('active');
    });

    it('should search by name/email/company', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(0);

      await request(createApp()).get('/api/leads?search=john&page=1&pageSize=50');

      const where = mockPrisma.lead.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(3);
    });

    it('should return empty for no results', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/leads?page=1&pageSize=50');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should use default pagination values', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      mockPrisma.lead.count.mockResolvedValue(0);

      await request(createApp()).get('/api/leads');

      expect(mockPrisma.lead.count).toHaveBeenCalledOnce();
    });
  });

  describe('GET /api/leads/:id', () => {
    it('should return a lead by id with messages', async () => {
      const lead = buildLead({ id: 'lead_1' });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const res = await request(createApp()).get('/api/leads/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('lead_1');
      expect(res.body.data.name).toBe('John Doe');
      expect(mockPrisma.lead.findUnique.mock.calls[0][0].include.messages).toBeDefined();
    });

    it('should return 404 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/leads/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
      expect(res.body.error.message).toBe('Lead not found');
    });
  });

  describe('POST /api/leads', () => {
    it('should create a lead and return 201', async () => {
      const newLead = buildLead({ id: 'lead_new', name: 'Jane', email: 'jane@test.com' });
      mockPrisma.lead.create.mockResolvedValue(newLead);

      const res = await request(createApp())
        .post('/api/leads')
        .send({ name: 'Jane', email: 'jane@test.com', company: 'Corp' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Jane');
      expect(res.body.data.email).toBe('jane@test.com');
    });

    it('should reject invalid email', async () => {
      const res = await request(createApp())
        .post('/api/leads')
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toBeDefined();
    });

    it('should create with default values for empty body', async () => {
      mockPrisma.lead.create.mockResolvedValue(buildLead({ id: 'lead_new' }));

      const res = await request(createApp())
        .post('/api/leads')
        .send({});

      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/leads/:id', () => {
    it('should update a lead', async () => {
      const updated = buildLead({ id: 'lead_1', name: 'Updated Name' });
      mockPrisma.lead.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/leads/lead_1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/leads/:id', () => {
    it('should delete a lead and return its id', async () => {
      mockPrisma.lead.delete.mockResolvedValue(buildLead({ id: 'lead_1' }));

      const res = await request(createApp()).delete('/api/leads/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('lead_1');
    });
  });

  describe('POST /api/leads/bulk-tag', () => {
    it('should add tags to leads', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        buildLead({ id: 'lead_1', tags: ['existing'] }),
        buildLead({ id: 'lead_2', tags: [] }),
      ]);
      mockPrisma.lead.update.mockResolvedValue(buildLead());

      const res = await request(createApp())
        .post('/api/leads/bulk-tag')
        .send({ ids: ['lead_1', 'lead_2'], tags: ['new-tag'], action: 'add' });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2);
    });

    it('should remove tags from leads', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        buildLead({ id: 'lead_1', tags: ['tech', 'remove-me'] }),
      ]);
      mockPrisma.lead.update.mockResolvedValue(buildLead());

      const res = await request(createApp())
        .post('/api/leads/bulk-tag')
        .send({ ids: ['lead_1'], tags: ['remove-me'], action: 'remove' });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(1);
    });
  });

  describe('POST /api/leads/bulk-status', () => {
    it('should update status for multiple leads', async () => {
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 2 });

      const res = await request(createApp())
        .post('/api/leads/bulk-status')
        .send({ ids: ['lead_1', 'lead_2'], status: 'bounced' });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2);
    });

    it('should handle empty ids array', async () => {
      mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(createApp())
        .post('/api/leads/bulk-status')
        .send({ ids: [], status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(0);
    });
  });

  describe('POST /api/leads/import', () => {
    it('should import leads in bulk', async () => {
      mockPrisma.lead.createMany.mockResolvedValue({ count: 3 });

      const res = await request(createApp())
        .post('/api/leads/import')
        .send({ leads: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(3);
    });

    it('should import single lead', async () => {
      mockPrisma.lead.createMany.mockResolvedValue({ count: 1 });

      const res = await request(createApp())
        .post('/api/leads/import')
        .send({ leads: [{ name: 'Single Lead' }] });

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(1);
    });
  });

  describe('POST /api/leads/export', () => {
    it('should export leads as CSV', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        buildLead({ name: 'John', email: 'john@test.com' }),
      ]);

      const res = await request(createApp())
        .post('/api/leads/export')
        .send({ format: 'csv' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('name,email');
      expect(res.text).toContain('John');
      expect(res.text).toContain('john@test.com');
    });

    it('should export leads as JSON', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        buildLead({ name: 'John', email: 'john@test.com', company: 'Acme' }),
      ]);

      const res = await request(createApp())
        .post('/api/leads/export')
        .send({ format: 'json' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('John');
    });

    it('should filter by status during export', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      await request(createApp())
        .post('/api/leads/export')
        .send({ format: 'csv', status: 'active' });

      expect(mockPrisma.lead.findMany.mock.calls[0][0].where.status).toBe('active');
    });

    it('should export selected fields only', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        buildLead({ name: 'John', email: 'john@test.com', company: 'Acme' }),
      ]);

      const res = await request(createApp())
        .post('/api/leads/export')
        .send({ format: 'json', fields: ['name', 'email'] });

      expect(res.body.data[0]).toEqual({ name: 'John', email: 'john@test.com' });
      expect(res.body.data[0].company).toBeUndefined();
    });

    it('should export empty result set', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/leads/export')
        .send({ format: 'csv' });

      expect(res.status).toBe(200);
      expect(res.text).toContain('name,email,phone');
    });

    it('should search during export', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      await request(createApp())
        .post('/api/leads/export')
        .send({ format: 'json', search: 'john' });

      expect(mockPrisma.lead.findMany.mock.calls[0][0].where.OR).toBeDefined();
    });
  });
});
