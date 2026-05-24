import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: analyticsRoutes } = await import('./analytics.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', analyticsRoutes);
  app.use(errorHandler);
  return app;
}

describe('Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/analytics/overview', () => {
    it('should return overview stats', async () => {
      mockPrisma.lead.count.mockResolvedValue(100);
      mockPrisma.campaign.count.mockResolvedValue(3);
      mockPrisma.message.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(400)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);

      const res = await request(createApp()).get('/api/analytics/overview');

      expect(res.status).toBe(200);
      expect(res.body.data.totalLeads).toBe(100);
      expect(res.body.data.activeCampaigns).toBe(3);
      expect(res.body.data.totalSent).toBe(500);
      expect(res.body.data.deliveryRate).toBe(80);
    });

    it('should return 0 delivery rate when no messages sent', async () => {
      mockPrisma.lead.count.mockResolvedValue(0);
      mockPrisma.campaign.count.mockResolvedValue(0);
      mockPrisma.message.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const res = await request(createApp()).get('/api/analytics/overview');

      expect(res.body.data.deliveryRate).toBe(0);
    });
  });

  describe('GET /api/analytics/by-campaign', () => {
    it('should return per-campaign stats', async () => {
      const campaigns = [
        { id: 'c1', name: 'Campaign 1', sentCount: 100, failedCount: 5, replyCount: 10, openedCount: 50 },
        { id: 'c2', name: 'Campaign 2', sentCount: 200, failedCount: 10, replyCount: 20, openedCount: 80 },
      ];
      mockPrisma.campaign.findMany.mockResolvedValue(campaigns);

      const res = await request(createApp()).get('/api/analytics/by-campaign');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].sentCount).toBe(100);
    });
  });

  describe('GET /api/analytics/timeline', () => {
    it('should return daily timeline', async () => {
      const messages = [
        { createdAt: new Date('2025-01-01T10:00:00Z'), status: 'sent', channel: 'email' },
        { createdAt: new Date('2025-01-01T12:00:00Z'), status: 'delivered', channel: 'email' },
        { createdAt: new Date('2025-01-02T10:00:00Z'), status: 'failed', channel: 'whatsapp' },
      ];
      mockPrisma.message.findMany.mockResolvedValue(messages as any);

      const res = await request(createApp()).get('/api/analytics/timeline?days=30');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].sent).toBe(2);
      expect(res.body.data[0].delivered).toBe(1);
      expect(res.body.data[1].failed).toBe(1);
    });

    it('should default to 7 days', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);

      await request(createApp()).get('/api/analytics/timeline');

      expect(mockPrisma.message.findMany).toHaveBeenCalledOnce();
    });
  });

  describe('GET /api/analytics/channel-breakdown', () => {
    it('should return channel counts', async () => {
      mockPrisma.message.count
        .mockResolvedValueOnce(300)
        .mockResolvedValueOnce(100);

      const res = await request(createApp()).get('/api/analytics/channel-breakdown');

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(300);
      expect(res.body.data.whatsapp).toBe(100);
    });

    it('should return zeros when no messages', async () => {
      mockPrisma.message.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const res = await request(createApp()).get('/api/analytics/channel-breakdown');

      expect(res.body.data.email).toBe(0);
      expect(res.body.data.whatsapp).toBe(0);
    });
  });
});
