import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { trackingDomainSchema } from '@leadgenius/shared';
import {
  addDomain,
  verifyDomain,
  removeDomain,
  listDomains,
  getDomain,
} from '../services/tracking-domains.js';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const domains = await listDomains();
    res.json({ data: domains });
  } catch (err) { next(err); }
});

router.post('/', validate(trackingDomainSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domain, cnameTarget, isDefault } = req.body as { domain: string; cnameTarget: string; isDefault?: boolean };
    const trackingDomain = await addDomain(domain, cnameTarget, isDefault);
    res.status(201).json({ data: trackingDomain });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const domain = await getDomain(id);
    res.json({ data: domain });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await removeDomain(id);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await verifyDomain(id);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
