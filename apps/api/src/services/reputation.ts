import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export interface ReputationMetrics {
  id: string;
  email: string;
  reputationScore: number;
  bounceRate: number;
  sentToday: number;
  dailyLimit: number;
  warmupStatus: string;
  isActive: boolean;
}

export interface ReputationAlert {
  accountId: string;
  email: string;
  type: string;
  message: string;
  severity: string;
}

export async function calculateReputationScore(accountId: string): Promise<ReputationMetrics> {
  const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
  if (!account) throw AppError.notFound('EmailAccount');

  // Reputation score formula:
  // Start at 100, subtract points for bounce rate
  // bounceRate 0-2% = excellent (no penalty)
  // bounceRate 2-5% = good (-10 points)
  // bounceRate 5-10% = warning (-30 points)
  // bounceRate >10% = critical (-50 points)
  let score = 100;
  if (account.bounceRate > 10) score -= 50;
  else if (account.bounceRate > 5) score -= 30;
  else if (account.bounceRate > 2) score -= 10;

  // Update the stored score
  await prisma.emailAccount.update({
    where: { id: accountId },
    data: { reputationScore: score },
  });

  return {
    id: account.id,
    email: account.email,
    reputationScore: score,
    bounceRate: account.bounceRate,
    sentToday: account.sentToday,
    dailyLimit: account.dailyLimit,
    warmupStatus: account.warmupStatus,
    isActive: account.isActive,
  };
}

export async function getReputationDashboard(): Promise<{ accounts: ReputationMetrics[]; summary: { totalAccounts: number; averageScore: number; activeAccounts: number; alertCount: number } }> {
  const accounts = await prisma.emailAccount.findMany({
    orderBy: { reputationScore: 'desc' },
  });

  const metrics: ReputationMetrics[] = accounts.map((account: { id: string; email: string; reputationScore: number; bounceRate: number; sentToday: number; dailyLimit: number; warmupStatus: string; isActive: boolean }) => ({
    id: account.id,
    email: account.email,
    reputationScore: account.reputationScore,
    bounceRate: account.bounceRate,
    sentToday: account.sentToday,
    dailyLimit: account.dailyLimit,
    warmupStatus: account.warmupStatus,
    isActive: account.isActive,
  }));

  const activeAccounts = accounts.filter((a: { isActive: boolean }) => a.isActive).length;
  const averageScore = accounts.length > 0
    ? accounts.reduce((sum: number, a: { reputationScore: number }) => sum + a.reputationScore, 0) / accounts.length
    : 0;

  const alerts = checkReputationAlertsFromAccounts(accounts);

  return {
    accounts: metrics,
    summary: {
      totalAccounts: accounts.length,
      averageScore: Math.round(averageScore * 10) / 10,
      activeAccounts,
      alertCount: alerts.length,
    },
  };
}

export async function checkReputationAlerts(): Promise<ReputationAlert[]> {
  const accounts = await prisma.emailAccount.findMany({
    where: { isActive: true },
  });

  return checkReputationAlertsFromAccounts(accounts);
}

function checkReputationAlertsFromAccounts(accounts: Array<{ id: string; email: string; reputationScore: number; bounceRate: number; sentToday: number; dailyLimit: number }>): ReputationAlert[] {
  const alerts: ReputationAlert[] = [];

  for (const account of accounts) {
    if (account.reputationScore < 50) {
      alerts.push({
        accountId: account.id,
        email: account.email,
        type: 'low_reputation',
        message: `Reputation score critically low: ${account.reputationScore}`,
        severity: 'critical',
      });
    } else if (account.reputationScore < 70) {
      alerts.push({
        accountId: account.id,
        email: account.email,
        type: 'low_reputation',
        message: `Reputation score below threshold: ${account.reputationScore}`,
        severity: 'warning',
      });
    }

    if (account.bounceRate > 10) {
      alerts.push({
        accountId: account.id,
        email: account.email,
        type: 'high_bounce_rate',
        message: `Bounce rate exceeds 10%: ${account.bounceRate}%`,
        severity: 'critical',
      });
    } else if (account.bounceRate > 5) {
      alerts.push({
        accountId: account.id,
        email: account.email,
        type: 'high_bounce_rate',
        message: `Bounce rate elevated: ${account.bounceRate}%`,
        severity: 'warning',
      });
    }

    if (account.sentToday >= account.dailyLimit) {
      alerts.push({
        accountId: account.id,
        email: account.email,
        type: 'daily_limit_reached',
        message: `Daily sending limit reached: ${account.sentToday}/${account.dailyLimit}`,
        severity: 'info',
      });
    }
  }

  return alerts;
}
