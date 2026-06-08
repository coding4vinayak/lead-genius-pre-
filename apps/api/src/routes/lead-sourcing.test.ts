import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../services/webhook-delivery.js', () => ({ dispatchWebhookEvent: vi.fn() }));

const { default: sourcingRoutes } = await import('./lead-sourcing.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/leads/source', sourcingRoutes);
  app.use(errorHandler);
  return app;
}

describe('Lead Sourcing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/leads/source/linkedin', () => {
    it('should import a single lead from LinkedIn URL', async () => {
      mockPrisma.lead.create.mockResolvedValue({
        id: 'lead_new',
        name: 'John Doe',
        email: '',
        source: 'linkedin',
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        tags: ['linkedin-import'],
      });

      const res = await request(createApp())
        .post('/api/leads/source/linkedin')
        .send({ searchUrl: 'https://linkedin.com/in/johndoe' });

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(1);
      expect(res.body.meta.note).toContain('Placeholder');
      expect(mockPrisma.lead.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.leadTimeline.create).toHaveBeenCalledTimes(1);
    });

    it('should create multiple placeholder leads from keywords', async () => {
      mockPrisma.lead.create.mockResolvedValue({ id: 'lead_new' });

      const res = await request(createApp())
        .post('/api/leads/source/linkedin')
        .send({ keywords: 'CEO', maxLeads: 3 });

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(3);
      expect(mockPrisma.lead.create).toHaveBeenCalledTimes(3);
    });

    it('should add leads to a group if groupId is provided', async () => {
      mockPrisma.lead.create.mockResolvedValue({ id: 'lead_new' });
      mockPrisma.groupMember.createMany.mockResolvedValue({ count: 1 });

      const res = await request(createApp())
        .post('/api/leads/source/linkedin')
        .send({ searchUrl: 'https://linkedin.com/in/johndoe', groupId: 'group_1' });

      expect(res.status).toBe(201);
      expect(mockPrisma.groupMember.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ leadId: 'lead_new', groupId: 'group_1' }] }),
      );
    });

    it('should accept empty body (all optional fields) with defaults', async () => {
      mockPrisma.lead.create.mockResolvedValue({ id: 'lead_new' });

      const res = await request(createApp())
        .post('/api/leads/source/linkedin')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(25);
    });
  });

  describe('POST /api/leads/source/website', () => {
    it('should import leads from a website URL', async () => {
      mockPrisma.lead.create.mockResolvedValue({ id: 'lead_new' });

      const res = await request(createApp())
        .post('/api/leads/source/website')
        .send({ url: 'https://example.com', maxLeads: 2 });

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(2);
      expect(mockPrisma.lead.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.leadTimeline.create).toHaveBeenCalledTimes(2);
    });

    it('should tag leads with domain', async () => {
      mockPrisma.lead.create.mockResolvedValue({ id: 'lead_new' });

      await request(createApp())
        .post('/api/leads/source/website')
        .send({ url: 'https://www.example.com', maxLeads: 1 });

      const callArgs = mockPrisma.lead.create.mock.calls[0][0];
      expect(callArgs.data.tags).toContain('example.com');
    });

    it('should return 400 for missing URL', async () => {
      const res = await request(createApp())
        .post('/api/leads/source/website')
        .send({ maxLeads: 1 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/leads/source/webhook', () => {
    it('should import leads from webhook payload', async () => {
      mockPrisma.lead.create.mockResolvedValue({ id: 'lead_new' });

      const res = await request(createApp())
        .post('/api/leads/source/webhook')
        .send({
          leads: [
            { name: 'Jane', email: 'jane@test.com', company: 'TestCo' },
            { name: 'Bob', email: 'bob@test.com' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.count).toBe(2);
      expect(mockPrisma.lead.create).toHaveBeenCalledTimes(2);
    });

    it('should return 400 if leads array is missing', async () => {
      const res = await request(createApp())
        .post('/api/leads/source/webhook')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
