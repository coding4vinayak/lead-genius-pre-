import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { paginationSchema } from '@leadgenius/shared';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { type, entityType, entityId, from, to } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    if (from || to) {
      const createdAt: Record<string, unknown> = {};
      if (from) createdAt.gte = new Date(from);
      if (to) createdAt.lte = new Date(to);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.event.count({ where }),
    ]);

    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = await prisma.event.findUnique({ where: { id } });
    if (!data) throw AppError.notFound('Event');
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
