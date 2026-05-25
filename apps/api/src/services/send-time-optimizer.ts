import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export async function recordOpenTime(leadId: string, openedAt: Date) {
  const hour = openedAt.getUTCHours();
  const day = openedAt.getUTCDay();

  const existing = await prisma.sendTimePreference.findUnique({ where: { leadId } });

  if (!existing) {
    return prisma.sendTimePreference.create({
      data: {
        leadId,
        preferredHour: hour,
        preferredDay: day,
        openCount: 1,
        dataPoints: 1,
      },
    });
  }

  // Weighted average: gradually shift preference toward recent opens
  const newDataPoints = existing.dataPoints + 1;
  const weight = 1 / newDataPoints;
  const currentHour = existing.preferredHour ?? hour;
  const currentDay = existing.preferredDay ?? day;

  const newHour = Math.round(currentHour * (1 - weight) + hour * weight);
  const newDay = Math.round(currentDay * (1 - weight) + day * weight);

  return prisma.sendTimePreference.update({
    where: { leadId },
    data: {
      preferredHour: newHour,
      preferredDay: newDay,
      openCount: { increment: 1 },
      dataPoints: newDataPoints,
    },
  });
}

export async function getOptimalSendTime(leadId: string) {
  const pref = await prisma.sendTimePreference.findUnique({ where: { leadId } });

  if (!pref || pref.dataPoints < 3) {
    // Not enough data - return default business hours
    return {
      hour: 10,
      day: 2,
      timezone: 'UTC',
      confidence: 'low',
      dataPoints: pref?.dataPoints ?? 0,
    };
  }

  return {
    hour: pref.preferredHour ?? 10,
    day: pref.preferredDay ?? 2,
    timezone: pref.timezone,
    confidence: pref.dataPoints >= 10 ? 'high' : 'medium',
    dataPoints: pref.dataPoints,
  };
}

export async function getOptimalTimeForTimezone(timezone: string) {
  const prefs = await prisma.sendTimePreference.findMany({
    where: { timezone },
  });

  if (prefs.length === 0) {
    return {
      hour: 10,
      day: 2,
      timezone,
      confidence: 'low',
      sampleSize: 0,
    };
  }

  // Aggregate average across all leads in this timezone
  const validPrefs = prefs.filter((p) => p.preferredHour !== null && p.preferredDay !== null);
  if (validPrefs.length === 0) {
    return {
      hour: 10,
      day: 2,
      timezone,
      confidence: 'low',
      sampleSize: 0,
    };
  }

  const avgHour = Math.round(validPrefs.reduce((sum, p) => sum + (p.preferredHour ?? 0), 0) / validPrefs.length);
  const avgDay = Math.round(validPrefs.reduce((sum, p) => sum + (p.preferredDay ?? 0), 0) / validPrefs.length);

  return {
    hour: avgHour,
    day: avgDay,
    timezone,
    confidence: validPrefs.length >= 10 ? 'high' : 'medium',
    sampleSize: validPrefs.length,
  };
}

export async function scheduleOptimalSend(messageId: string, leadId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw AppError.notFound('Message');

  const optimal = await getOptimalSendTime(leadId);

  // Calculate delay until optimal time
  const now = new Date();
  const targetHour = optimal.hour;
  const targetDay = optimal.day;

  let target = new Date(now);
  target.setUTCHours(targetHour, 0, 0, 0);

  // If target day is different from today, shift to next occurrence
  const currentDay = now.getUTCDay();
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget < 0) daysUntilTarget += 7;
  if (daysUntilTarget === 0 && now.getUTCHours() >= targetHour) {
    daysUntilTarget = 7;
  }
  target.setUTCDate(target.getUTCDate() + daysUntilTarget);

  const delayMs = target.getTime() - now.getTime();

  return {
    messageId,
    leadId,
    scheduledFor: target.toISOString(),
    delayMs: Math.max(0, delayMs),
    optimal,
  };
}
