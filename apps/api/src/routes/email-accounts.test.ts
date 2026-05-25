import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildEmailAccount, buildAccountRotationConfig } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: emailAccountRoutes } = await import('./email-accounts.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/email-accounts', emailAccountRoutes);
  app.use(errorHandler);
  return app;
}

describe('Email Accounts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/email-accounts', () => {
    it('should list accounts with pagination', async () => {
      const accounts = [buildEmailAccount(), buildEmailAccount()];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);
      mockPrisma.emailAccount.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/email-accounts?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
    });
  });

  describe('POST /api/email-accounts', () => {
    it('should create an email account', async () => {
      const account = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);
      mockPrisma.emailAccount.create.mockResolvedValue(account);

      const res = await request(createApp())
        .post('/api/email-accounts')
        .send({ email: 'sender@example.com', name: 'Main Sender', smtpHost: 'smtp.example.com', smtpPort: 587 });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('sender@example.com');
    });

    it('should reject invalid email', async () => {
      const res = await request(createApp())
        .post('/api/email-accounts')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('should reject missing email', async () => {
      const res = await request(createApp())
        .post('/api/email-accounts')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/email-accounts/:id', () => {
    it('should return an account by id', async () => {
      const account = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);

      const res = await request(createApp()).get(`/api/email-accounts/${account.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(account.id);
    });

    it('should return 404 for non-existent account', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/email-accounts/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/email-accounts/:id', () => {
    it('should update an account', async () => {
      const account = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.update.mockResolvedValue({ ...account, name: 'Updated' });

      const res = await request(createApp())
        .put(`/api/email-accounts/${account.id}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('should return 404 for non-existent account', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/email-accounts/nonexistent')
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/email-accounts/:id', () => {
    it('should delete an account', async () => {
      const account = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.delete.mockResolvedValue(account);

      const res = await request(createApp()).delete(`/api/email-accounts/${account.id}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent account', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).delete('/api/email-accounts/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/email-accounts/:id/test-connection', () => {
    it('should test SMTP connection', async () => {
      const account = buildEmailAccount({ smtpHost: 'smtp.example.com' });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);

      const res = await request(createApp()).post(`/api/email-accounts/${account.id}/test-connection`);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('should return 404 for non-existent account', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/email-accounts/nonexistent/test-connection');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/email-accounts/:id/health', () => {
    it('should return account health metrics', async () => {
      const account = buildEmailAccount({ sentToday: 50, dailyLimit: 100 });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);

      const res = await request(createApp()).get(`/api/email-accounts/${account.id}/health`);

      expect(res.status).toBe(200);
      expect(res.body.data.remainingToday).toBe(50);
    });

    it('should return 404 for non-existent account', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/email-accounts/nonexistent/health');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/email-accounts/rotate', () => {
    it('should return next account for rotation', async () => {
      mockPrisma.accountRotationConfig.findFirst.mockResolvedValue(null);
      mockPrisma.emailAccount.findMany.mockResolvedValue([
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', sentToday: 50, dailyLimit: 100, bounceRate: 0 }),
        buildEmailAccount({ id: 'ea_2', email: 'b@test.com', sentToday: 10, dailyLimit: 100, bounceRate: 0 }),
      ]);

      const res = await request(createApp())
        .post('/api/email-accounts/rotate')
        .send({ strategy: 'round_robin' });

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('b@test.com');
    });

    it('should return null when no accounts available', async () => {
      mockPrisma.accountRotationConfig.findFirst.mockResolvedValue(null);
      mockPrisma.emailAccount.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/email-accounts/rotate')
        .send({ strategy: 'round_robin' });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });
});
