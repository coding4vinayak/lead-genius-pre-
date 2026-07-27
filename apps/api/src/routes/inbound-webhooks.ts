import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { inboundWebhookSchema, paginationSchema } from '@leadgenius/shared';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const [data, total] = await Promise.all([
      prisma.inboundWebhook.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inboundWebhook.count(),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.inboundWebhook.findUnique({ where: { id: (req.params.id as string) } });
    if (!data) throw AppError.notFound('InboundWebhook');
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(inboundWebhookSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = crypto.randomUUID();
    const data = await prisma.inboundWebhook.create({
      data: {
        ...req.body,
        token,
        isActive: true,
      },
    });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(inboundWebhookSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.inboundWebhook.update({
      where: { id: (req.params.id as string) },
      data: req.body,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.inboundWebhook.delete({ where: { id: (req.params.id as string) } });
    res.json({ data: { id: (req.params.id as string) } });
  } catch (err) { next(err); }
});

export default router;
