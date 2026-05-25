import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildEmailVerification, buildLead } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

vi.mock('dns', () => ({
  default: {
    resolveMx: vi.fn(),
  },
  resolveMx: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: () => vi.fn().mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]),
}));

const { default: emailVerificationRoutes } = await import('./email-verification.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/email-verification', emailVerificationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Email Verification API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/email-verification/verify', () => {
    it('should verify a valid email', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ email: 'test@example.com' }));
      mockPrisma.emailVerification.create.mockResolvedValue(buildEmailVerification());
      mockPrisma.lead.update.mockResolvedValue(buildLead());

      const res = await request(createApp())
        .post('/api/email-verification/verify')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('valid');
      expect(res.body.data.mxValid).toBe(true);
    });

    it('should return invalid for bad format', async () => {
      const res = await request(createApp())
        .post('/api/email-verification/verify')
        .send({ email: 'not-valid' });

      expect(res.status).toBe(400);
    });

    it('should reject missing email', async () => {
      const res = await request(createApp())
        .post('/api/email-verification/verify')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/email-verification/bulk-verify', () => {
    it('should verify multiple emails', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);
      mockPrisma.emailVerification.create.mockResolvedValue(buildEmailVerification());

      const res = await request(createApp())
        .post('/api/email-verification/bulk-verify')
        .send({ emails: ['a@example.com', 'b@example.com'] });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should reject empty emails array', async () => {
      const res = await request(createApp())
        .post('/api/email-verification/bulk-verify')
        .send({ emails: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/email-verification/status/:email', () => {
    it('should return verification status', async () => {
      const verification = buildEmailVerification({ email: 'test@example.com' });
      mockPrisma.emailVerification.findFirst.mockResolvedValue(verification);

      const res = await request(createApp())
        .get('/api/email-verification/status/test@example.com');

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('should return 404 for unknown email', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue(null);

      const res = await request(createApp())
        .get('/api/email-verification/status/unknown@example.com');

      expect(res.status).toBe(404);
    });
  });
});
