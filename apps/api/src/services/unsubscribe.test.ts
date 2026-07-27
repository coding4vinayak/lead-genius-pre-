import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildUnsubscribeRecord, buildSuppressionEntry } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { processUnsubscribe, generateUnsubscribeLink, injectUnsubscribeHeaders, getUnsubscribeLandingPage, processUnsubscribeByToken } = await import('./unsubscribe.js');

describe('Unsubscribe Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processUnsubscribe', () => {
    it('should create unsubscribe record and add to suppression', async () => {
      mockPrisma.unsubscribeRecord.create.mockResolvedValue(buildUnsubscribeRecord());
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(buildSuppressionEntry());
      mockPrisma.lead.update.mockResolvedValue(buildLead({ status: 'unsubscribed' }));

      const result = await processUnsubscribe('user@test.com', 'lead_1', 'no_longer_interested', '127.0.0.1');
      expect(result).toBeDefined();
      expect(mockPrisma.unsubscribeRecord.create).toHaveBeenCalledOnce();
      expect(mockPrisma.suppressionEntry.upsert).toHaveBeenCalledOnce();
      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead_1' },
        data: { status: 'unsubscribed' },
      });
    });

    it('should work without a lead ID', async () => {
      mockPrisma.unsubscribeRecord.create.mockResolvedValue(buildUnsubscribeRecord({ leadId: null }));
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(buildSuppressionEntry());

      const result = await processUnsubscribe('nolead@test.com', null, 'spam');
      expect(result).toBeDefined();
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('generateUnsubscribeLink', () => {
    it('should generate a unique unsubscribe link', async () => {
      const lead = buildLead({ id: 'lead_1', email: 'user@test.com' });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.unsubscribeRecord.create.mockResolvedValue(buildUnsubscribeRecord());

      const link = await generateUnsubscribeLink('lead_1', 'msg_1');
      expect(link).toContain('/api/compliance/unsubscribe/');
      expect(link.length).toBeGreaterThan(40);
    });

    it('should throw if lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(generateUnsubscribeLink('nonexistent')).rejects.toThrow('Lead not found or has no email');
    });
  });

  describe('injectUnsubscribeHeaders', () => {
    it('should add RFC 8058 headers', () => {
      const url = 'http://localhost:3000/api/compliance/unsubscribe/abc123';
      const headers = injectUnsubscribeHeaders(url);
      expect(headers['List-Unsubscribe']).toBe(`<${url}>`);
      expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('should preserve existing headers', () => {
      const url = 'http://localhost:3000/api/compliance/unsubscribe/abc123';
      const headers = injectUnsubscribeHeaders(url, { 'X-Custom': 'value' });
      expect(headers['X-Custom']).toBe('value');
      expect(headers['List-Unsubscribe']).toBeDefined();
    });
  });

  describe('getUnsubscribeLandingPage', () => {
    it('should return landing page data for valid token', async () => {
      const record = buildUnsubscribeRecord({ token: 'valid_token', reason: null, unsubscribedAt: new Date(0) });
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(record);

      const result = await getUnsubscribeLandingPage('valid_token');
      expect(result).toBeDefined();
      expect(result!.email).toBe(record.email);
      expect(result!.alreadyUnsubscribed).toBe(false);
    });

    it('should return null for invalid token', async () => {
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(null);

      const result = await getUnsubscribeLandingPage('invalid_token');
      expect(result).toBeNull();
    });
  });

  describe('processUnsubscribeByToken', () => {
    it('should process unsubscribe from token', async () => {
      const record = buildUnsubscribeRecord({ token: 'tok_123', reason: null, unsubscribedAt: new Date(0), leadId: 'lead_1' });
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(record);
      mockPrisma.unsubscribeRecord.update.mockResolvedValue({ ...record, reason: 'one_click', unsubscribedAt: new Date() });
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(buildSuppressionEntry());
      mockPrisma.lead.update.mockResolvedValue(buildLead({ status: 'unsubscribed' }));

      const result = await processUnsubscribeByToken('tok_123', 'one_click', '127.0.0.1');
      expect(result).toBeDefined();
      expect(mockPrisma.unsubscribeRecord.update).toHaveBeenCalledOnce();
      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead_1' },
        data: { status: 'unsubscribed' },
      });
    });

    it('should return null for non-existent token', async () => {
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(null);

      const result = await processUnsubscribeByToken('fake_token');
      expect(result).toBeNull();
    });
  });
});
