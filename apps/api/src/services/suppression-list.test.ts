import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSuppressionEntry } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { addToSuppression, removeFromSuppression, isEmailSuppressed, importSuppressionList, exportSuppressionList, getSuppressionList, removeSuppressionById } = await import('./suppression-list.js');

describe('Suppression List Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addToSuppression', () => {
    it('should add an email to suppression list', async () => {
      const entry = buildSuppressionEntry({ email: 'bounce@test.com', reason: 'bounce' });
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(entry);

      const result = await addToSuppression('bounce@test.com', 'bounce', 'system');
      expect(result.email).toBe('bounce@test.com');
      expect(result.reason).toBe('bounce');
      expect(mockPrisma.suppressionEntry.upsert).toHaveBeenCalledOnce();
    });

    it('should upsert with campaignId', async () => {
      const entry = buildSuppressionEntry({ campaignId: 'camp_1' });
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(entry);

      await addToSuppression('test@test.com', 'complaint', 'campaign', 'camp_1');
      expect(mockPrisma.suppressionEntry.upsert.mock.calls[0][0].create.campaignId).toBe('camp_1');
    });
  });

  describe('removeFromSuppression', () => {
    it('should remove all entries for an email', async () => {
      mockPrisma.suppressionEntry.deleteMany.mockResolvedValue({ count: 2 });

      const result = await removeFromSuppression('test@test.com');
      expect(result.count).toBe(2);
    });
  });

  describe('isEmailSuppressed', () => {
    it('should return true when email is in suppression list', async () => {
      mockPrisma.suppressionEntry.count.mockResolvedValue(1);

      const result = await isEmailSuppressed('suppressed@test.com');
      expect(result).toBe(true);
    });

    it('should return false when email is not suppressed', async () => {
      mockPrisma.suppressionEntry.count.mockResolvedValue(0);

      const result = await isEmailSuppressed('clean@test.com');
      expect(result).toBe(false);
    });
  });

  describe('importSuppressionList', () => {
    it('should import multiple entries', async () => {
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(buildSuppressionEntry());

      const result = await importSuppressionList([
        { email: 'a@test.com', reason: 'bounce' },
        { email: 'b@test.com', reason: 'complaint' },
      ]);
      expect(result.imported).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should handle failures gracefully', async () => {
      mockPrisma.suppressionEntry.upsert
        .mockResolvedValueOnce(buildSuppressionEntry())
        .mockRejectedValueOnce(new Error('DB error'));

      const result = await importSuppressionList([
        { email: 'a@test.com', reason: 'bounce' },
        { email: 'b@test.com', reason: 'bounce' },
      ]);
      expect(result.imported).toBe(1);
      expect(result.total).toBe(2);
    });
  });

  describe('exportSuppressionList', () => {
    it('should return all suppression entries', async () => {
      const entries = [buildSuppressionEntry(), buildSuppressionEntry()];
      mockPrisma.suppressionEntry.findMany.mockResolvedValue(entries);

      const result = await exportSuppressionList();
      expect(result).toHaveLength(2);
    });
  });

  describe('getSuppressionList', () => {
    it('should return paginated results', async () => {
      const entries = [buildSuppressionEntry()];
      mockPrisma.suppressionEntry.findMany.mockResolvedValue(entries);
      mockPrisma.suppressionEntry.count.mockResolvedValue(1);

      const result = await getSuppressionList(1, 50);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('removeSuppressionById', () => {
    it('should delete a specific entry by id', async () => {
      const entry = buildSuppressionEntry({ id: 'sup_123' });
      mockPrisma.suppressionEntry.delete.mockResolvedValue(entry);

      const result = await removeSuppressionById('sup_123');
      expect(result.id).toBe('sup_123');
    });
  });
});
