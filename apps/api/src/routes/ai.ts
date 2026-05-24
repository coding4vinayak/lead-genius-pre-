import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { analyzeIntentSchema, generateDraftSchema, enrichLeadSchema, generateCampaignSchema } from '@leadgenius/shared';
import { analyzeMessageIntent, generateReplyDraft, enrichLeadData, generateCampaignSequence } from '../services/ai/index.js';
import { aiQueue } from '../queue/index.js';

const router = Router();

router.post('/analyze-intent', validate(analyzeIntentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await analyzeMessageIntent(req.body.messageId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/analyze-intent/async', validate(analyzeIntentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await aiQueue.add('analyze-intent', { messageId: req.body.messageId });
    res.json({ data: { queued: true } });
  } catch (err) { next(err); }
});

router.post('/generate-draft', validate(generateDraftSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await generateReplyDraft(req.body.messageId, req.body.tone);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/generate-draft/async', validate(generateDraftSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await aiQueue.add('generate-draft', { messageId: req.body.messageId, tone: req.body.tone });
    res.json({ data: { queued: true } });
  } catch (err) { next(err); }
});

router.post('/enrich-lead', validate(enrichLeadSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await enrichLeadData(req.body.leadId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/enrich-lead/async', validate(enrichLeadSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await aiQueue.add('enrich-lead', { leadId: req.body.leadId });
    res.json({ data: { queued: true } });
  } catch (err) { next(err); }
});

router.post('/generate-campaign', validate(generateCampaignSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await generateCampaignSequence(
      req.body.name,
      req.body.industry || '',
      req.body.product || '',
      req.body.channel,
      req.body.targetCount || 100,
    );
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
