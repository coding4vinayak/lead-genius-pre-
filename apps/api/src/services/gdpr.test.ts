import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildGdprConsent } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { recordConsent, revokeConsent, checkConsent, exportLeadData, deleteLeadData } = await import('./gdpr.js');

describe('GDPR Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordConsent', () => {
    it('should create or update consent record', async () => {
      const consent = buildGdprConsent({ leadId: 'lead_1', consentType: 'marketing_email' });
      mockPrisma.gdprConsent.upsert.mockResolvedValue(consent);

      const result = await recordConsent('lead_1', 'marketing_email', 'signup_form');
      expect(result.leadId).toBe('lead_1');
      expect(result.consentType).toBe('marketing_email');
      expect(mockPrisma.gdprConsent.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('revokeConsent', () => {
    it('should set revokedAt on consent record', async () => {
      const consent = buildGdprConsent({ revokedAt: new Date() });
      mockPrisma.gdprConsent.update.mockResolvedValue(consent);

      const result = await revokeConsent('lead_1', 'marketing_email');
      expect(result.revokedAt).toBeDefined();
      expect(mockPrisma.gdprConsent.update).toHaveBeenCalledWith({
        where: { leadId_consentType: { leadId: 'lead_1', consentType: 'marketing_email' } },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('checkConsent', () => {
    it('should return all consents for a lead', async () => {
      const consents = [
        buildGdprConsent({ consentType: 'marketing_email', revokedAt: null }),
        buildGdprConsent({ consentType: 'data_processing', revokedAt: new Date() }),
      ];
      mockPrisma.gdprConsent.findMany.mockResolvedValue(consents);

      const result = await checkConsent('lead_1');
      expect(result).toHaveLength(2);
      expect(result[0].isActive).toBe(true);
      expect(result[1].isActive).toBe(false);
    });

    it('should return empty array when no consents exist', async () => {
      mockPrisma.gdprConsent.findMany.mockResolvedValue([]);

      const result = await checkConsent('lead_1');
      expect(result).toEqual([]);
    });
  });

  describe('exportLeadData', () => {
    it('should export all lead data', async () => {
      const lead = {
        ...buildLead({ id: 'lead_1' }),
        messages: [],
        groupMembers: [],
        sequenceEnrollments: [],
        emailVerifications: [],
        unsubscribeRecords: [],
        gdprConsents: [],
      };
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const result = await exportLeadData('lead_1');
      expect(result).toBeDefined();
      expect(result!.personalData.id).toBe('lead_1');
      expect(result!.exportedAt).toBeDefined();
    });

    it('should return null when lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const result = await exportLeadData('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteLeadData', () => {
    it('should delete all lead data including calendar bookings and send time preferences', async () => {
      mockPrisma.calendarBooking.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.sendTimePreference.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.gdprConsent.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.unsubscribeRecord.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerification.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.groupMember.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.sequenceEnrollment.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.lead.delete.mockResolvedValue(buildLead({ id: 'lead_1' }));

      const result = await deleteLeadData('lead_1');
      expect(result.deleted).toBe(true);
      expect(result.leadId).toBe('lead_1');
      expect(mockPrisma.calendarBooking.deleteMany).toHaveBeenCalledWith({ where: { leadId: 'lead_1' } });
      expect(mockPrisma.sendTimePreference.deleteMany).toHaveBeenCalledWith({ where: { leadId: 'lead_1' } });
      expect(mockPrisma.lead.delete).toHaveBeenCalledWith({ where: { id: 'lead_1' } });
    });
  });
});
