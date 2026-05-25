import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export interface WarmupConfig {
  maxDailyLimit?: number;
  rampPercentage?: number;
  bounceThreshold?: number;
}

export async function createWarmupSchedule(accountEmail: string, config: WarmupConfig = {}) {
  const schedule = await prisma.warmupSchedule.create({
    data: {
      accountEmail,
      currentDailyLimit: 5,
      maxDailyLimit: config.maxDailyLimit ?? 50,
      rampPercentage: config.rampPercentage ?? 20,
      bounceThreshold: config.bounceThreshold ?? 5,
    },
  });
  return schedule;
}

export async function pauseWarmup(scheduleId: string, reason?: string) {
  const schedule = await prisma.warmupSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw AppError.notFound('WarmupSchedule');
  if (schedule.status === 'completed') throw AppError.validation('Cannot pause a completed schedule');

  return prisma.warmupSchedule.update({
    where: { id: scheduleId },
    data: { status: 'paused', pausedReason: reason || 'manual' },
  });
}

export async function resumeWarmup(scheduleId: string) {
  const schedule = await prisma.warmupSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw AppError.notFound('WarmupSchedule');
  if (schedule.status !== 'paused') throw AppError.validation('Schedule is not paused');

  return prisma.warmupSchedule.update({
    where: { id: scheduleId },
    data: { status: 'warming', pausedReason: null },
  });
}

export async function getWarmupProgress(scheduleId: string) {
  const schedule = await prisma.warmupSchedule.findUnique({
    where: { id: scheduleId },
    include: { logs: { orderBy: { day: 'desc' }, take: 10 } },
  });
  if (!schedule) throw AppError.notFound('WarmupSchedule');
  return schedule;
}

export async function tickWarmup() {
  const schedules = await prisma.warmupSchedule.findMany({
    where: { status: 'warming' },
  });

  for (const schedule of schedules) {
    try {
      // Check bounce rate
      const bounceRate = schedule.sentToday > 0
        ? (schedule.bouncedToday / schedule.sentToday) * 100
        : 0;

      if (bounceRate > schedule.bounceThreshold && schedule.sentToday > 0) {
        await prisma.warmupSchedule.update({
          where: { id: schedule.id },
          data: {
            status: 'paused',
            pausedReason: `Bounce rate ${bounceRate.toFixed(1)}% exceeded threshold ${schedule.bounceThreshold}%`,
          },
        });
        logger.info(`Warmup paused for ${schedule.accountEmail}: bounce rate ${bounceRate.toFixed(1)}%`);
        continue;
      }

      // Log today's stats
      await prisma.warmupLog.create({
        data: {
          scheduleId: schedule.id,
          day: schedule.currentDay,
          sent: schedule.sentToday,
          bounced: schedule.bouncedToday,
          delivered: schedule.sentToday - schedule.bouncedToday,
        },
      });

      // Increase daily limit by ramp percentage
      const newLimit = Math.min(
        Math.ceil(schedule.currentDailyLimit * (1 + schedule.rampPercentage / 100)),
        schedule.maxDailyLimit,
      );

      // Check if warmup is complete
      const isComplete = newLimit >= schedule.maxDailyLimit;

      await prisma.warmupSchedule.update({
        where: { id: schedule.id },
        data: {
          currentDay: schedule.currentDay + 1,
          currentDailyLimit: newLimit,
          sentToday: 0,
          bouncedToday: 0,
          status: isComplete ? 'completed' : 'warming',
        },
      });
    } catch (err) {
      logger.error(`Warmup tick failed for schedule ${schedule.id}`, { error: (err as Error).message });
    }
  }
}

export async function recordWarmupSend(scheduleId: string) {
  await prisma.warmupSchedule.update({
    where: { id: scheduleId },
    data: { sentToday: { increment: 1 } },
  });
}

export async function recordWarmupBounce(scheduleId: string) {
  await prisma.warmupSchedule.update({
    where: { id: scheduleId },
    data: { bouncedToday: { increment: 1 } },
  });
}

export async function canSendFromAccount(accountEmail: string): Promise<boolean> {
  const schedule = await prisma.warmupSchedule.findFirst({
    where: { accountEmail, status: 'warming' },
    orderBy: { createdAt: 'desc' },
  });

  // No active warmup schedule means account is fully warmed up
  if (!schedule) return true;

  return schedule.sentToday < schedule.currentDailyLimit;
}

export async function listWarmupSchedules(page: number, pageSize: number) {
  const [data, total] = await Promise.all([
    prisma.warmupSchedule.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.warmupSchedule.count(),
  ]);
  return { data, total };
}

export async function updateWarmupSchedule(scheduleId: string, config: Partial<WarmupConfig>) {
  const schedule = await prisma.warmupSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw AppError.notFound('WarmupSchedule');

  return prisma.warmupSchedule.update({
    where: { id: scheduleId },
    data: {
      ...(config.maxDailyLimit !== undefined && { maxDailyLimit: config.maxDailyLimit }),
      ...(config.rampPercentage !== undefined && { rampPercentage: config.rampPercentage }),
      ...(config.bounceThreshold !== undefined && { bounceThreshold: config.bounceThreshold }),
    },
  });
}

export async function getWarmupLogs(scheduleId: string) {
  const schedule = await prisma.warmupSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw AppError.notFound('WarmupSchedule');

  return prisma.warmupLog.findMany({
    where: { scheduleId },
    orderBy: { day: 'asc' },
  });
}
