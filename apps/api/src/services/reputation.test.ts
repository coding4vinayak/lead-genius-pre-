import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildEmailAccount } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  calculateReputationScore,
  getReputationDashboard,
  checkReputationAlerts,
} = await import('./reputation.js');

describe('Reputation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateReputationScore', () => {
    it('should return 100 for accounts with low bounce rate', async () => {
      const account = buildEmailAccount({ bounceRate: 1 });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.update.mockResolvedValue({ ...account, reputationScore: 100 });

      const result = await calculateReputationScore(account.id);

      expect(result.reputationScore).toBe(100);
    });

    it('should subtract 10 for bounce rate 2-5%', async () => {
      const account = buildEmailAccount({ bounceRate: 3 });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.update.mockResolvedValue({ ...account, reputationScore: 90 });

      const result = await calculateReputationScore(account.id);

      expect(result.reputationScore).toBe(90);
    });

    it('should subtract 30 for bounce rate 5-10%', async () => {
      const account = buildEmailAccount({ bounceRate: 7 });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.update.mockResolvedValue({ ...account, reputationScore: 70 });

      const result = await calculateReputationScore(account.id);

      expect(result.reputationScore).toBe(70);
    });

    it('should subtract 50 for bounce rate >10%', async () => {
      const account = buildEmailAccount({ bounceRate: 15 });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.update.mockResolvedValue({ ...account, reputationScore: 50 });

      const result = await calculateReputationScore(account.id);

      expect(result.reputationScore).toBe(50);
    });

    it('should throw not found if account does not exist', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      await expect(calculateReputationScore('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getReputationDashboard', () => {
    it('should return dashboard with all accounts', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 95, bounceRate: 1, isActive: true }),
        buildEmailAccount({ id: 'ea_2', email: 'b@test.com', reputationScore: 70, bounceRate: 6, isActive: true }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const result = await getReputationDashboard();

      expect(result.accounts).toHaveLength(2);
      expect(result.summary.totalAccounts).toBe(2);
      expect(result.summary.activeAccounts).toBe(2);
      expect(result.summary.averageScore).toBe(82.5);
    });

    it('should return empty dashboard when no accounts exist', async () => {
      mockPrisma.emailAccount.findMany.mockResolvedValue([]);

      const result = await getReputationDashboard();

      expect(result.accounts).toHaveLength(0);
      expect(result.summary.totalAccounts).toBe(0);
      expect(result.summary.averageScore).toBe(0);
    });
  });

  describe('checkReputationAlerts', () => {
    it('should return critical alert for low reputation score', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 40, bounceRate: 1, sentToday: 0, dailyLimit: 100, isActive: true }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const alerts = await checkReputationAlerts();

      expect(alerts.some(a => a.type === 'low_reputation' && a.severity === 'critical')).toBe(true);
    });

    it('should return warning for moderate reputation score', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 65, bounceRate: 1, sentToday: 0, dailyLimit: 100, isActive: true }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const alerts = await checkReputationAlerts();

      expect(alerts.some(a => a.type === 'low_reputation' && a.severity === 'warning')).toBe(true);
    });

    it('should return alert for high bounce rate', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 95, bounceRate: 12, sentToday: 0, dailyLimit: 100, isActive: true }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const alerts = await checkReputationAlerts();

      expect(alerts.some(a => a.type === 'high_bounce_rate' && a.severity === 'critical')).toBe(true);
    });

    it('should return alert when daily limit reached', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 95, bounceRate: 1, sentToday: 100, dailyLimit: 100, isActive: true }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const alerts = await checkReputationAlerts();

      expect(alerts.some(a => a.type === 'daily_limit_reached')).toBe(true);
    });

    it('should return no alerts for healthy accounts', async () => {
      const accounts = [
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', reputationScore: 95, bounceRate: 1, sentToday: 10, dailyLimit: 100, isActive: true }),
      ];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);

      const alerts = await checkReputationAlerts();

      expect(alerts).toHaveLength(0);
    });
  });
});
