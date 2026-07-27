import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { crmSyncSchema, crmOAuthCallbackSchema, crmFieldMappingSchema } from '@leadgenius/shared';
import {
  connectCrm,
  syncContacts,
  getSyncStatus,
  handleOAuthCallback,
  getOAuthUrl,
  getFieldMapping,
  updateFieldMapping,
} from '../services/crm-sync.js';

const router = Router();

router.post('/connect', validate(crmSyncSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { integrationId } = req.body as { integrationId: string };
    const authCode = (req.body as Record<string, string>).authCode || 'default_code';
    const result = await connectCrm(integrationId, authCode);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { integrationId, direction } = req.body as { integrationId: string; direction?: string };
    if (!integrationId) {
      res.status(400).json({ error: 'integrationId is required' });
      return;
    }
    const result = await syncContacts(integrationId, direction || 'bidirectional');
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrationId = req.query.integrationId as string;
    if (!integrationId) {
      res.status(400).json({ error: 'integrationId query parameter is required' });
      return;
    }
    const status = await getSyncStatus(integrationId);
    res.json({ data: status });
  } catch (err) { next(err); }
});

router.post('/oauth/callback', validate(crmOAuthCallbackSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, code } = req.body as { provider: string; code: string };
    const integration = await handleOAuthCallback(provider, code);
    res.status(201).json({ data: integration });
  } catch (err) { next(err); }
});

router.get('/oauth/url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = req.query.provider as string;
    if (!provider) {
      res.status(400).json({ error: 'provider query parameter is required' });
      return;
    }
    const url = getOAuthUrl(provider);
    res.json({ data: { url, provider } });
  } catch (err) { next(err); }
});

router.get('/field-mapping', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrationId = req.query.integrationId as string;
    if (!integrationId) {
      res.status(400).json({ error: 'integrationId query parameter is required' });
      return;
    }
    const mapping = await getFieldMapping(integrationId);
    res.json({ data: mapping });
  } catch (err) { next(err); }
});

router.put('/field-mapping', validate(crmFieldMappingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrationId = req.query.integrationId as string;
    if (!integrationId) {
      res.status(400).json({ error: 'integrationId query parameter is required' });
      return;
    }
    const { fieldMapping } = req.body as { fieldMapping: Record<string, string> };
    const result = await updateFieldMapping(integrationId, fieldMapping);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
