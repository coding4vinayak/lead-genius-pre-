import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

export type SuppressionReason = 'bounce' | 'unsubscribe' | 'complaint';

export interface SuppressionInput {
  email: string;
  reason: SuppressionReason;
  source?: string;
  campaignId?: string;
}

export async function addToSuppression(email: string, reason: SuppressionReason, source?: string, campaignId?: string) {
  const entry = await prisma.suppressionEntry.upsert({
    where: { email_reason: { email, reason } },
    create: { email, reason, source, campaignId },
    update: { source, campaignId },
  });
  logger.info(`Added ${email} to suppression list`, { reason, source });
  return entry;
}

export async function removeFromSuppression(email: string) {
  const result = await prisma.suppressionEntry.deleteMany({ where: { email } });
  logger.info(`Removed ${email} from suppression list`, { count: result.count });
  return result;
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const count = await prisma.suppressionEntry.count({ where: { email } });
  return count > 0;
}

export async function importSuppressionList(entries: SuppressionInput[]) {
  let imported = 0;
  for (const entry of entries) {
    try {
      await prisma.suppressionEntry.upsert({
        where: { email_reason: { email: entry.email, reason: entry.reason } },
        create: { email: entry.email, reason: entry.reason, source: entry.source, campaignId: entry.campaignId },
        update: { source: entry.source },
      });
      imported++;
    } catch (err) {
      logger.error(`Failed to import suppression entry for ${entry.email}`, { error: (err as Error).message });
    }
  }
  return { imported, total: entries.length };
}

export async function exportSuppressionList() {
  const entries = await prisma.suppressionEntry.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return entries;
}

export async function getSuppressionList(page: number, pageSize: number) {
  const [data, total] = await Promise.all([
    prisma.suppressionEntry.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.suppressionEntry.count(),
  ]);
  return { data, total };
}

export async function removeSuppressionById(id: string) {
  return prisma.suppressionEntry.delete({ where: { id } });
}
