import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSendTimePreference, buildMessage } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  recordOpenTime,
  getOptimalSendTime,
  getOptimalTimeForTimezone,
  scheduleOptimalSend,
} = await import('./send-time-optimizer.js');

describe('Send Time Optimizer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordOpenTime', () => {
    it('should create preference for new lead', async () => {
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(null);
      const pref = buildSendTimePreference({ dataPoints: 1, openCount: 1 });
      mockPrisma.sendTimePreference.create.mockResolvedValue(pref);

      const result = await recordOpenTime('lead_1', new Date('2025-01-15T14:00:00Z'));

      expect(mockPrisma.sendTimePreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leadId: 'lead_1',
          preferredHour: 14,
          preferredDay: 3,
          openCount: 1,
          dataPoints: 1,
        }),
      });
      expect(result).toBeDefined();
    });

    it('should update existing preference with weighted average', async () => {
      const existing = buildSendTimePreference({ preferredHour: 10, preferredDay: 2, dataPoints: 4 });
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(existing);
      mockPrisma.sendTimePreference.update.mockResolvedValue({ ...existing, dataPoints: 5 });

      const result = await recordOpenTime('lead_1', new Date('2025-01-15T14:00:00Z'));

      expect(mockPrisma.sendTimePreference.update).toHaveBeenCalledWith({
        where: { leadId: 'lead_1' },
        data: expect.objectContaining({
          openCount: { increment: 1 },
          dataPoints: 5,
        }),
      });
      expect(result).toBeDefined();
    });
  });

  describe('getOptimalSendTime', () => {
    it('should return default when no preference exists', async () => {
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(null);

      const result = await getOptimalSendTime('lead_1');

      expect(result.hour).toBe(10);
      expect(result.day).toBe(2);
      expect(result.confidence).toBe('low');
    });

    it('should return default when insufficient data', async () => {
      const pref = buildSendTimePreference({ dataPoints: 2 });
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(pref);

      const result = await getOptimalSendTime('lead_1');

      expect(result.confidence).toBe('low');
    });

    it('should return high confidence when enough data', async () => {
      const pref = buildSendTimePreference({ preferredHour: 14, preferredDay: 3, dataPoints: 15 });
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(pref);

      const result = await getOptimalSendTime('lead_1');

      expect(result.hour).toBe(14);
      expect(result.day).toBe(3);
      expect(result.confidence).toBe('high');
      expect(result.dataPoints).toBe(15);
    });

    it('should return medium confidence with moderate data', async () => {
      const pref = buildSendTimePreference({ preferredHour: 11, preferredDay: 1, dataPoints: 5 });
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(pref);

      const result = await getOptimalSendTime('lead_1');

      expect(result.confidence).toBe('medium');
    });
  });

  describe('getOptimalTimeForTimezone', () => {
    it('should return default when no data exists', async () => {
      mockPrisma.sendTimePreference.findMany.mockResolvedValue([]);

      const result = await getOptimalTimeForTimezone('America/New_York');

      expect(result.hour).toBe(10);
      expect(result.day).toBe(2);
      expect(result.confidence).toBe('low');
      expect(result.sampleSize).toBe(0);
    });

    it('should aggregate across all leads in timezone', async () => {
      const prefs = [
        buildSendTimePreference({ preferredHour: 9, preferredDay: 1 }),
        buildSendTimePreference({ preferredHour: 11, preferredDay: 3 }),
      ];
      mockPrisma.sendTimePreference.findMany.mockResolvedValue(prefs);

      const result = await getOptimalTimeForTimezone('America/New_York');

      expect(result.hour).toBe(10);
      expect(result.day).toBe(2);
      expect(result.sampleSize).toBe(2);
    });

    it('should return high confidence with many samples', async () => {
      const prefs = Array.from({ length: 12 }, (_, i) =>
        buildSendTimePreference({ preferredHour: 10 + (i % 3), preferredDay: 2 })
      );
      mockPrisma.sendTimePreference.findMany.mockResolvedValue(prefs);

      const result = await getOptimalTimeForTimezone('UTC');

      expect(result.confidence).toBe('high');
    });
  });

  describe('scheduleOptimalSend', () => {
    it('should schedule a message at optimal time', async () => {
      const message = buildMessage();
      mockPrisma.message.findUnique.mockResolvedValue(message);
      mockPrisma.sendTimePreference.findUnique.mockResolvedValue(
        buildSendTimePreference({ preferredHour: 10, preferredDay: 2, dataPoints: 10 })
      );

      const result = await scheduleOptimalSend(message.id, 'lead_1');

      expect(result.messageId).toBe(message.id);
      expect(result.leadId).toBe('lead_1');
      expect(result.scheduledFor).toBeDefined();
      expect(result.delayMs).toBeGreaterThanOrEqual(0);
      expect(result.optimal).toBeDefined();
    });

    it('should throw if message not found', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(scheduleOptimalSend('nonexistent', 'lead_1')).rejects.toThrow('not found');
    });
  });
});
