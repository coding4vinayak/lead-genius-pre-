import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { agentSettingsSchema } from '@leadgenius/shared';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.agentSettings.findUnique({ where: { id: 'global' } });
    if (!data) {
      const created = await prisma.agentSettings.create({ data: { id: 'global' } });
      return res.json({ data: created });
    }
    res.json({ data });
  } catch (err) { next(err); }
});

router.put('/', validate(agentSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.agentSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...req.body },
      update: req.body,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/toggle-autopilot', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const current = await prisma.agentSettings.findUnique({ where: { id: 'global' } });
    if (!current) throw AppError.notFound('Agent settings');

    const data = await prisma.agentSettings.update({
      where: { id: 'global' },
      data: { isAutoPilotActive: !current.isAutoPilotActive },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
