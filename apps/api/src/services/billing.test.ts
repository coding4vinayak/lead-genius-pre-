import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWorkspace, buildBillingEvent } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  createCheckoutSession,
  handleStripeWebhook,
  getSubscription,
  cancelSubscription,
  getInvoices,
  calculateOverage,
} = await import('./billing.js');

describe('Billing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session for pro plan', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const result = await createCheckoutSession(workspace.id, 'pro');

      expect(result.id).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.workspaceId).toBe(workspace.id);
      expect(result.plan).toBe('pro');
    });

    it('should create checkout session for enterprise plan', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const result = await createCheckoutSession(workspace.id, 'enterprise');

      expect(result.plan).toBe('enterprise');
    });

    it('should throw not found for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(createCheckoutSession('nonexistent', 'pro')).rejects.toThrow('not found');
    });

    it('should throw validation error for free plan', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      await expect(createCheckoutSession(workspace.id, 'free')).rejects.toThrow('Cannot checkout for free plan');
    });

    it('should use successUrl when provided', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const result = await createCheckoutSession(workspace.id, 'pro', 'https://example.com/success');

      expect(result.url).toBe('https://example.com/success');
    });
  });

  describe('handleStripeWebhook', () => {
    it('should process checkout.session.completed event', async () => {
      const workspace = buildWorkspace();
      mockPrisma.billingEvent.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.update.mockResolvedValue(workspace);
      mockPrisma.billingEvent.create.mockResolvedValue(buildBillingEvent());

      const event = {
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { workspaceId: workspace.id },
            subscription: 'sub_123',
            customer: 'cus_123',
          },
        },
      };

      const result = await handleStripeWebhook(event);

      expect(result.processed).toBe(true);
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspace.id },
        data: { stripeSubscriptionId: 'sub_123', stripeCustomerId: 'cus_123' },
      });
    });

    it('should skip duplicate events', async () => {
      const existingEvent = buildBillingEvent();
      mockPrisma.billingEvent.findUnique.mockResolvedValue(existingEvent);

      const event = {
        id: 'evt_duplicate',
        type: 'checkout.session.completed',
        data: { object: {} },
      };

      const result = await handleStripeWebhook(event);

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('duplicate');
    });

    it('should handle customer.subscription.deleted event', async () => {
      const workspace = buildWorkspace({ stripeCustomerId: 'cus_123' });
      mockPrisma.billingEvent.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.findFirst.mockResolvedValue(workspace);
      mockPrisma.workspace.update.mockResolvedValue({ ...workspace, plan: 'free' });
      mockPrisma.billingEvent.create.mockResolvedValue(buildBillingEvent());

      const event = {
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_123', customer: 'cus_123' },
        },
      };

      const result = await handleStripeWebhook(event);

      expect(result.processed).toBe(true);
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspace.id },
        data: { plan: 'free', stripeSubscriptionId: null },
      });
    });

    it('should handle customer.subscription.updated event', async () => {
      const workspace = buildWorkspace({ stripeCustomerId: 'cus_123' });
      mockPrisma.billingEvent.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.findFirst.mockResolvedValue(workspace);
      mockPrisma.workspace.update.mockResolvedValue({ ...workspace, plan: 'pro' });
      mockPrisma.billingEvent.create.mockResolvedValue(buildBillingEvent());

      const event = {
        id: 'evt_sub_updated',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            items: { data: [{ price: { id: 'price_pro_monthly' } }] },
          },
        },
      };

      const result = await handleStripeWebhook(event);

      expect(result.processed).toBe(true);
    });

    it('should handle invoice.paid event', async () => {
      const workspace = buildWorkspace({ stripeCustomerId: 'cus_123' });
      mockPrisma.billingEvent.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.findFirst.mockResolvedValue(workspace);
      mockPrisma.billingEvent.create.mockResolvedValue(buildBillingEvent());

      const event = {
        id: 'evt_invoice_paid',
        type: 'invoice.paid',
        data: {
          object: { customer: 'cus_123', amount_paid: 4900 },
        },
      };

      const result = await handleStripeWebhook(event);

      expect(result.processed).toBe(true);
      expect(mockPrisma.billingEvent.create).toHaveBeenCalled();
    });
  });

  describe('getSubscription', () => {
    it('should return subscription info', async () => {
      const workspace = buildWorkspace({ plan: 'pro', stripeSubscriptionId: 'sub_123', stripeCustomerId: 'cus_123' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const result = await getSubscription(workspace.id);

      expect(result.plan).toBe('pro');
      expect(result.stripeSubscriptionId).toBe('sub_123');
      expect(result.stripeCustomerId).toBe('cus_123');
    });

    it('should throw not found for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(getSubscription('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription and downgrade to free', async () => {
      const workspace = buildWorkspace({ plan: 'pro', stripeSubscriptionId: 'sub_123' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspace.update.mockResolvedValue({ ...workspace, plan: 'free', stripeSubscriptionId: null });

      const result = await cancelSubscription(workspace.id);

      expect(result.cancelled).toBe(true);
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: workspace.id },
        data: { plan: 'free', stripeSubscriptionId: null },
      });
    });

    it('should throw not found for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(cancelSubscription('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw if no active subscription', async () => {
      const workspace = buildWorkspace({ stripeSubscriptionId: null });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      await expect(cancelSubscription(workspace.id)).rejects.toThrow('No active subscription');
    });
  });

  describe('getInvoices', () => {
    it('should return billing events', async () => {
      const workspace = buildWorkspace();
      const events = [buildBillingEvent({ type: 'invoice.paid' })];
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.billingEvent.findMany.mockResolvedValue(events);

      const result = await getInvoices(workspace.id);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('invoice.paid');
    });

    it('should throw not found for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(getInvoices('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('calculateOverage', () => {
    it('should return empty for workspace within limits', async () => {
      const workspace = buildWorkspace({ plan: 'free' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const result = await calculateOverage(workspace.id);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return overage for exceeded limit', async () => {
      const workspace = buildWorkspace({ plan: 'free' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        { id: 'ur_1', workspaceId: workspace.id, metric: 'emails_sent', value: 150, period: 'monthly', periodStart: new Date(), periodEnd: new Date(), createdAt: new Date() },
      ]);

      const result = await calculateOverage(workspace.id);

      expect(result.emails_sent).toBeDefined();
      expect(result.emails_sent.overage).toBe(50);
      expect(result.emails_sent.current).toBe(150);
      expect(result.emails_sent.limit).toBe(100);
    });

    it('should throw not found for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(calculateOverage('nonexistent')).rejects.toThrow('not found');
    });

    it('should return no overage for enterprise plan', async () => {
      const workspace = buildWorkspace({ plan: 'enterprise' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const result = await calculateOverage(workspace.id);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
