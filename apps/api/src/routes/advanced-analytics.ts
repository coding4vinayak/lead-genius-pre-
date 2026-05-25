import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { analyticsExportSchema } from '@leadgenius/shared';
import {
  getSequenceFunnel,
  getCohortAnalysis,
  getRevenueAttribution,
  exportAnalyticsCSV,
} from '../services/advanced-analytics.js';

const router = Router();

router.get('/funnel/:sequenceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const funnel = await getSequenceFunnel(req.params.sequenceId as string);
    res.json({ data: funnel });
  } catch (err) { next(err); }
});

router.get('/cohorts/:sequenceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period } = req.query as { period?: string };
    const cohorts = await getCohortAnalysis(req.params.sequenceId as string, (period as 'week' | 'month') || 'week');
    res.json({ data: cohorts });
  } catch (err) { next(err); }
});

router.get('/revenue/:sequenceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const revenue = await getRevenueAttribution(req.params.sequenceId as string);
    res.json({ data: revenue });
  } catch (err) { next(err); }
});

router.get('/export', validate(analyticsExportSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, sequenceId, startDate, endDate } = req.query as { type: string; sequenceId?: string; startDate?: string; endDate?: string };
    const csv = await exportAnalyticsCSV(type, { sequenceId, startDate, endDate });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-analytics.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

export default router;
