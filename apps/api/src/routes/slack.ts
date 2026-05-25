import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { slackConnectSchema, slackNotificationSchema } from '@leadgenius/shared';
import {
  connectSlack,
  listChannels,
  configureNotifications,
  testNotification,
} from '../services/slack-notifications.js';

const router = Router();

router.post('/connect', validate(slackConnectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body as { code: string };
    const integration = await connectSlack(code);
    res.status(201).json({ data: integration });
  } catch (err) { next(err); }
});

router.get('/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrationId = req.query.integrationId as string;
    if (!integrationId) {
      res.status(400).json({ error: 'integrationId query parameter is required' });
      return;
    }
    const channels = await listChannels(integrationId);
    res.json({ data: channels });
  } catch (err) { next(err); }
});

router.put('/notifications', validate(slackNotificationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { integrationId, channel, eventTypes, isActive } = req.body as {
      integrationId: string;
      channel: string;
      eventTypes: string[];
      isActive?: boolean;
    };
    const result = await configureNotifications(integrationId, { channel, eventTypes, isActive });
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { integrationId } = req.body as { integrationId: string };
    if (!integrationId) {
      res.status(400).json({ error: 'integrationId is required' });
      return;
    }
    const result = await testNotification(integrationId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
