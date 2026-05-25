import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { warmupScheduleSchema, warmupScheduleUpdateSchema, paginationSchema } from '@leadgenius/shared';
import {
  createWarmupSchedule,
  pauseWarmup,
  resumeWarmup,
  getWarmupProgress,
  updateWarmupSchedule,
  listWarmupSchedules,
  getWarmupLogs,
} from '../services/warmup.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { data, total } = await listWarmupSchedules(page, pageSize);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.post('/', validate(warmupScheduleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountEmail, maxDailyLimit, rampPercentage, bounceThreshold } = req.body as {
      accountEmail: string;
      maxDailyLimit?: number;
      rampPercentage?: number;
      bounceThreshold?: number;
    };
    const schedule = await createWarmupSchedule(accountEmail, { maxDailyLimit, rampPercentage, bounceThreshold });
    res.status(201).json({ data: schedule });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const schedule = await getWarmupProgress(id);
    res.json({ data: schedule });
  } catch (err) { next(err); }
});

router.put('/:id', validate(warmupScheduleUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { maxDailyLimit, rampPercentage, bounceThreshold } = req.body as {
      maxDailyLimit?: number;
      rampPercentage?: number;
      bounceThreshold?: number;
    };
    const schedule = await updateWarmupSchedule(id, { maxDailyLimit, rampPercentage, bounceThreshold });
    res.json({ data: schedule });
  } catch (err) { next(err); }
});

router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const schedule = await pauseWarmup(id);
    res.json({ data: schedule });
  } catch (err) { next(err); }
});

router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const schedule = await resumeWarmup(id);
    res.json({ data: schedule });
  } catch (err) { next(err); }
});

router.get('/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const logs = await getWarmupLogs(id);
    res.json({ data: logs });
  } catch (err) { next(err); }
});

export default router;
