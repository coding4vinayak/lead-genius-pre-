import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { getPlanLimits, getMonthlyUsage } from './usage-metering.js';

const PLAN_PRICES: Record<string, string> = {
  pro: 'price_pro_monthly',
  enterprise: 'price_enterprise_monthly',
};

export interface CheckoutSession {
  id: string;
  url: string;
  workspaceId: string;
  plan: string;
}

export async function createCheckoutSession(workspaceId: string, plan: string, successUrl?: string, cancelUrl?: string): Promise<CheckoutSession> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace');

  if (plan === 'free') throw AppError.validation('Cannot checkout for free plan');

  const priceId = PLAN_PRICES[plan];
  if (!priceId) throw AppError.validation('Invalid plan');

  // In production, this would call Stripe API to create a checkout session
  const sessionId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const sessionUrl = successUrl || `https://app.leadgenius.io/billing/success?session_id=${sessionId}`;

  return {
    id: sessionId,
    url: sessionUrl,
    workspaceId,
    plan,
  };
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export async function handleStripeWebhook(event: StripeWebhookEvent) {
  const { id, type, data } = event;

  // Deduplicate events
  const existing = await prisma.billingEvent.findUnique({ where: { stripeEventId: id } });
  if (existing) return { processed: false, reason: 'duplicate' };

  let workspaceId: string | undefined;

  if (type === 'checkout.session.completed') {
    const session = data.object;
    const metadata = session.metadata as Record<string, string> | undefined;
    workspaceId = metadata?.workspaceId;
    if (workspaceId && session.subscription) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          stripeSubscriptionId: session.subscription as string,
          stripeCustomerId: session.customer as string,
        },
      });
    }
  } else if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') {
    const subscription = data.object;
    const customerId = subscription.customer as string;
    const workspace = await prisma.workspace.findFirst({ where: { stripeCustomerId: customerId } });
    workspaceId = workspace?.id;

    if (workspace) {
      const plan = determinePlanFromSubscription(subscription);
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          plan: plan as 'free' | 'pro' | 'enterprise',
          stripeSubscriptionId: subscription.id as string,
        },
      });
    }
  } else if (type === 'customer.subscription.deleted') {
    const subscription = data.object;
    const customerId = subscription.customer as string;
    const workspace = await prisma.workspace.findFirst({ where: { stripeCustomerId: customerId } });
    workspaceId = workspace?.id;

    if (workspace) {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          plan: 'free',
          stripeSubscriptionId: null,
        },
      });
    }
  } else if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
    const invoice = data.object;
    const customerId = invoice.customer as string;
    const workspace = await prisma.workspace.findFirst({ where: { stripeCustomerId: customerId } });
    workspaceId = workspace?.id;
  }

  if (workspaceId) {
    await prisma.billingEvent.create({
      data: {
        workspaceId,
        stripeEventId: id,
        type,
        data: JSON.parse(JSON.stringify(data.object)),
      },
    });
  }

  return { processed: true };
}

function determinePlanFromSubscription(subscription: Record<string, unknown>): string {
  const items = subscription.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const priceId = items?.data?.[0]?.price?.id;

  if (priceId === PLAN_PRICES['enterprise']) return 'enterprise';
  if (priceId === PLAN_PRICES['pro']) return 'pro';
  return 'pro'; // default to pro for paid subscriptions
}

export async function getSubscription(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace');

  return {
    plan: workspace.plan,
    stripeSubscriptionId: workspace.stripeSubscriptionId,
    stripeCustomerId: workspace.stripeCustomerId,
  };
}

export async function cancelSubscription(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace');

  if (!workspace.stripeSubscriptionId) {
    throw AppError.validation('No active subscription to cancel');
  }

  // In production, this would call Stripe API to cancel the subscription
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      plan: 'free',
      stripeSubscriptionId: null,
    },
  });

  return { cancelled: true };
}

export async function getInvoices(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace');

  const events = await prisma.billingEvent.findMany({
    where: { workspaceId, type: { in: ['invoice.paid', 'invoice.payment_failed'] } },
    orderBy: { createdAt: 'desc' },
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    data: e.data,
    createdAt: e.createdAt,
  }));
}

export async function calculateOverage(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace');

  const limits = getPlanLimits(workspace.plan);
  const usage = await getMonthlyUsage(workspaceId);

  const overages: Record<string, { current: number; limit: number; overage: number }> = {};

  for (const [metric, limit] of Object.entries(limits)) {
    if (limit === Infinity) continue;
    const current = usage[metric] ?? 0;
    const overage = Math.max(0, current - limit);
    if (overage > 0) {
      overages[metric] = { current, limit, overage };
    }
  }

  return overages;
}
