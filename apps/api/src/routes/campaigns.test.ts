import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildCampaign, buildTemplate } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: campaignRoutes } = await import('./campaigns.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/campaigns', campaignRoutes);
  app.use(errorHandler);
  return app;
}

describe('Campaigns API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/campaigns', () => {
    it('should list campaigns with pagination', async () => {
      const campaigns = [buildCampaign(), buildCampaign()];
      mockPrisma.campaign.findMany.mockResolvedValue(campaigns);
      mockPrisma.campaign.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/campaigns?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await request(createApp()).get('/api/campaigns?status=running&page=1&pageSize=50');

      expect(mockPrisma.campaign.findMany.mock.calls[0][0].where.status).toBe('running');
    });

    it('should include template info', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([buildCampaign()]);
      mockPrisma.campaign.count.mockResolvedValue(1);

      await request(createApp()).get('/api/campaigns?page=1&pageSize=50');

      const include = mockPrisma.campaign.findMany.mock.calls[0][0].include;
      expect(include.template.select).toEqual({ name: true, channel: true });
    });
  });

  describe('GET /api/campaigns/:id', () => {
    it('should return a campaign with template and messages', async () => {
      const campaign = buildCampaign({ id: 'camp_1' });
      mockPrisma.campaign.findUnique.mockResolvedValue(campaign);

      const res = await request(createApp()).get('/api/campaigns/camp_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('camp_1');
    });

    it('should return 404 for non-existent campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/campaigns/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
    });
  });

  describe('POST /api/campaigns', () => {
    it('should create a campaign', async () => {
      const newCamp = buildCampaign({ id: 'camp_new', name: 'New Campaign' });
      mockPrisma.campaign.create.mockResolvedValue(newCamp);

      const res = await request(createApp())
        .post('/api/campaigns')
        .send({
          name: 'New Campaign', channel: 'email', templateId: 'tmpl_1',
          scheduleType: 'immediate', sendStrategy: 'sequential',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Campaign');
    });

    it('should reject missing required fields', async () => {
      const res = await request(createApp())
        .post('/api/campaigns')
        .send({ name: 'Incomplete' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/campaigns/:id', () => {
    it('should update a campaign', async () => {
      const updated = buildCampaign({ id: 'camp_1', name: 'Updated' });
      mockPrisma.campaign.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/campaigns/camp_1')
        .send({
          name: 'Updated', channel: 'email', templateId: 'tmpl_1',
          scheduleType: 'immediate', sendStrategy: 'sequential',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/campaigns/:id', () => {
    it('should delete a campaign', async () => {
      mockPrisma.campaign.delete.mockResolvedValue(buildCampaign({ id: 'camp_1' }));

      const res = await request(createApp()).delete('/api/campaigns/camp_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('camp_1');
    });
  });

  describe('POST /api/campaigns/:id/activate', () => {
    it('should activate a draft campaign', async () => {
      const campaign = buildCampaign({ id: 'camp_1', status: 'draft', scheduleType: 'immediate' });
      mockPrisma.campaign.findUnique.mockResolvedValue(campaign);
      mockPrisma.campaign.update.mockResolvedValue({ ...campaign, status: 'running' });

      const res = await request(createApp()).post('/api/campaigns/camp_1/activate');

      expect(res.status).toBe(200);
      expect(mockPrisma.campaign.update.mock.calls[0][0].data.status).toBe('running');
    });

    it('should activate a scheduled campaign', async () => {
      const campaign = buildCampaign({ id: 'camp_1', status: 'draft', scheduleType: 'scheduled', scheduledAt: new Date('2026-06-01') });
      mockPrisma.campaign.findUnique.mockResolvedValue(campaign);
      mockPrisma.campaign.update.mockResolvedValue({ ...campaign, status: 'scheduled' });

      const res = await request(createApp()).post('/api/campaigns/camp_1/activate');

      expect(res.status).toBe(200);
      expect(mockPrisma.campaign.update.mock.calls[0][0].data.status).toBe('scheduled');
    });

    it('should return 404 for non-existent campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/campaigns/nonexistent/activate');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/campaigns/:id/pause', () => {
    it('should pause a running campaign', async () => {
      mockPrisma.campaign.update.mockResolvedValue(buildCampaign({ id: 'camp_1', status: 'paused' }));

      const res = await request(createApp()).post('/api/campaigns/camp_1/pause');

      expect(res.status).toBe(200);
      expect(mockPrisma.campaign.update.mock.calls[0][0].data.status).toBe('paused');
    });
  });

  describe('POST /api/campaigns/:id/resume', () => {
    it('should resume a paused campaign', async () => {
      mockPrisma.campaign.update.mockResolvedValue(buildCampaign({ id: 'camp_1', status: 'running' }));

      const res = await request(createApp()).post('/api/campaigns/camp_1/resume');

      expect(res.status).toBe(200);
      expect(mockPrisma.campaign.update.mock.calls[0][0].data.status).toBe('running');
    });
  });

  describe('POST /api/campaigns/:id/stop', () => {
    it('should stop a campaign', async () => {
      mockPrisma.campaign.update.mockResolvedValue(buildCampaign({ id: 'camp_1', status: 'completed' }));

      const res = await request(createApp()).post('/api/campaigns/camp_1/stop');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });
  });

  describe('POST /api/campaigns/:id/test', () => {
    it('should queue a test message', async () => {
      const campaign = buildCampaign({ id: 'camp_1' });
      mockPrisma.campaign.findUnique.mockResolvedValue({ ...campaign, template: buildTemplate() });

      const res = await request(createApp())
        .post('/api/campaigns/camp_1/test')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Test');
    });

    it('should return 404 for non-existent campaign', async () => {
      mockPrisma.campaign.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/campaigns/nonexistent/test')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(404);
    });
  });
});
