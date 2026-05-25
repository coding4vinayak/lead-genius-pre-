import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildEmailVerification } from '../test/factories.js';

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

const { verifyEmail, bulkVerify, getVerificationStatus } = await import('./email-verification.js');

describe('Email Verification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyEmail', () => {
    it('should return invalid for bad format', async () => {
      const result = await verifyEmail('not-an-email');
      expect(result.status).toBe('invalid');
      expect(result.mxValid).toBe(false);
      expect(result.smtpValid).toBe(false);
    });

    it('should verify valid email with MX records', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1', email: 'test@example.com' }));
      mockPrisma.emailVerification.create.mockResolvedValue(buildEmailVerification());
      mockPrisma.lead.update.mockResolvedValue(buildLead({ verificationStatus: 'valid' }));

      const result = await verifyEmail('test@example.com');
      expect(result.status).toBe('valid');
      expect(result.mxValid).toBe(true);
      expect(result.email).toBe('test@example.com');
    });

    it('should create verification record in database', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);
      mockPrisma.emailVerification.create.mockResolvedValue(buildEmailVerification());

      await verifyEmail('test@example.com');
      expect(mockPrisma.emailVerification.create).toHaveBeenCalledOnce();
    });

    it('should update lead verification status if lead exists', async () => {
      const lead = buildLead({ id: 'lead_1', email: 'test@example.com' });
      mockPrisma.lead.findFirst.mockResolvedValue(lead);
      mockPrisma.emailVerification.create.mockResolvedValue(buildEmailVerification());
      mockPrisma.lead.update.mockResolvedValue(buildLead({ verificationStatus: 'valid' }));

      await verifyEmail('test@example.com');
      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead_1' },
        data: { verificationStatus: 'valid' },
      });
    });
  });

  describe('bulkVerify', () => {
    it('should verify multiple emails', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);
      mockPrisma.emailVerification.create.mockResolvedValue(buildEmailVerification());

      const results = await bulkVerify(['test@example.com', 'bad-email']);
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('valid');
      expect(results[1].status).toBe('invalid');
    });
  });

  describe('getVerificationStatus', () => {
    it('should return the most recent verification for an email', async () => {
      const verification = buildEmailVerification({ email: 'test@example.com' });
      mockPrisma.emailVerification.findFirst.mockResolvedValue(verification);

      const result = await getVerificationStatus('test@example.com');
      expect(result).toBeDefined();
      expect(result!.email).toBe('test@example.com');
    });

    it('should return null when no verification exists', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue(null);

      const result = await getVerificationStatus('new@example.com');
      expect(result).toBeNull();
    });
  });
});
