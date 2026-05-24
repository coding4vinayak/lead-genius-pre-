import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { emailDomainAuthSchema } from '@leadgenius/shared';
import {
  getChannelHealth,
  getAllChannelHealth,
  checkChannelStatus,
  listDomainAuth,
  addDomainAuth,
} from '../services/channel-health.js';

const router = Router();

// GET /api/channel-health - returns health for all channels
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getAllChannelHealth();
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/channel-health/domains - list email domain auth records
router.get('/domains', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listDomainAuth();
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/channel-health/domains - add domain to track
router.post('/domains', validate(emailDomainAuthSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domain } = req.body as { domain: string };

    // Check if domain already exists
    const existing = await prisma.emailDomainAuth.findUnique({ where: { domain } });
    if (existing) {
      throw AppError.validation('Domain already exists');
    }

    const data = await addDomainAuth(domain);
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// POST /api/channel-health/check - trigger manual health check
router.post('/check', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await checkChannelStatus();
    res.json({ data: results });
  } catch (err) { next(err); }
});

// GET /api/channel-health/:channel - specific channel health
router.get('/:channel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel } = req.params;
    if (channel !== 'email' && channel !== 'whatsapp') {
      throw AppError.validation('Channel must be "email" or "whatsapp"');
    }
    const data = await getChannelHealth(channel);
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
