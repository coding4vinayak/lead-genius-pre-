import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWorkspace, buildBillingEvent, buildWorkspaceMember } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../config.js', () => ({
  config: { jwtSecret: 'test-secret', jwtExpiresIn: '7d', port: 3000, stripeWebhookSecret: 'whsec_test_secret' },
}));

const { default: billingRoutes } = await import('./billing.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRoutes);
  app.use(errorHandler);
  return app;
}

function authToken() {
  // We need to generate a token for the requireAuth middleware
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId: 'user_1', email: 'test@example.com', role: 'user' }, 'test-secret', { expiresIn: '7d' });
}

function generateStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Billing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is a member of the workspace
    mockPrisma.workspaceMember.findUnique.mockResolvedValue(buildWorkspaceMember({ role: 'owner' }));
  });

  describe('POST /api/billing/checkout', () => {
    it('should create checkout session', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const res = await request(createApp())
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-workspace-id', workspace.id)
        .send({ plan: 'pro' });

      expect(res.status).toBe(200);
      expect(res.body.data.plan).toBe('pro');
      expect(res.body.data.url).toBeDefined();
    });

    it('should return 401 without auth', async () => {
      const res = await request(createApp())
        .post('/api/billing/checkout')
        .send({ plan: 'pro' });

      expect(res.status).toBe(401);
    });

    it('should return 400 without workspace ID', async () => {
      // Workspace membership middleware returns 400 when no workspace id
      const res = await request(createApp())
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({ plan: 'pro' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid plan', async () => {
      const res = await request(createApp())
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-workspace-id', 'ws_1')
        .send({ plan: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should return 403 if not a workspace member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/billing/checkout')
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-workspace-id', 'ws_1')
        .send({ plan: 'pro' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/billing/subscription', () => {
    it('should return subscription info', async () => {
      const workspace = buildWorkspace({ plan: 'pro', stripeSubscriptionId: 'sub_123', stripeCustomerId: 'cus_123' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const res = await request(createApp())
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-workspace-id', workspace.id);

      expect(res.status).toBe(200);
      expect(res.body.data.plan).toBe('pro');
    });

    it('should return 400 without workspace ID', async () => {
      const res = await request(createApp())
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/billing/cancel', () => {
    it('should cancel subscription', async () => {
      const workspace = buildWorkspace({ plan: 'pro', stripeSubscriptionId: 'sub_123' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspace.update.mockResolvedValue({ ...workspace, plan: 'free', stripeSubscriptionId: null });

      const res = await request(createApp())
        .post('/api/billing/cancel')
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-workspace-id', workspace.id);

      expect(res.status).toBe(200);
      expect(res.body.data.cancelled).toBe(true);
    });

    it('should return 400 without workspace ID', async () => {
      const res = await request(createApp())
        .post('/api/billing/cancel')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(400);
    });

    it('should return 403 for non-owner', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(buildWorkspaceMember({ role: 'member' }));

      const res = await request(createApp())
        .post('/api/billing/cancel')
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-workspace-id', 'ws_1');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/billing/invoices', () => {
    it('should return invoices', async () => {
      const workspace = buildWorkspace();
      const events = [buildBillingEvent({ type: 'invoice.paid' })];
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.billingEvent.findMany.mockResolvedValue(events);

      const res = await request(createApp())
        .get('/api/billing/invoices')
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-workspace-id', workspace.id);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/billing/usage', () => {
    it('should return usage and overage', async () => {
      const workspace = buildWorkspace({ plan: 'free' });
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .get('/api/billing/usage')
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-workspace-id', workspace.id);

      expect(res.status).toBe(200);
      expect(res.body.data.usage).toBeDefined();
      expect(res.body.data.overage).toBeDefined();
    });
  });

  describe('POST /api/billing/stripe (webhook)', () => {
    it('should process webhook with valid signature', async () => {
      mockPrisma.billingEvent.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.findFirst.mockResolvedValue(buildWorkspace({ stripeCustomerId: 'cus_123' }));
      mockPrisma.billingEvent.create.mockResolvedValue(buildBillingEvent());

      const payload = JSON.stringify({
        id: 'evt_test_123',
        type: 'invoice.paid',
        data: { object: { customer: 'cus_123', amount_paid: 4900 } },
      });
      const signature = generateStripeSignature(payload, 'whsec_test_secret');

      const res = await request(createApp())
        .post('/api/billing/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.processed).toBe(true);
    });

    it('should reject webhook without signature', async () => {
      const res = await request(createApp())
        .post('/api/billing/stripe')
        .send({ id: 'evt_test', type: 'invoice.paid', data: { object: {} } });

      expect(res.status).toBe(400);
    });

    it('should reject invalid webhook signature', async () => {
      const payload = JSON.stringify({ id: 'evt_test', type: 'invoice.paid', data: { object: {} } });

      const res = await request(createApp())
        .post('/api/billing/stripe')
        .set('stripe-signature', 't=12345,v1=invalidsignature')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid webhook signature');
    });

    it('should reject invalid signature format', async () => {
      const res = await request(createApp())
        .post('/api/billing/stripe')
        .set('stripe-signature', 'bad_format')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ id: 'evt_test', type: 'invoice.paid', data: { object: {} } }));

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid stripe-signature format');
    });

    it('should reject invalid webhook payload', async () => {
      const payload = JSON.stringify({ invalid: true });
      const signature = generateStripeSignature(payload, 'whsec_test_secret');

      const res = await request(createApp())
        .post('/api/billing/stripe')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(400);
    });
  });
});
