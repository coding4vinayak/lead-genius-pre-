import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { taskSchema, paginationSchema } from '@leadgenius/shared';
import { publishEvent } from '../services/event-bus.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { status, priority, assigneeId, automationId } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (automationId) where.automationId = automationId;

    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = await prisma.task.findUnique({ where: { id } });
    if (!data) throw AppError.notFound('Task');
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(taskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.task.create({ data: req.body });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(taskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = await prisma.task.update({ where: { id }, data: req.body });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.task.delete({ where: { id } });
    res.json({ data: { id } });
  } catch (err) { next(err); }
});

router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });
    res.json({ data: task });
    publishEvent('task.completed', 'task', task.id, { taskId: task.id, title: task.title }).catch(() => {});
  } catch (err) { next(err); }
});

router.post('/:id/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { assigneeId } = req.body as { assigneeId: string };
    const data = await prisma.task.update({ where: { id }, data: { assigneeId } });
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
