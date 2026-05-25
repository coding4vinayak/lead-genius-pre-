import { prisma } from '../db.js';

export async function logActivity(
  leadId: string,
  userId: string | null,
  activityType: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  return prisma.leadActivity.create({
    data: {
      leadId,
      userId,
      activityType,
      description,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}

export async function getActivityFeed(leadId: string, page = 1, pageSize = 20) {
  const [data, total] = await Promise.all([
    prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.leadActivity.count({ where: { leadId } }),
  ]);

  return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}
