import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildEmailAccount, buildAccountRotationConfig } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  createAccount,
  updateAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  testConnection,
  getAccountHealth,
  resetDailyCounts,
  selectNextAccount,
} = await import('./email-accounts.js');

describe('Email Accounts Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create an email account', async () => {
      const account = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);
      mockPrisma.emailAccount.create.mockResolvedValue(account);

      const result = await createAccount({ email: 'sender@example.com', name: 'Main Sender' });

      expect(mockPrisma.emailAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'sender@example.com',
          name: 'Main Sender',
          dailyLimit: 100,
          isActive: true,
        }),
      });
      expect(result).toEqual(account);
    });

    it('should throw conflict if account already exists', async () => {
      const existing = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(existing);

      await expect(createAccount({ email: 'sender@example.com' })).rejects.toThrow('already exists');
    });
  });

  describe('updateAccount', () => {
    it('should update an existing account', async () => {
      const account = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.update.mockResolvedValue({ ...account, name: 'Updated' });

      const result = await updateAccount(account.id, { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw not found if account does not exist', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      await expect(updateAccount('nonexistent', { name: 'Test' })).rejects.toThrow('not found');
    });
  });

  describe('deleteAccount', () => {
    it('should delete an existing account', async () => {
      const account = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);
      mockPrisma.emailAccount.delete.mockResolvedValue(account);

      const result = await deleteAccount(account.id);

      expect(result).toEqual(account);
      expect(mockPrisma.emailAccount.delete).toHaveBeenCalledWith({ where: { id: account.id } });
    });

    it('should throw not found if account does not exist', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      await expect(deleteAccount('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getAccount', () => {
    it('should return an account by id', async () => {
      const account = buildEmailAccount();
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);

      const result = await getAccount(account.id);

      expect(result).toEqual(account);
    });

    it('should throw not found if account does not exist', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      await expect(getAccount('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('listAccounts', () => {
    it('should return paginated accounts', async () => {
      const accounts = [buildEmailAccount(), buildEmailAccount()];
      mockPrisma.emailAccount.findMany.mockResolvedValue(accounts);
      mockPrisma.emailAccount.count.mockResolvedValue(2);

      const result = await listAccounts(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('testConnection', () => {
    it('should return success for SMTP configured account', async () => {
      const account = buildEmailAccount({ smtpHost: 'smtp.example.com', smtpPort: 587 });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);

      const result = await testConnection(account.id);

      expect(result.success).toBe(true);
      expect(result.message).toContain('SMTP');
    });

    it('should return success for SendGrid configured account', async () => {
      const account = buildEmailAccount({ smtpHost: null, sendgridApiKey: 'sg_key' });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);

      const result = await testConnection(account.id);

      expect(result.success).toBe(true);
      expect(result.message).toContain('SendGrid');
    });

    it('should return failure if no configuration', async () => {
      const account = buildEmailAccount({ smtpHost: null, sendgridApiKey: null });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);

      const result = await testConnection(account.id);

      expect(result.success).toBe(false);
    });

    it('should throw not found if account does not exist', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      await expect(testConnection('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getAccountHealth', () => {
    it('should return health metrics', async () => {
      const account = buildEmailAccount({ sentToday: 50, dailyLimit: 100, reputationScore: 95, bounceRate: 2 });
      mockPrisma.emailAccount.findUnique.mockResolvedValue(account);

      const result = await getAccountHealth(account.id);

      expect(result.remainingToday).toBe(50);
      expect(result.reputationScore).toBe(95);
      expect(result.bounceRate).toBe(2);
    });

    it('should throw not found if account does not exist', async () => {
      mockPrisma.emailAccount.findUnique.mockResolvedValue(null);

      await expect(getAccountHealth('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('resetDailyCounts', () => {
    it('should reset sentToday for all accounts', async () => {
      mockPrisma.emailAccount.updateMany.mockResolvedValue({ count: 3 });

      await resetDailyCounts();

      expect(mockPrisma.emailAccount.updateMany).toHaveBeenCalledWith({
        data: expect.objectContaining({ sentToday: 0 }),
      });
    });
  });

  describe('selectNextAccount', () => {
    it('should return null if no accounts exist', async () => {
      mockPrisma.accountRotationConfig.findFirst.mockResolvedValue(null);
      mockPrisma.emailAccount.findMany.mockResolvedValue([]);

      const result = await selectNextAccount('round_robin');

      expect(result).toBeNull();
    });

    it('should skip accounts at daily limit', async () => {
      const config = buildAccountRotationConfig({ skipOnDailyLimit: true });
      mockPrisma.accountRotationConfig.findFirst.mockResolvedValue(config);
      mockPrisma.emailAccount.findMany.mockResolvedValue([
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', sentToday: 100, dailyLimit: 100, bounceRate: 0 }),
        buildEmailAccount({ id: 'ea_2', email: 'b@test.com', sentToday: 10, dailyLimit: 100, bounceRate: 0 }),
      ]);

      const result = await selectNextAccount('round_robin');

      expect(result).toEqual({ id: 'ea_2', email: 'b@test.com' });
    });

    it('should skip accounts with high bounce rate', async () => {
      const config = buildAccountRotationConfig({ skipOnHighBounce: true, bounceThreshold: 10 });
      mockPrisma.accountRotationConfig.findFirst.mockResolvedValue(config);
      mockPrisma.emailAccount.findMany.mockResolvedValue([
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', sentToday: 0, dailyLimit: 100, bounceRate: 15 }),
        buildEmailAccount({ id: 'ea_2', email: 'b@test.com', sentToday: 0, dailyLimit: 100, bounceRate: 2 }),
      ]);

      const result = await selectNextAccount('round_robin');

      expect(result).toEqual({ id: 'ea_2', email: 'b@test.com' });
    });

    it('should return null if all accounts are ineligible', async () => {
      const config = buildAccountRotationConfig({ skipOnDailyLimit: true });
      mockPrisma.accountRotationConfig.findFirst.mockResolvedValue(config);
      mockPrisma.emailAccount.findMany.mockResolvedValue([
        buildEmailAccount({ id: 'ea_1', sentToday: 100, dailyLimit: 100, bounceRate: 0 }),
      ]);

      const result = await selectNextAccount('round_robin');

      expect(result).toBeNull();
    });

    it('should use failover strategy - first available', async () => {
      const config = buildAccountRotationConfig({ strategy: 'failover' });
      mockPrisma.accountRotationConfig.findFirst.mockResolvedValue(config);
      mockPrisma.emailAccount.findMany.mockResolvedValue([
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', sentToday: 50, dailyLimit: 100, bounceRate: 0 }),
        buildEmailAccount({ id: 'ea_2', email: 'b@test.com', sentToday: 0, dailyLimit: 100, bounceRate: 0 }),
      ]);

      const result = await selectNextAccount('failover');

      expect(result).toEqual({ id: 'ea_1', email: 'a@test.com' });
    });

    it('should use round-robin strategy - least sent', async () => {
      mockPrisma.accountRotationConfig.findFirst.mockResolvedValue(null);
      mockPrisma.emailAccount.findMany.mockResolvedValue([
        buildEmailAccount({ id: 'ea_1', email: 'a@test.com', sentToday: 50, dailyLimit: 100, bounceRate: 0 }),
        buildEmailAccount({ id: 'ea_2', email: 'b@test.com', sentToday: 10, dailyLimit: 100, bounceRate: 0 }),
      ]);

      const result = await selectNextAccount('round_robin');

      expect(result).toEqual({ id: 'ea_2', email: 'b@test.com' });
    });
  });
});
