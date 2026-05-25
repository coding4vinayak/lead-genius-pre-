import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { publishEvent } from '../services/event-bus.js';

const router = Router();

router.post('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inboundWebhook = await prisma.inboundWebhook.findFirst({
      where: { token: (req.params.token as string) },
    });

    if (!inboundWebhook || !(inboundWebhook as { isActive: boolean }).isActive) {
      throw AppError.notFound('Webhook');
    }

    // Verify signature if secret is configured
    const secret = (inboundWebhook as Record<string, unknown>).secret as string | undefined;
    if (secret) {
      const signature = req.headers['x-webhook-signature'] as string;
      if (!signature) {
        throw new AppError(401, 'Missing webhook signature');
      }
      const payload = JSON.stringify(req.body);
      const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new AppError(401, 'Invalid webhook signature');
      }
    }

    const webhookId = (inboundWebhook as { id: string }).id;
    const automationId = (inboundWebhook as { automationId: string | null }).automationId;

    // Publish event
    await publishEvent('webhook.received', 'inboundWebhook', webhookId, {
      inboundWebhookId: webhookId,
      body: req.body,
    });

    // If linked to automation, trigger it directly
    if (automationId) {
      const { executeAutomation } = await import('../services/automation-engine.js');
      await executeAutomation(automationId, {
        inboundWebhookId: webhookId,
        body: req.body,
      });
    }

    res.json({ received: true });
  } catch (err) { next(err); }
});

export default router;
