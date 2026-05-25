import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { abTestSchema, paginationSchema } from '@leadgenius/shared';
import {
  createTest,
  startTest,
  selectWinner,
  getTestResults,
  listTests,
  getTest,
} from '../services/ab-testing.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { data, total } = await listTests(page, pageSize);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.post('/', validate(abTestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sequenceStepId, name, variants } = req.body as { sequenceStepId: string; name: string; variants: { name: string; subject?: string; body?: string; weight?: number }[] };
    const test = await createTest(sequenceStepId, name, variants);
    res.status(201).json({ data: test });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await getTest(req.params.id as string);
    res.json({ data: test });
  } catch (err) { next(err); }
});

router.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await startTest(req.params.id as string);
    res.json({ data: test });
  } catch (err) { next(err); }
});

router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const test = await selectWinner(req.params.id as string);
    res.json({ data: test });
  } catch (err) { next(err); }
});

router.get('/:id/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await getTestResults(req.params.id as string);
    res.json({ data: results });
  } catch (err) { next(err); }
});

export default router;
