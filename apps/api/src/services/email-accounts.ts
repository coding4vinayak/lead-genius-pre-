import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export interface CreateAccountInput {
  email: string;
  name?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  sendgridApiKey?: string;
  dailyLimit?: number;
  isActive?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  sendgridApiKey?: string;
  dailyLimit?: number;
  isActive?: boolean;
}

export async function createAccount(input: CreateAccountInput) {
  const existing = await prisma.emailAccount.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('Email account already exists');

  return prisma.emailAccount.create({
    data: {
      email: input.email,
      name: input.name,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpUser: input.smtpUser,
      smtpPass: input.smtpPass,
      sendgridApiKey: input.sendgridApiKey,
      dailyLimit: input.dailyLimit ?? 100,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateAccount(id: string, input: UpdateAccountInput) {
  const account = await prisma.emailAccount.findUnique({ where: { id } });
  if (!account) throw AppError.notFound('EmailAccount');

  return prisma.emailAccount.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.smtpHost !== undefined && { smtpHost: input.smtpHost }),
      ...(input.smtpPort !== undefined && { smtpPort: input.smtpPort }),
      ...(input.smtpUser !== undefined && { smtpUser: input.smtpUser }),
      ...(input.smtpPass !== undefined && { smtpPass: input.smtpPass }),
      ...(input.sendgridApiKey !== undefined && { sendgridApiKey: input.sendgridApiKey }),
      ...(input.dailyLimit !== undefined && { dailyLimit: input.dailyLimit }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
}

export async function deleteAccount(id: string) {
  const account = await prisma.emailAccount.findUnique({ where: { id } });
  if (!account) throw AppError.notFound('EmailAccount');

  return prisma.emailAccount.delete({ where: { id } });
}

export async function getAccount(id: string) {
  const account = await prisma.emailAccount.findUnique({ where: { id } });
  if (!account) throw AppError.notFound('EmailAccount');
  return stripSensitiveFields(account);
}

export async function listAccounts(page: number, pageSize: number) {
  const [data, total] = await Promise.all([
    prisma.emailAccount.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.emailAccount.count(),
  ]);
  return { data: data.map(stripSensitiveFields), total };
}

function stripSensitiveFields<T extends Record<string, unknown>>(account: T): Omit<T, 'smtpPass' | 'sendgridApiKey'> {
  const { smtpPass: _smtp, sendgridApiKey: _sg, ...safe } = account;
  return safe as Omit<T, 'smtpPass' | 'sendgridApiKey'>;
}

export async function testConnection(id: string): Promise<{ success: boolean; message: string }> {
  const account = await prisma.emailAccount.findUnique({ where: { id } });
  if (!account) throw AppError.notFound('EmailAccount');

  if (!account.smtpHost && !account.sendgridApiKey) {
    return { success: false, message: 'No SMTP or SendGrid configuration found' };
  }

  // In production, this would attempt an SMTP connection or SendGrid API call
  // For now, we validate that configuration exists
  if (account.smtpHost) {
    return { success: true, message: `SMTP connection to ${account.smtpHost}:${account.smtpPort} configured` };
  }

  return { success: true, message: 'SendGrid API key configured' };
}

export async function getAccountHealth(id: string) {
  const account = await prisma.emailAccount.findUnique({ where: { id } });
  if (!account) throw AppError.notFound('EmailAccount');

  return {
    id: account.id,
    email: account.email,
    isActive: account.isActive,
    reputationScore: account.reputationScore,
    bounceRate: account.bounceRate,
    dailyLimit: account.dailyLimit,
    sentToday: account.sentToday,
    warmupStatus: account.warmupStatus,
    remainingToday: Math.max(0, account.dailyLimit - account.sentToday),
  };
}

export async function resetDailyCounts() {
  await prisma.emailAccount.updateMany({
    data: {
      sentToday: 0,
      lastResetAt: new Date(),
    },
  });
}

export async function selectNextAccount(strategy: string): Promise<{ id: string; email: string } | null> {
  const config = await prisma.accountRotationConfig.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const skipOnDailyLimit = config?.skipOnDailyLimit ?? true;
  const skipOnHighBounce = config?.skipOnHighBounce ?? true;
  const bounceThreshold = config?.bounceThreshold ?? 10;

  const accounts = await prisma.emailAccount.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (accounts.length === 0) return null;

  const eligible = accounts.filter((account: { sentToday: number; dailyLimit: number; bounceRate: number }) => {
    if (skipOnDailyLimit && account.sentToday >= account.dailyLimit) return false;
    if (skipOnHighBounce && account.bounceRate > bounceThreshold) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const effectiveStrategy = strategy || config?.strategy || 'round_robin';

  if (effectiveStrategy === 'round_robin') {
    // Select account with least sent today (simple round-robin approximation)
    const sorted = [...eligible].sort((a: { sentToday: number }, b: { sentToday: number }) => a.sentToday - b.sentToday);
    return { id: sorted[0].id, email: sorted[0].email };
  }

  if (effectiveStrategy === 'weighted') {
    // Weight by reputation score - higher reputation gets more sends
    const totalWeight = eligible.reduce((sum: number, a: { reputationScore: number }) => sum + a.reputationScore, 0);
    if (totalWeight === 0) return { id: eligible[0].id, email: eligible[0].email };

    let random = Math.random() * totalWeight;
    for (const account of eligible) {
      random -= account.reputationScore;
      if (random <= 0) {
        return { id: account.id, email: account.email };
      }
    }
    return { id: eligible[0].id, email: eligible[0].email };
  }

  if (effectiveStrategy === 'failover') {
    // Use first available account in order
    return { id: eligible[0].id, email: eligible[0].email };
  }

  return { id: eligible[0].id, email: eligible[0].email };
}
