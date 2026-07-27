import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWarmupSchedule } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { createWarmupSchedule, pauseWarmup, resumeWarmup, tickWarmup, canSendFromAccount, recordWarmupSend, recordWarmupBounce, getWarmupProgress } = await import('./warmup.js');

describe('Warmup Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default $transaction mock passes the mockPrisma itself to the callback
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));
  });

  describe('createWarmupSchedule', () => {
    it('should create a schedule with initial limit of 5', async () => {
      const schedule = buildWarmupSchedule();
      mockPrisma.warmupSchedule.create.mockResolvedValue(schedule);

      const result = await createWarmupSchedule('sender@example.com');

      expect(mockPrisma.warmupSchedule.create).toHaveBeenCalledWith({
        data: {
          accountEmail: 'sender@example.com',
          currentDailyLimit: 5,
          maxDailyLimit: 50,
          rampPercentage: 20,
          bounceThreshold: 5,
        },
      });
      expect(result).toEqual(schedule);
    });

    it('should accept custom config', async () => {
      const schedule = buildWarmupSchedule({ maxDailyLimit: 100, rampPercentage: 30 });
      mockPrisma.warmupSchedule.create.mockResolvedValue(schedule);

      await createWarmupSchedule('sender@example.com', { maxDailyLimit: 100, rampPercentage: 30, bounceThreshold: 10 });

      expect(mockPrisma.warmupSchedule.create).toHaveBeenCalledWith({
        data: {
          accountEmail: 'sender@example.com',
          currentDailyLimit: 5,
          maxDailyLimit: 100,
          rampPercentage: 30,
          bounceThreshold: 10,
        },
      });
    });
  });

  describe('pauseWarmup', () => {
    it('should pause a warming schedule', async () => {
      const schedule = buildWarmupSchedule({ status: 'warming' });
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupSchedule.update.mockResolvedValue({ ...schedule, status: 'paused', pausedReason: 'manual' });

      const result = await pauseWarmup(schedule.id);

      expect(result.status).toBe('paused');
    });

    it('should throw if schedule not found', async () => {
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(null);

      await expect(pauseWarmup('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw if schedule is completed', async () => {
      const schedule = buildWarmupSchedule({ status: 'completed' });
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);

      await expect(pauseWarmup(schedule.id)).rejects.toThrow('Cannot pause a completed schedule');
    });
  });

  describe('resumeWarmup', () => {
    it('should resume a paused schedule', async () => {
      const schedule = buildWarmupSchedule({ status: 'paused' });
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupSchedule.update.mockResolvedValue({ ...schedule, status: 'warming', pausedReason: null });

      const result = await resumeWarmup(schedule.id);

      expect(result.status).toBe('warming');
    });

    it('should throw if schedule is not paused', async () => {
      const schedule = buildWarmupSchedule({ status: 'warming' });
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);

      await expect(resumeWarmup(schedule.id)).rejects.toThrow('not paused');
    });
  });

  describe('tickWarmup', () => {
    it('should increase daily limit by ramp percentage', async () => {
      const schedule = buildWarmupSchedule({
        currentDay: 1,
        currentDailyLimit: 5,
        rampPercentage: 20,
        sentToday: 5,
        bouncedToday: 0,
        maxDailyLimit: 50,
      });
      mockPrisma.warmupSchedule.findMany.mockResolvedValue([schedule]);
      // Inside transaction: findUnique returns the schedule
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupLog.create.mockResolvedValue({});
      mockPrisma.warmupSchedule.update.mockResolvedValue({});

      await tickWarmup();

      expect(mockPrisma.warmupSchedule.update).toHaveBeenCalledWith({
        where: { id: schedule.id },
        data: {
          currentDay: 2,
          currentDailyLimit: 6, // ceil(5 * 1.2) = 6
          sentToday: 0,
          bouncedToday: 0,
          status: 'warming',
        },
      });
    });

    it('should auto-pause on high bounce rate', async () => {
      const schedule = buildWarmupSchedule({
        sentToday: 10,
        bouncedToday: 2, // 20% bounce rate, threshold is 5%
        bounceThreshold: 5,
      });
      mockPrisma.warmupSchedule.findMany.mockResolvedValue([schedule]);
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupSchedule.update.mockResolvedValue({});

      await tickWarmup();

      expect(mockPrisma.warmupSchedule.update).toHaveBeenCalledWith({
        where: { id: schedule.id },
        data: expect.objectContaining({
          status: 'paused',
          pausedReason: expect.stringContaining('Bounce rate'),
        }),
      });
    });

    it('should mark as completed when max limit reached', async () => {
      const schedule = buildWarmupSchedule({
        currentDay: 10,
        currentDailyLimit: 48,
        rampPercentage: 20,
        sentToday: 5,
        bouncedToday: 0,
        maxDailyLimit: 50,
      });
      mockPrisma.warmupSchedule.findMany.mockResolvedValue([schedule]);
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupLog.create.mockResolvedValue({});
      mockPrisma.warmupSchedule.update.mockResolvedValue({});

      await tickWarmup();

      expect(mockPrisma.warmupSchedule.update).toHaveBeenCalledWith({
        where: { id: schedule.id },
        data: expect.objectContaining({
          currentDailyLimit: 50, // capped at max
          status: 'completed',
        }),
      });
    });

    it('should log daily stats before advancing', async () => {
      const schedule = buildWarmupSchedule({
        currentDay: 3,
        sentToday: 8,
        bouncedToday: 0,
      });
      mockPrisma.warmupSchedule.findMany.mockResolvedValue([schedule]);
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupLog.create.mockResolvedValue({});
      mockPrisma.warmupSchedule.update.mockResolvedValue({});

      await tickWarmup();

      expect(mockPrisma.warmupLog.create).toHaveBeenCalledWith({
        data: {
          scheduleId: schedule.id,
          day: 3,
          sent: 8,
          bounced: 0,
          delivered: 8,
        },
      });
    });

    it('should use transaction for atomic read-and-reset', async () => {
      const schedule = buildWarmupSchedule({
        currentDay: 1,
        sentToday: 5,
        bouncedToday: 0,
      });
      mockPrisma.warmupSchedule.findMany.mockResolvedValue([schedule]);
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(schedule);
      mockPrisma.warmupLog.create.mockResolvedValue({});
      mockPrisma.warmupSchedule.update.mockResolvedValue({});

      await tickWarmup();

      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    });
  });

  describe('canSendFromAccount', () => {
    it('should return true when no active warmup exists', async () => {
      mockPrisma.warmupSchedule.findFirst.mockResolvedValue(null);

      const result = await canSendFromAccount('sender@example.com');

      expect(result).toBe(true);
    });

    it('should return true when under daily limit', async () => {
      const schedule = buildWarmupSchedule({ sentToday: 3, currentDailyLimit: 5 });
      mockPrisma.warmupSchedule.findFirst.mockResolvedValue(schedule);

      const result = await canSendFromAccount('sender@example.com');

      expect(result).toBe(true);
    });

    it('should return false when limit reached', async () => {
      const schedule = buildWarmupSchedule({ sentToday: 5, currentDailyLimit: 5 });
      mockPrisma.warmupSchedule.findFirst.mockResolvedValue(schedule);

      const result = await canSendFromAccount('sender@example.com');

      expect(result).toBe(false);
    });
  });

  describe('recordWarmupSend', () => {
    it('should increment sentToday', async () => {
      mockPrisma.warmupSchedule.update.mockResolvedValue({});

      await recordWarmupSend('ws_1');

      expect(mockPrisma.warmupSchedule.update).toHaveBeenCalledWith({
        where: { id: 'ws_1' },
        data: { sentToday: { increment: 1 } },
      });
    });
  });

  describe('recordWarmupBounce', () => {
    it('should increment bouncedToday', async () => {
      mockPrisma.warmupSchedule.update.mockResolvedValue({});

      await recordWarmupBounce('ws_1');

      expect(mockPrisma.warmupSchedule.update).toHaveBeenCalledWith({
        where: { id: 'ws_1' },
        data: { bouncedToday: { increment: 1 } },
      });
    });
  });

  describe('getWarmupProgress', () => {
    it('should return schedule with logs', async () => {
      const schedule = buildWarmupSchedule();
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue({ ...schedule, logs: [] });

      const result = await getWarmupProgress(schedule.id);

      expect(result.id).toBe(schedule.id);
      expect(mockPrisma.warmupSchedule.findUnique).toHaveBeenCalledWith({
        where: { id: schedule.id },
        include: { logs: { orderBy: { day: 'desc' }, take: 10 } },
      });
    });

    it('should throw if schedule not found', async () => {
      mockPrisma.warmupSchedule.findUnique.mockResolvedValue(null);

      await expect(getWarmupProgress('nonexistent')).rejects.toThrow('not found');
    });
  });
});
