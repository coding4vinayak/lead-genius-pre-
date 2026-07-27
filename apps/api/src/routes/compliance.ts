import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { gdprConsentSchema, unsubscribeSchema } from '@leadgenius/shared';
import { processUnsubscribeByToken, getUnsubscribeLandingPage } from '../services/unsubscribe.js';
import { recordConsent, revokeConsent, checkConsent, exportLeadData, deleteLeadData } from '../services/gdpr.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public endpoints - no auth required
router.post('/unsubscribe/:token', validate(unsubscribeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;
    const { reason } = req.body as { reason?: string };
    const ipAddress = (req.ip || req.socket.remoteAddress) as string | undefined;
    const record = await processUnsubscribeByToken(token, reason, ipAddress);
    if (!record) throw AppError.notFound('Unsubscribe token');
    res.json({ data: { message: 'Successfully unsubscribed', email: record.email } });
  } catch (err) { next(err); }
});

router.get('/unsubscribe/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;
    const data = await getUnsubscribeLandingPage(token);
    if (!data) throw AppError.notFound('Unsubscribe token');
    res.json({ data });
  } catch (err) { next(err); }
});

// Protected endpoints - require auth
router.get('/gdpr/export/:leadId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.leadId as string;
    const data = await exportLeadData(leadId);
    if (!data) throw AppError.notFound('Lead');
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/gdpr/:leadId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.leadId as string;
    const result = await deleteLeadData(leadId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/consent/:leadId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.leadId as string;
    const consents = await checkConsent(leadId);
    res.json({ data: consents });
  } catch (err) { next(err); }
});

router.post('/consent', requireAuth, validate(gdprConsentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId, consentType, source } = req.body as { leadId: string; consentType: 'marketing_email' | 'marketing_sms' | 'data_processing' | 'third_party_sharing'; source?: string };
    const consent = await recordConsent(leadId, consentType, source);
    res.status(201).json({ data: consent });
  } catch (err) { next(err); }
});

router.delete('/consent/:leadId/:consentType', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.leadId as string;
    const consentType = req.params.consentType as string;
    const consent = await revokeConsent(leadId, consentType as 'marketing_email' | 'marketing_sms' | 'data_processing' | 'third_party_sharing');
    res.json({ data: consent });
  } catch (err) { next(err); }
});

export default router;
