import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildEmailAccount } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: reputationRoutes } = await import('./reputation.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reputation', reputationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Reputation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/reputation/dashboard', () => {
    it('should return reputation dashboard', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 95, bounceRate: 1, isActive: true, sentToday: 10, dailyLimit: 100 }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const res = await request(createApp()).get('/api/reputation/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data.accounts).toHaveLength(1);
      expect(res.body.data.summary).toHaveProperty('totalAccounts', 1);
      expect(res.body.data.summary).toHaveProperty('activeAccounts', 1);
    });

    it('should return empty dashboard when no accounts', async () => {
      mockPrisma.emailAccount.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/reputation/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data.accounts).toHaveLength(0);
      expect(res.body.data.summary.totalAccounts).toBe(0);
    });
  });

  describe('GET /api/reputation/accounts/:id', () => {
    it('should return reputation metrics for an account', async () => {
      const account = buildEmailAccount({ bounceRate: 3 });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.update.mockResolvedValue({ ...account, reputationScore: 90 });

      const res = await request(createApp()).get(`/api/reputation/accounts/${account.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reputationScore).toBe(90);
    });

    it('should return 404 for non-existent account', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/reputation/accounts/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/reputation/alerts', () => {
    it('should return alerts for unhealthy accounts', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 40, bounceRate: 12, sentToday: 100, dailyLimit: 100, isActive: true }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const res = await request(createApp()).get('/api/reputation/alerts');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should return empty array for healthy accounts', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 95, bounceRate: 1, sentToday: 10, dailyLimit: 100, isActive: true }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const res = await request(createApp()).get('/api/reputation/alerts');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });
});
