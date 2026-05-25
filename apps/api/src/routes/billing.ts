import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { validate } from '../middleware/validate.js';
import { billingCheckoutSchema } from '@leadgenius/shared';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../services/rbac.js';
import { requireWorkspaceMembership } from '../middleware/workspace-membership.js';
import { config } from '../config.js';
import {
  createCheckoutSession,
  getSubscription,
  cancelSubscription,
  getInvoices,
  handleStripeWebhook,
  calculateOverage,
} from '../services/billing.js';
import { getMonthlyUsage } from '../services/usage-metering.js';

const router = Router();

router.post('/checkout', requireAuth, requireWorkspaceMembership, validate(billingCheckoutSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan, successUrl, cancelUrl } = req.body as { plan: string; successUrl?: string; cancelUrl?: string };
    const workspaceId = req.headers['x-workspace-id'] as string || req.body.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const session = await createCheckoutSession(workspaceId, plan, successUrl, cancelUrl);
    res.json({ data: session });
  } catch (err) { next(err); }
});

router.get('/subscription', requireAuth, requireWorkspaceMembership, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const subscription = await getSubscription(workspaceId);
    res.json({ data: subscription });
  } catch (err) { next(err); }
});

router.post('/cancel', requireAuth, requireWorkspaceMembership, requireRole('owner'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const result = await cancelSubscription(workspaceId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/invoices', requireAuth, requireWorkspaceMembership, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const invoices = await getInvoices(workspaceId);
    res.json({ data: invoices });
  } catch (err) { next(err); }
});

router.get('/usage', requireAuth, requireWorkspaceMembership, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const [usage, overage] = await Promise.all([
      getMonthlyUsage(workspaceId),
      calculateOverage(workspaceId),
    ]);
    res.json({ data: { usage, overage } });
  } catch (err) { next(err); }
});

// Stripe webhook - public endpoint, no auth but verify signature
router.post('/stripe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: { code: 400, message: 'Missing stripe-signature header' } });
    }

    // Verify Stripe webhook signature using HMAC
    const webhookSecret = config.stripeWebhookSecret;
    if (!webhookSecret) {
      return res.status(500).json({ error: { code: 500, message: 'Stripe webhook secret not configured' } });
    }

    // Parse Stripe signature header (format: t=timestamp,v1=signature)
    const elements = signature.split(',');
    const timestampElement = elements.find((e) => e.startsWith('t='));
    const signatureElement = elements.find((e) => e.startsWith('v1='));

    if (!timestampElement || !signatureElement) {
      return res.status(400).json({ error: { code: 400, message: 'Invalid stripe-signature format' } });
    }

    const timestamp = timestampElement.slice(2);
    const expectedSignature = signatureElement.slice(3);

    // Construct the signed payload (timestamp.payload)
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const signedPayload = `${timestamp}.${payload}`;
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    // Prevent timing attacks; also handle length mismatch safely
    const sigBuffer = Buffer.from(expectedSignature, 'utf8');
    const computedBuffer = Buffer.from(computedSignature, 'utf8');
    if (sigBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(computedBuffer, sigBuffer)) {
      return res.status(400).json({ error: { code: 400, message: 'Invalid webhook signature' } });
    }

    // Reject timestamps older than 5 minutes to prevent replay attacks
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - parseInt(timestamp, 10) > 300) {
      return res.status(400).json({ error: { code: 400, message: 'Webhook timestamp too old' } });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!event || !event.id || !event.type) {
      return res.status(400).json({ error: { code: 400, message: 'Invalid webhook payload' } });
    }

    const result = await handleStripeWebhook(event);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
