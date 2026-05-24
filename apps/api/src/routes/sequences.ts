import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { sequenceSchema, sequenceStepSchema, paginationSchema } from '@leadgenius/shared';
import { z } from 'zod';

const createSequenceSchema = z.object({
  sequence: sequenceSchema,
  steps: z.array(sequenceStepSchema).default([]),
});

const enrollSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, 'At least one leadId is required'),
});

const router = Router();

// GET /api/sequences - list with pagination
router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { status } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.sequence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { steps: { orderBy: { position: 'asc' } }, _count: { select: { enrollments: true } } },
      }),
      prisma.sequence.count({ where }),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

// GET /api/sequences/:id - detail with steps and enrollment stats
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.sequence.findUnique({
      where: { id: req.params.id as string },
      include: {
        steps: { orderBy: { position: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!data) throw AppError.notFound('Sequence');

    const enrollmentStats = await prisma.sequenceEnrollment.groupBy({
      by: ['status'],
      where: { sequenceId: req.params.id as string },
      _count: true,
    });

    res.json({ data: { ...data, enrollmentStats } });
  } catch (err) { next(err); }
});

// POST /api/sequences - create with steps
router.post('/', validate(createSequenceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sequence, steps } = req.body as { sequence: Record<string, unknown>; steps: Array<Record<string, unknown>> };
    const data = await (prisma.$transaction as unknown as (fn: (tx: typeof prisma) => Promise<unknown>) => Promise<unknown>)(async (tx) => {
      const created = await tx.sequence.create({ data: sequence as never });
      if (steps.length > 0) {
        await tx.sequenceStep.createMany({
          data: steps.map((step) => ({ ...step, sequenceId: created.id })) as never,
        });
      }
      return tx.sequence.findUnique({
        where: { id: created.id },
        include: { steps: { orderBy: { position: 'asc' } } },
      });
    });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PUT /api/sequences/:id - update
router.put('/:id', validate(createSequenceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sequence, steps } = req.body as { sequence: Record<string, unknown>; steps: Array<Record<string, unknown>> };
    const data = await (prisma.$transaction as unknown as (fn: (tx: typeof prisma) => Promise<unknown>) => Promise<unknown>)(async (tx) => {
      await tx.sequence.update({
        where: { id: req.params.id as string },
        data: sequence as never,
      });
      await tx.sequenceStep.deleteMany({
        where: { sequenceId: req.params.id as string },
      });
      if (steps.length > 0) {
        await tx.sequenceStep.createMany({
          data: steps.map((step) => ({ ...step, sequenceId: req.params.id as string })) as never,
        });
      }
      return tx.sequence.findUnique({
        where: { id: req.params.id as string },
        include: { steps: { orderBy: { position: 'asc' } } },
      });
    });
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/sequences/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.sequence.delete({ where: { id: req.params.id as string } });
    res.json({ data: { id: req.params.id as string } });
  } catch (err) { next(err); }
});

// POST /api/sequences/:id/activate - set status active, enroll leads from groups
router.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sequence = await prisma.sequence.findUnique({
      where: { id: req.params.id as string },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!sequence) throw AppError.notFound('Sequence');

    const data = await prisma.sequence.update({
      where: { id: req.params.id as string },
      data: { status: 'active' },
    });

    // Enroll leads from groups
    if (sequence.leadGroupIds.length > 0 && sequence.steps.length > 0) {
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId: { in: sequence.leadGroupIds } },
        select: { leadId: true },
      });
      const leadIds = [...new Set(groupMembers.map((m) => m.leadId))];
      const firstStep = sequence.steps[0];

      if (leadIds.length > 0 && firstStep) {
        // Check for existing enrollments
        const existing = await prisma.sequenceEnrollment.findMany({
          where: { sequenceId: sequence.id, leadId: { in: leadIds } },
          select: { leadId: true },
        });
        const existingSet = new Set(existing.map((e) => e.leadId));
        const newLeadIds = leadIds.filter((id) => !existingSet.has(id));

        if (newLeadIds.length > 0) {
          await prisma.sequenceEnrollment.createMany({
            data: newLeadIds.map((leadId) => ({
              sequenceId: sequence.id,
              leadId,
              status: 'active' as const,
              currentStepId: firstStep.id,
              nextRunAt: new Date(),
            })),
          });
        }
      }
    }

    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/sequences/:id/pause
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sequence = await prisma.sequence.findUnique({ where: { id: req.params.id as string } });
    if (!sequence) throw AppError.notFound('Sequence');

    const data = await prisma.sequence.update({
      where: { id: req.params.id as string },
      data: { status: 'paused' },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/sequences/:id/resume
router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sequence = await prisma.sequence.findUnique({ where: { id: req.params.id as string } });
    if (!sequence) throw AppError.notFound('Sequence');

    const data = await prisma.sequence.update({
      where: { id: req.params.id as string },
      data: { status: 'active' },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/sequences/:id/enrollments - paginated list of enrolled leads
router.get('/:id/enrollments', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const where = { sequenceId: req.params.id as string };

    const [data, total] = await Promise.all([
      prisma.sequenceEnrollment.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { lead: { select: { id: true, name: true, email: true } } },
      }),
      prisma.sequenceEnrollment.count({ where }),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

// POST /api/sequences/:id/enroll - manually enroll specific leadIds
router.post('/:id/enroll', validate(enrollSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = req.body as { leadIds: string[] };
    const sequence = await prisma.sequence.findUnique({
      where: { id: req.params.id as string },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!sequence) throw AppError.notFound('Sequence');
    if (sequence.steps.length === 0) {
      throw AppError.validation('Sequence has no steps');
    }

    const firstStep = sequence.steps[0];

    // Avoid duplicate enrollments
    const existing = await prisma.sequenceEnrollment.findMany({
      where: { sequenceId: sequence.id, leadId: { in: leadIds }, status: 'active' },
      select: { leadId: true },
    });
    const existingSet = new Set(existing.map((e) => e.leadId));
    const newLeadIds = leadIds.filter((id) => !existingSet.has(id));

    if (newLeadIds.length > 0) {
      await prisma.sequenceEnrollment.createMany({
        data: newLeadIds.map((leadId) => ({
          sequenceId: sequence.id,
          leadId,
          status: 'active' as const,
          currentStepId: firstStep.id,
          nextRunAt: new Date(),
        })),
      });
    }

    res.json({ data: { enrolled: newLeadIds.length, skipped: leadIds.length - newLeadIds.length } });
  } catch (err) { next(err); }
});

// POST /api/sequences/:id/unenroll - remove leads
router.post('/:id/unenroll', validate(enrollSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = req.body as { leadIds: string[] };

    const result = await prisma.sequenceEnrollment.updateMany({
      where: {
        sequenceId: req.params.id as string,
        leadId: { in: leadIds },
        status: 'active',
      },
      data: { status: 'exited', exitReason: 'manually_unenrolled', completedAt: new Date() },
    });

    res.json({ data: { unenrolled: result.count } });
  } catch (err) { next(err); }
});

// GET /api/sequences/:id/analytics - per-step metrics
router.get('/:id/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sequence = await prisma.sequence.findUnique({
      where: { id: req.params.id as string },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
    if (!sequence) throw AppError.notFound('Sequence');

    const stepExecutions = await prisma.sequenceStepExecution.findMany({
      where: { step: { sequenceId: req.params.id as string } },
      select: { stepId: true, status: true },
    });

    const stepMetrics = sequence.steps.map((step) => {
      const executions = stepExecutions.filter((e) => e.stepId === step.id);
      const completed = executions.filter((e) => e.status === 'completed').length;
      const failed = executions.filter((e) => e.status === 'failed').length;
      const skipped = executions.filter((e) => e.status === 'skipped').length;
      const total = executions.length;
      return {
        stepId: step.id,
        position: step.position,
        type: step.type,
        total,
        completed,
        failed,
        skipped,
        conversionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    const [totalEnrollments, completedEnrollments, activeEnrollments] = await Promise.all([
      prisma.sequenceEnrollment.count({ where: { sequenceId: req.params.id as string } }),
      prisma.sequenceEnrollment.count({ where: { sequenceId: req.params.id as string, status: 'completed' } }),
      prisma.sequenceEnrollment.count({ where: { sequenceId: req.params.id as string, status: 'active' } }),
    ]);

    res.json({
      data: {
        sequenceId: req.params.id,
        totalEnrollments,
        completedEnrollments,
        activeEnrollments,
        completionRate: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0,
        stepMetrics,
      },
    });
  } catch (err) { next(err); }
});

export default router;
