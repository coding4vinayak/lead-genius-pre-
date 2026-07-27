import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { automationSchema, automationStepSchema, paginationSchema } from '@leadgenius/shared';
import { automationQueue } from '../queue/index.js';
import { z } from 'zod';

const createAutomationSchema = z.object({
  automation: automationSchema,
  steps: z.array(automationStepSchema).default([]),
});

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { status, triggerType } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (triggerType) where.triggerType = triggerType;

    const [data, total] = await Promise.all([
      prisma.automation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { steps: { orderBy: { position: 'asc' } } },
      }),
      prisma.automation.count({ where }),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.automation.findUnique({
      where: { id: req.params.id as string },
      include: {
        steps: { orderBy: { position: 'asc' } },
        executions: { orderBy: { startedAt: 'desc' }, take: 10 },
      },
    });
    if (!data) throw AppError.notFound('Automation');
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(createAutomationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { automation, steps } = req.body as { automation: Record<string, unknown>; steps: Array<Record<string, unknown>> };
    const data = await (prisma.$transaction as unknown as (fn: (tx: typeof prisma) => Promise<unknown>) => Promise<unknown>)(async (tx) => {
      const created = await tx.automation.create({ data: automation as never });
      if (steps.length > 0) {
        await tx.automationStep.createMany({
          data: steps.map((step) => ({ ...step, automationId: created.id })) as never,
        });
      }
      return tx.automation.findUnique({
        where: { id: created.id },
        include: { steps: { orderBy: { position: 'asc' } } },
      });
    });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(createAutomationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { automation, steps } = req.body as { automation: Record<string, unknown>; steps: Array<Record<string, unknown>> };
    const data = await (prisma.$transaction as unknown as (fn: (tx: typeof prisma) => Promise<unknown>) => Promise<unknown>)(async (tx) => {
      await tx.automation.update({
        where: { id: req.params.id as string },
        data: automation as never,
      });
      await tx.automationStep.deleteMany({
        where: { automationId: req.params.id as string },
      });
      if (steps.length > 0) {
        await tx.automationStep.createMany({
          data: steps.map((step) => ({ ...step, automationId: req.params.id as string })) as never,
        });
      }
      return tx.automation.findUnique({
        where: { id: req.params.id as string },
        include: { steps: { orderBy: { position: 'asc' } } },
      });
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.automation.delete({ where: { id: req.params.id as string } });
    res.json({ data: { id: req.params.id as string } });
  } catch (err) { next(err); }
});

router.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const automation = await prisma.automation.findUnique({ where: { id: req.params.id as string } });
    if (!automation) throw AppError.notFound('Automation');

    const data = await prisma.automation.update({
      where: { id: req.params.id as string },
      data: { isActive: true, status: 'active' },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const automation = await prisma.automation.findUnique({ where: { id: req.params.id as string } });
    if (!automation) throw AppError.notFound('Automation');

    const data = await prisma.automation.update({
      where: { id: req.params.id as string },
      data: { isActive: false, status: 'inactive' },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/:id/executions', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const where = { automationId: req.params.id as string };

    const [data, total] = await Promise.all([
      prisma.automationExecution.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.automationExecution.count({ where }),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const automation = await prisma.automation.findUnique({
      where: { id: req.params.id as string },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!automation) throw AppError.notFound('Automation');

    const testPayload = req.body.payload || { lead: { id: 'test_lead', name: 'Test Lead', email: 'test@example.com', status: 'active', tags: [] } };

    const execution = await prisma.automationExecution.create({
      data: {
        automationId: automation.id,
        triggerEvent: automation.triggerType,
        triggerPayload: JSON.parse(JSON.stringify(testPayload)),
        status: 'running',
        startedAt: new Date(),
      },
    });

    const firstStep = automation.steps[0];
    if (firstStep) {
      await automationQueue.add('process-step', {
        executionId: execution.id,
        stepId: firstStep.id,
        payload: testPayload,
      });
    }

    res.json({ data: { executionId: execution.id, message: 'Test execution started' } });
  } catch (err) { next(err); }
});

export default router;
