import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { suppressionEntrySchema, suppressionImportSchema, paginationSchema } from '@leadgenius/shared';
import {
  addToSuppression,
  removeSuppressionById,
  isEmailSuppressed,
  importSuppressionList,
  exportSuppressionList,
  getSuppressionList,
} from '../services/suppression-list.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { data, total } = await getSuppressionList(page, pageSize);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.post('/', validate(suppressionEntrySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, reason, source, campaignId } = req.body as { email: string; reason: 'bounce' | 'unsubscribe' | 'complaint'; source?: string; campaignId?: string };
    const entry = await addToSuppression(email, reason, source, campaignId);
    res.status(201).json({ data: entry });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const entry = await removeSuppressionById(id);
    res.json({ data: entry });
  } catch (err) { next(err); }
});

router.post('/import', validate(suppressionImportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entries } = req.body as { entries: Array<{ email: string; reason: 'bounce' | 'unsubscribe' | 'complaint'; source?: string }> };
    const result = await importSuppressionList(entries);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

router.get('/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await exportSuppressionList();
    res.json({ data: entries });
  } catch (err) { next(err); }
});

router.get('/check/:email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.params.email as string;
    const suppressed = await isEmailSuppressed(email);
    res.json({ data: { email, suppressed } });
  } catch (err) { next(err); }
});

export default router;
