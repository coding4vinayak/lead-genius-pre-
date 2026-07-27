import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { paginationSchema, notificationPreferenceSchema } from '@leadgenius/shared';
import { getNotifications, markAsRead, markAllAsRead, getUnreadCount } from '../services/notification.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };

    const result = await getNotifications(userId, page, pageSize);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const count = await getUnreadCount(userId);
    res.json({ data: { count } });
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const notificationId = req.params.id as string;

    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) throw AppError.notFound('Notification');
    if (notification.userId !== userId) throw AppError.notFound('Notification');

    const updated = await markAsRead(notificationId);
    res.json({ data: updated });
  } catch (err) { next(err); }
});

router.post('/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const result = await markAllAsRead(userId);
    res.json({ data: { updated: result.count } });
  } catch (err) { next(err); }
});

router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const preferences = await prisma.notificationPreference.findMany({ where: { userId } });
    res.json({ data: preferences });
  } catch (err) { next(err); }
});

router.put('/preferences', validate(notificationPreferenceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { preferences } = req.body as { preferences: Array<{ eventType: string; channel: string }> };

    const results = await Promise.all(
      preferences.map((pref) =>
        prisma.notificationPreference.upsert({
          where: { userId_eventType: { userId, eventType: pref.eventType } },
          update: { channel: pref.channel },
          create: { userId, eventType: pref.eventType, channel: pref.channel },
        }),
      ),
    );

    res.json({ data: results });
  } catch (err) { next(err); }
});

export default router;
