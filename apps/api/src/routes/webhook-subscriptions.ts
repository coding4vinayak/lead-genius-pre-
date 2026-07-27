import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { webhookSubscriptionSchema, paginationSchema } from '@leadgenius/shared';
import { createDelivery } from '../services/webhook-delivery.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const [data, total] = await Promise.all([
      prisma.webhookSubscription.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.webhookSubscription.count(),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.webhookSubscription.findUnique({
      where: { id: (req.params.id as string) },
      include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!data) throw AppError.notFound('WebhookSubscription');
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(webhookSubscriptionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.webhookSubscription.create({ data: req.body });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(webhookSubscriptionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.webhookSubscription.update({
      where: { id: (req.params.id as string) },
      data: req.body,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.webhookSubscription.delete({ where: { id: (req.params.id as string) } });
    res.json({ data: { id: (req.params.id as string) } });
  } catch (err) { next(err); }
});

router.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.webhookSubscription.update({
      where: { id: (req.params.id as string) },
      data: { isActive: true },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.webhookSubscription.update({
      where: { id: (req.params.id as string) },
      data: { isActive: false },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/:id/deliveries', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const webhookId = (req.params.id as string);
    const [data, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.webhookDelivery.count({ where: { webhookId } }),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhook = await prisma.webhookSubscription.findUnique({ where: { id: (req.params.id as string) } });
    if (!webhook) throw AppError.notFound('WebhookSubscription');

    await createDelivery(webhook.id as string, 'test', {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery' },
    });

    res.json({ data: { message: 'Test delivery queued' } });
  } catch (err) { next(err); }
});

router.post('/:id/deliveries/:deliveryId/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: (req.params.deliveryId as string) },
    });
    if (!delivery || (delivery as { webhookId: string }).webhookId !== (req.params.id as string)) {
      throw AppError.notFound('WebhookDelivery');
    }

    await prisma.webhookDelivery.update({
      where: { id: (delivery as { id: string }).id },
      data: { status: 'pending', attempts: 0, nextRetryAt: null },
    });

    const { webhookQueue } = await import('../queue/index.js');
    await webhookQueue.add('deliver-webhook', { deliveryId: (delivery as { id: string }).id });

    res.json({ data: { message: 'Delivery retry queued' } });
  } catch (err) { next(err); }
});

export default router;
