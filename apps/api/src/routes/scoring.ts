import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { scoreLead, scoreAllLeads, getLeadScoreFactors } from '../services/lead-scoring.js';

const router = Router();

router.post('/score/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.leadId as string;
    const score = await scoreLead(leadId);

    if (score === 0 && !(await prisma.lead.findUnique({ where: { id: leadId } }))) {
      throw AppError.notFound('Lead');
    }

    res.json({ data: { leadId, score } });
  } catch (err) { next(err); }
});

router.post('/score-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = req.body as { leadIds?: string[] };
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      throw AppError.validation('leadIds array is required');
    }
    if (leadIds.length > 500) {
      throw AppError.validation('Max 500 leads per batch');
    }

    const results: Array<{ leadId: string; score: number }> = [];
    for (const id of leadIds) {
      const score = await scoreLead(id);
      results.push({ leadId: id, score });
    }

    res.json({ data: { scored: results.length, results } });
  } catch (err) { next(err); }
});

router.post('/rescore-all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const total = await scoreAllLeads();
    res.json({ data: { scored: total } });
  } catch (err) { next(err); }
});

router.get('/factors/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.leadId as string;
    const result = await getLeadScoreFactors(leadId);

    if (!result) throw AppError.notFound('Lead');

    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/segments', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [hot, warm, cool, cold, unscored] = await Promise.all([
      prisma.lead.count({ where: { score: { gte: 70 } } }),
      prisma.lead.count({ where: { score: { gte: 40, lt: 70 } } }),
      prisma.lead.count({ where: { score: { gte: 20, lt: 40 } } }),
      prisma.lead.count({ where: { score: { gt: 0, lt: 20 } } }),
      prisma.lead.count({ where: { score: null } }),
    ]);

    res.json({
      data: {
        segments: [
          { label: 'Hot', min: 70, max: 100, count: hot },
          { label: 'Warm', min: 40, max: 69, count: warm },
          { label: 'Cool', min: 20, max: 39, count: cool },
          { label: 'Cold', min: 1, max: 19, count: cold },
          { label: 'Unscored', min: 0, max: 0, count: unscored },
        ],
        total: hot + warm + cool + cold + unscored,
      },
    });
  } catch (err) { next(err); }
});

export default router;
