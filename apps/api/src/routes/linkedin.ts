import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { linkedInConnectSchema, linkedInMessageSchema, linkedInProfileUpdateSchema, paginationSchema } from '@leadgenius/shared';
import * as linkedinService from '../services/linkedin.js';

const router = Router();

router.post('/connect/:leadId', validate(linkedInConnectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params;
    const { note, profileUrl } = req.body;
    const data = await linkedinService.sendConnectionRequest(leadId, note, profileUrl);
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.post('/message/:leadId', validate(linkedInMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params;
    const { body } = req.body;
    const data = await linkedinService.sendLinkedInMessage(leadId, body);
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.post('/view/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params;
    const data = await linkedinService.viewProfile(leadId);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/profile/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params;
    const data = await linkedinService.getProfile(leadId);
    if (!data) {
      res.json({ data: null });
      return;
    }
    res.json({ data });
  } catch (err) { next(err); }
});

router.put('/profile/:leadId', validate(linkedInProfileUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params;
    const data = await linkedinService.updateProfile(leadId, req.body);
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/connections', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { status } = req.query as Record<string, string | undefined>;
    const result = await linkedinService.listConnections(status, page, pageSize);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
