import crypto from 'crypto';
import { prisma } from '../db.js';

const KEY_PREFIX = 'lg_';

export async function generateApiKey(workspaceId: string, name: string, permissions: string[] = []) {
  const rawKey = crypto.randomBytes(32).toString('hex');
  const prefix = KEY_PREFIX + rawKey.slice(0, 8);
  const fullKey = prefix + '_' + rawKey.slice(8);
  const hashedKey = crypto.createHash('sha256').update(fullKey).digest('hex');

  const apiKey = await prisma.apiKey.create({
    data: {
      workspaceId,
      name,
      key: hashedKey,
      prefix,
      permissions,
      isActive: true,
    },
  });

  return { ...apiKey, fullKey };
}

export async function revokeApiKey(keyId: string) {
  return prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
  });
}

export async function listApiKeys(workspaceId: string) {
  const keys = await prisma.apiKey.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });

  return keys.map((key) => ({
    ...key,
    key: key.prefix + '****' + key.key.slice(-4),
  }));
}

export async function validateApiKey(key: string) {
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { key: hashedKey },
    include: { workspace: true },
  });

  if (!apiKey || !apiKey.isActive) {
    return null;
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey;
}

export async function trackUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
) {
  await Promise.all([
    prisma.apiKeyUsage.create({
      data: { apiKeyId, endpoint, method, statusCode, responseTimeMs },
    }),
    prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { requestCount: { increment: 1 } },
    }),
  ]);
}

export async function getUsageStats(apiKeyId: string, startDate?: string, endDate?: string) {
  const where: Record<string, unknown> = { apiKeyId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
  }

  const [totalRequests, records] = await Promise.all([
    prisma.apiKeyUsage.count({ where }),
    prisma.apiKeyUsage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const avgResponseTime = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.responseTimeMs, 0) / records.length)
    : 0;

  const statusCodes: Record<number, number> = {};
  for (const record of records) {
    statusCodes[record.statusCode] = (statusCodes[record.statusCode] || 0) + 1;
  }

  const endpoints: Record<string, number> = {};
  for (const record of records) {
    const key = `${record.method} ${record.endpoint}`;
    endpoints[key] = (endpoints[key] || 0) + 1;
  }

  return {
    totalRequests,
    avgResponseTime,
    statusCodes,
    endpoints,
    recentRequests: records.slice(0, 20),
  };
}
