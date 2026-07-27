import { prisma } from '../db.js';

const PLAN_LIMITS: Record<string, Record<string, number>> = {
  free: {
    emails_sent: 100,
    contacts_stored: 500,
    sequences_active: 3,
    team_members: 2,
  },
  pro: {
    emails_sent: 5000,
    contacts_stored: 10000,
    sequences_active: 50,
    team_members: 20,
  },
  enterprise: {
    emails_sent: Infinity,
    contacts_stored: Infinity,
    sequences_active: Infinity,
    team_members: Infinity,
  },
};

export function getPlanLimits(plan: string): Record<string, number> {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS['free'];
}

export async function trackUsage(workspaceId: string, metric: string, increment: number = 1) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const existing = await prisma.usageRecord.findFirst({
    where: {
      workspaceId,
      metric: metric as 'emails_sent' | 'contacts_stored' | 'sequences_active' | 'team_members',
      period: 'monthly',
      periodStart,
      periodEnd,
    },
  });

  if (existing) {
    return prisma.usageRecord.update({
      where: { id: existing.id },
      data: { value: existing.value + increment },
    });
  }

  return prisma.usageRecord.create({
    data: {
      workspaceId,
      metric: metric as 'emails_sent' | 'contacts_stored' | 'sequences_active' | 'team_members',
      value: increment,
      period: 'monthly',
      periodStart,
      periodEnd,
    },
  });
}

export async function getUsage(workspaceId: string, period: string = 'monthly') {
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;

  if (period === 'daily') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const records = await prisma.usageRecord.findMany({
    where: {
      workspaceId,
      period: period as 'daily' | 'monthly',
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
  });

  const usage: Record<string, number> = {
    emails_sent: 0,
    contacts_stored: 0,
    sequences_active: 0,
    team_members: 0,
  };

  for (const record of records) {
    usage[record.metric] = record.value;
  }

  return usage;
}

export async function getDailyUsage(workspaceId: string) {
  return getUsage(workspaceId, 'daily');
}

export async function getMonthlyUsage(workspaceId: string) {
  return getUsage(workspaceId, 'monthly');
}

export async function checkQuota(workspaceId: string, metric: string): Promise<{ withinLimit: boolean; current: number; limit: number }> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    return { withinLimit: false, current: 0, limit: 0 };
  }

  const limits = getPlanLimits(workspace.plan);
  const limit = limits[metric] ?? 0;

  if (limit === Infinity) {
    return { withinLimit: true, current: 0, limit: -1 };
  }

  const usage = await getMonthlyUsage(workspaceId);
  const current = usage[metric] ?? 0;

  return {
    withinLimit: current < limit,
    current,
    limit,
  };
}
