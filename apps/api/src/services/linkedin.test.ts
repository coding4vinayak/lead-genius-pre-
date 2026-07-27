import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildLinkedInProfile, buildLinkedInMessage } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const { sendConnectionRequest, sendLinkedInMessage, viewProfile, getProfile, updateProfile, listConnections, updateConnectionStatus } = await import('./linkedin.js');

describe('LinkedIn Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendConnectionRequest', () => {
    it('should create a pending connection request', async () => {
      const lead = buildLead();
      const profile = buildLinkedInProfile({ leadId: lead.id, connectionStatus: 'pending', connectionRequestedAt: new Date() });

      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);
      mockPrisma.linkedInProfile.upsert.mockResolvedValue(profile);

      const result = await sendConnectionRequest(lead.id, 'Hi, lets connect');
      expect(result).toEqual(profile);
      expect(mockPrisma.linkedInProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { leadId: lead.id },
          create: expect.objectContaining({ connectionStatus: 'pending' }),
          update: expect.objectContaining({ connectionStatus: 'pending' }),
        }),
      );
    });

    it('should throw if lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);
      await expect(sendConnectionRequest('nonexistent')).rejects.toThrow('Lead not found');
    });

    it('should throw if already connected', async () => {
      const lead = buildLead();
      const profile = buildLinkedInProfile({ leadId: lead.id, connectionStatus: 'connected' });

      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(profile);

      await expect(sendConnectionRequest(lead.id)).rejects.toThrow('Already connected');
    });
  });

  describe('sendLinkedInMessage', () => {
    it('should send message when connected', async () => {
      const profile = buildLinkedInProfile({ connectionStatus: 'connected' });
      const message = buildLinkedInMessage({ profileId: profile.id });

      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.linkedInMessage.create.mockResolvedValue(message);
      mockPrisma.linkedInProfile.update.mockResolvedValue(profile);

      const result = await sendLinkedInMessage('lead_1', 'Hello there');
      expect(result).toEqual(message);
      expect(mockPrisma.linkedInMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ body: 'Hello there', direction: 'outbound' }),
        }),
      );
    });

    it('should throw if not connected', async () => {
      const profile = buildLinkedInProfile({ connectionStatus: 'pending' });
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(profile);

      await expect(sendLinkedInMessage('lead_1', 'Hi')).rejects.toThrow('not connected');
    });

    it('should throw if no profile exists', async () => {
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);
      await expect(sendLinkedInMessage('lead_1', 'Hi')).rejects.toThrow('LinkedIn profile not found');
    });
  });

  describe('viewProfile', () => {
    it('should upsert profile and log activity', async () => {
      const lead = buildLead();
      const profile = buildLinkedInProfile({ leadId: lead.id });

      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.linkedInProfile.upsert.mockResolvedValue(profile);

      const result = await viewProfile(lead.id);
      expect(result).toEqual(profile);
      expect(mockPrisma.linkedInProfile.upsert).toHaveBeenCalled();
    });

    it('should throw if lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);
      await expect(viewProfile('nonexistent')).rejects.toThrow('Lead not found');
    });
  });

  describe('getProfile', () => {
    it('should return profile with messages', async () => {
      const profile = buildLinkedInProfile();
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue({ ...profile, messages: [] });

      const result = await getProfile('lead_1');
      expect(result).toBeDefined();
    });

    it('should return null if no profile', async () => {
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);
      const result = await getProfile('lead_1');
      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields', async () => {
      const profile = buildLinkedInProfile();
      const updated = { ...profile, profileUrl: 'https://linkedin.com/in/updated' };

      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.linkedInProfile.update.mockResolvedValue(updated);

      const result = await updateProfile('lead_1', { profileUrl: 'https://linkedin.com/in/updated' });
      expect(result).toEqual(updated);
    });

    it('should throw if no profile exists', async () => {
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);
      await expect(updateProfile('lead_1', { profileUrl: 'https://linkedin.com/in/x' })).rejects.toThrow('LinkedIn profile not found');
    });
  });

  describe('listConnections', () => {
    it('should return paginated connections', async () => {
      const profiles = [buildLinkedInProfile(), buildLinkedInProfile()];
      mockPrisma.linkedInProfile.findMany.mockResolvedValue(profiles);
      mockPrisma.linkedInProfile.count.mockResolvedValue(2);

      const result = await listConnections(undefined, 1, 50);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrisma.linkedInProfile.findMany.mockResolvedValue([]);
      mockPrisma.linkedInProfile.count.mockResolvedValue(0);

      await listConnections('pending', 1, 50);
      expect(mockPrisma.linkedInProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { connectionStatus: 'pending' } }),
      );
    });
  });

  describe('updateConnectionStatus', () => {
    it('should update status to connected', async () => {
      const profile = buildLinkedInProfile({ connectionStatus: 'pending' });
      const updated = { ...profile, connectionStatus: 'connected', connectedAt: new Date() };

      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.linkedInProfile.update.mockResolvedValue(updated);

      const result = await updateConnectionStatus('lead_1', 'connected');
      expect(result).toEqual(updated);
      expect(mockPrisma.linkedInProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ connectionStatus: 'connected' }),
        }),
      );
    });

    it('should throw if no profile exists', async () => {
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);
      await expect(updateConnectionStatus('lead_1', 'connected')).rejects.toThrow('LinkedIn profile not found');
    });
  });
});
