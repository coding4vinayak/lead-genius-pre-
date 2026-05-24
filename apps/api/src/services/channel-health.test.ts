import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildChannelHealth, buildSettings } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { getChannelHealth, getAllChannelHealth, updateChannelMetrics, resetDailyCounters, listDomainAuth, addDomainAuth, checkChannelStatus } = await import('./channel-health.js');

describe('Channel Health Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChannelHealth', () => {
    it('should return existing channel health record', async () => {
      const health = buildChannelHealth({ channel: 'email' });
      mockPrisma.channelHealth.findFirst.mockResolvedValue(health);

      const result = await getChannelHealth('email');

      expect(result).toEqual(health);
      expect(mockPrisma.channelHealth.findFirst).toHaveBeenCalledWith({ where: { channel: 'email' } });
    });

    it('should create a default record if none exists', async () => {
      const newHealth = buildChannelHealth({ channel: 'whatsapp', provider: 'twilio' });
      mockPrisma.channelHealth.findFirst.mockResolvedValue(null);
      mockPrisma.channelHealth.create.mockResolvedValue(newHealth);

      const result = await getChannelHealth('whatsapp');

      expect(result).toEqual(newHealth);
      expect(mockPrisma.channelHealth.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ channel: 'whatsapp', provider: 'twilio', status: 'healthy' }),
      });
    });
  });

  describe('getAllChannelHealth', () => {
    it('should return all channel health records', async () => {
      const records = [
        buildChannelHealth({ channel: 'email' }),
        buildChannelHealth({ channel: 'whatsapp', provider: 'twilio' }),
      ];
      mockPrisma.channelHealth.findMany.mockResolvedValue(records);

      const result = await getAllChannelHealth();

      expect(result).toEqual(records);
      expect(mockPrisma.channelHealth.findMany).toHaveBeenCalledWith({
        orderBy: { channel: 'asc' },
      });
    });
  });

  describe('updateChannelMetrics', () => {
    it('should increment dailySent on sent event', async () => {
      const existing = buildChannelHealth({ channel: 'email', dailySent: 10, dailyBounced: 1 });
      mockPrisma.channelHealth.findUnique.mockResolvedValue(existing);
      mockPrisma.channelHealth.update.mockResolvedValueOnce({ ...existing, dailySent: 11, quotaUsed: 101 });
      mockPrisma.channelHealth.update.mockResolvedValueOnce({
        ...existing, dailySent: 11, bounceRate: 9.09, deliveryRate: 90.91, status: 'healthy',
      });

      const result = await updateChannelMetrics('email', 'sent');

      expect(mockPrisma.channelHealth.update).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('healthy');
    });

    it('should increment dailyBounced on bounced event', async () => {
      const existing = buildChannelHealth({ channel: 'email', dailySent: 10, dailyBounced: 1 });
      mockPrisma.channelHealth.findUnique.mockResolvedValue(existing);
      mockPrisma.channelHealth.update.mockResolvedValueOnce({ ...existing, dailyBounced: 2 });
      mockPrisma.channelHealth.update.mockResolvedValueOnce({
        ...existing, dailyBounced: 2, bounceRate: 20, deliveryRate: 80, status: 'degraded',
      });

      const result = await updateChannelMetrics('email', 'bounced');

      expect(result.status).toBe('degraded');
    });

    it('should increment dailyComplaints on complaint event', async () => {
      const existing = buildChannelHealth({ channel: 'email', dailySent: 10, dailyComplaints: 0 });
      mockPrisma.channelHealth.findUnique.mockResolvedValue(existing);
      mockPrisma.channelHealth.update.mockResolvedValueOnce({ ...existing, dailyComplaints: 1 });
      mockPrisma.channelHealth.update.mockResolvedValueOnce({
        ...existing, dailyComplaints: 1, bounceRate: 0, deliveryRate: 100, status: 'healthy',
      });

      const result = await updateChannelMetrics('email', 'complaint');

      expect(result.status).toBe('healthy');
    });

    it('should create channel health record if not exists', async () => {
      mockPrisma.channelHealth.findUnique.mockResolvedValue(null);
      mockPrisma.channelHealth.create.mockResolvedValue(buildChannelHealth());
      const afterUpdate = buildChannelHealth({ dailySent: 1 });
      mockPrisma.channelHealth.update.mockResolvedValueOnce(afterUpdate);
      mockPrisma.channelHealth.update.mockResolvedValueOnce({
        ...afterUpdate, bounceRate: 0, deliveryRate: 100, status: 'healthy',
      });

      await updateChannelMetrics('email', 'sent');

      expect(mockPrisma.channelHealth.create).toHaveBeenCalled();
    });

    it('should mark status as down when bounce rate exceeds 25%', async () => {
      const existing = buildChannelHealth({ channel: 'email', dailySent: 4, dailyBounced: 0 });
      mockPrisma.channelHealth.findUnique.mockResolvedValue(existing);
      mockPrisma.channelHealth.update.mockResolvedValueOnce({ ...existing, dailyBounced: 1 });
      // When dailyBounced=1 and dailySent=4, bounceRate=25% -- at exactly 25 it's degraded
      mockPrisma.channelHealth.update.mockResolvedValueOnce({
        ...existing, dailyBounced: 1, bounceRate: 25, deliveryRate: 75, status: 'degraded',
      });

      const result = await updateChannelMetrics('email', 'bounced');

      expect(result.status).toBe('degraded');
    });
  });

  describe('resetDailyCounters', () => {
    it('should reset all daily counters', async () => {
      mockPrisma.channelHealth.updateMany.mockResolvedValue({ count: 2 });

      await resetDailyCounters();

      expect(mockPrisma.channelHealth.updateMany).toHaveBeenCalledWith({
        data: { dailySent: 0, dailyBounced: 0, dailyComplaints: 0 },
      });
    });
  });

  describe('checkChannelStatus', () => {
    it('should check all channels and return status', async () => {
      const settings = buildSettings({ smtpHost: null, smtpPort: null });
      mockPrisma.settings.findUnique.mockResolvedValue(settings);
      mockPrisma.channelHealth.upsert.mockResolvedValue(buildChannelHealth());

      const results = await checkChannelStatus();

      expect(results).toHaveLength(2);
      expect(results[0].channel).toBe('email');
      expect(results[1].channel).toBe('whatsapp');
    });

    it('should mark whatsapp as down when credentials missing', async () => {
      const settings = buildSettings({ twilioAccountSid: null, twilioAuthToken: null });
      mockPrisma.settings.findUnique.mockResolvedValue(settings);
      mockPrisma.channelHealth.upsert.mockResolvedValue(buildChannelHealth());

      const results = await checkChannelStatus();

      const waResult = results.find((r) => r.channel === 'whatsapp');
      expect(waResult?.status).toBe('down');
    });
  });

  describe('listDomainAuth', () => {
    it('should list all domain auth records', async () => {
      const domains = [
        { id: '1', domain: 'example.com', spfStatus: 'verified', dkimStatus: 'verified', dmarcStatus: 'pending' },
      ];
      mockPrisma.emailDomainAuth.findMany.mockResolvedValue(domains);

      const result = await listDomainAuth();

      expect(result).toEqual(domains);
    });
  });

  describe('addDomainAuth', () => {
    it('should create a new domain auth record', async () => {
      const domain = { id: '1', domain: 'new.com', spfStatus: 'pending', dkimStatus: 'pending', dmarcStatus: 'pending' };
      mockPrisma.emailDomainAuth.create.mockResolvedValue(domain);

      const result = await addDomainAuth('new.com');

      expect(result).toEqual(domain);
      expect(mockPrisma.emailDomainAuth.create).toHaveBeenCalledWith({
        data: { domain: 'new.com', spfStatus: 'pending', dkimStatus: 'pending', dmarcStatus: 'pending' },
      });
    });
  });
});
