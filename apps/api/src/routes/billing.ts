import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { billingCheckoutSchema } from '@leadgenius/shared';
import { requireAuth } from '../middleware/auth.js';
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

router.post('/checkout', requireAuth, validate(billingCheckoutSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plan, successUrl, cancelUrl } = req.body as { plan: string; successUrl?: string; cancelUrl?: string };
    // Use a workspace ID from the user's context - for simplicity, use a header or body param
    const workspaceId = req.headers['x-workspace-id'] as string || req.body.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const session = await createCheckoutSession(workspaceId, plan, successUrl, cancelUrl);
    res.json({ data: session });
  } catch (err) { next(err); }
});

router.get('/subscription', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const subscription = await getSubscription(workspaceId);
    res.json({ data: subscription });
  } catch (err) { next(err); }
});

router.post('/cancel', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const result = await cancelSubscription(workspaceId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/invoices', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 400, message: 'Workspace ID is required' } });
    }
    const invoices = await getInvoices(workspaceId);
    res.json({ data: invoices });
  } catch (err) { next(err); }
});

router.get('/usage', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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

    // In production, verify Stripe signature here
    // const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    const event = req.body;

    if (!event || !event.id || !event.type) {
      return res.status(400).json({ error: { code: 400, message: 'Invalid webhook payload' } });
    }

    const result = await handleStripeWebhook(event);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
