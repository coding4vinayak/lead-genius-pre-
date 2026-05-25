import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWorkspace, buildUsageRecord } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  trackUsage,
  getUsage,
  getDailyUsage,
  getMonthlyUsage,
  checkQuota,
  getPlanLimits,
} = await import('./usage-metering.js');

describe('Usage Metering Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPlanLimits', () => {
    it('should return free plan limits', () => {
      const limits = getPlanLimits('free');
      expect(limits.emails_sent).toBe(100);
      expect(limits.contacts_stored).toBe(500);
    });

    it('should return pro plan limits', () => {
      const limits = getPlanLimits('pro');
      expect(limits.emails_sent).toBe(5000);
      expect(limits.contacts_stored).toBe(10000);
    });

    it('should return enterprise plan limits (unlimited)', () => {
      const limits = getPlanLimits('enterprise');
      expect(limits.emails_sent).toBe(Infinity);
    });

    it('should default to free plan for unknown plan', () => {
      const limits = getPlanLimits('unknown');
      expect(limits.emails_sent).toBe(100);
    });
  });

  describe('trackUsage', () => {
    it('should create new usage record if none exists', async () => {
      const record = buildUsageRecord({ value: 1 });
      mockPrisma.usageRecord.findFirst.mockResolvedValue(null);
      mockPrisma.usageRecord.create.mockResolvedValue(record);

      const result = await trackUsage('ws_1', 'emails_sent', 1);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          metric: 'emails_sent',
          value: 1,
          period: 'monthly',
        }),
      });
      expect(result).toEqual(record);
    });

    it('should increment existing usage record', async () => {
      const existing = buildUsageRecord({ value: 50 });
      const updated = { ...existing, value: 51 };
      mockPrisma.usageRecord.findFirst.mockResolvedValue(existing);
      mockPrisma.usageRecord.update.mockResolvedValue(updated);

      const result = await trackUsage('ws_1', 'emails_sent', 1);

      expect(mockPrisma.usageRecord.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { value: 51 },
      });
      expect(result).toEqual(updated);
    });

    it('should increment by custom amount', async () => {
      const existing = buildUsageRecord({ value: 10 });
      const updated = { ...existing, value: 15 };
      mockPrisma.usageRecord.findFirst.mockResolvedValue(existing);
      mockPrisma.usageRecord.update.mockResolvedValue(updated);

      const result = await trackUsage('ws_1', 'contacts_stored', 5);

      expect(mockPrisma.usageRecord.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { value: 15 },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('getUsage', () => {
    it('should return usage for monthly period', async () => {
      const records = [
        buildUsageRecord({ metric: 'emails_sent', value: 50 }),
        buildUsageRecord({ metric: 'contacts_stored', value: 200 }),
      ];
      mockPrisma.usageRecord.findMany.mockResolvedValue(records);

      const result = await getUsage('ws_1', 'monthly');

      expect(result.emails_sent).toBe(50);
      expect(result.contacts_stored).toBe(200);
    });

    it('should return zeros for empty usage', async () => {
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const result = await getUsage('ws_1', 'monthly');

      expect(result.emails_sent).toBe(0);
      expect(result.contacts_stored).toBe(0);
      expect(result.sequences_active).toBe(0);
      expect(result.team_members).toBe(0);
    });
  });

  describe('getDailyUsage', () => {
    it('should call getUsage with daily period', async () => {
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const result = await getDailyUsage('ws_1');

      expect(result).toHaveProperty('emails_sent', 0);
    });
  });

  describe('getMonthlyUsage', () => {
    it('should call getUsage with monthly period', async () => {
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const result = await getMonthlyUsage('ws_1');

      expect(result).toHaveProperty('emails_sent', 0);
    });
  });

  describe('checkQuota', () => {
    it('should return within limit for free plan under quota', async () => {
      const workspace = buildWorkspace({ plan: 'free' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        buildUsageRecord({ metric: 'emails_sent', value: 50 }),
      ]);

      const result = await checkQuota(workspace.id, 'emails_sent');

      expect(result.withinLimit).toBe(true);
      expect(result.current).toBe(50);
      expect(result.limit).toBe(100);
    });

    it('should return over limit for free plan exceeding quota', async () => {
      const workspace = buildWorkspace({ plan: 'free' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        buildUsageRecord({ metric: 'emails_sent', value: 100 }),
      ]);

      const result = await checkQuota(workspace.id, 'emails_sent');

      expect(result.withinLimit).toBe(false);
      expect(result.current).toBe(100);
      expect(result.limit).toBe(100);
    });

    it('should return within limit for enterprise (unlimited)', async () => {
      const workspace = buildWorkspace({ plan: 'enterprise' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const result = await checkQuota(workspace.id, 'emails_sent');

      expect(result.withinLimit).toBe(true);
      expect(result.limit).toBe(-1);
    });

    it('should return false for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      const result = await checkQuota('nonexistent', 'emails_sent');

      expect(result.withinLimit).toBe(false);
    });
  });
});
