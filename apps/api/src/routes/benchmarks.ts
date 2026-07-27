import { Router, Request, Response, NextFunction } from 'express';
import {
  getBenchmarks,
  generateSuggestions,
} from '../services/benchmarks.js';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const benchmarks = await getBenchmarks();
    res.json({ data: benchmarks });
  } catch (err) { next(err); }
});

router.get('/suggestions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await generateSuggestions();
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
