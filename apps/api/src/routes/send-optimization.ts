import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { sendOptimizationScheduleSchema } from '@leadgenius/shared';
import {
  getOptimalSendTime,
  getOptimalTimeForTimezone,
  scheduleOptimalSend,
} from '../services/send-time-optimizer.js';

const router = Router();

router.get('/lead/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const optimal = await getOptimalSendTime(req.params.leadId as string);
    res.json({ data: optimal });
  } catch (err) { next(err); }
});

router.get('/timezone/:tz', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timezone = decodeURIComponent(req.params.tz as string);
    const optimal = await getOptimalTimeForTimezone(timezone);
    res.json({ data: optimal });
  } catch (err) { next(err); }
});

router.post('/schedule', validate(sendOptimizationScheduleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messageId, leadId } = req.body as { messageId: string; leadId: string };
    const schedule = await scheduleOptimalSend(messageId, leadId);
    res.json({ data: schedule });
  } catch (err) { next(err); }
});

export default router;
