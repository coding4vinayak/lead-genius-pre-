import { Router, Request, Response, NextFunction } from 'express';
import {
  calculateReputationScore,
  getReputationDashboard,
  checkReputationAlerts,
} from '../services/reputation.js';

const router = Router();

router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboard = await getReputationDashboard();
    res.json({ data: dashboard });
  } catch (err) { next(err); }
});

router.get('/accounts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const metrics = await calculateReputationScore(id);
    res.json({ data: metrics });
  } catch (err) { next(err); }
});

router.get('/alerts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await checkReputationAlerts();
    res.json({ data: alerts });
  } catch (err) { next(err); }
});

export default router;
