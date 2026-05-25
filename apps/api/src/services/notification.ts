import { prisma } from '../db.js';
import { broadcastToUser } from './websocket.js';
import { logger } from '../lib/logger.js';

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, body, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined },
    });

    broadcastToUser(userId, 'notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (err) {
    logger.error('Failed to create notification', { userId, type, error: (err as Error).message });
    throw err;
  }
}

export async function getNotifications(userId: string, page: number, pageSize: number) {
  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
