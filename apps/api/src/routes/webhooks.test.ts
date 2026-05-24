import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildMessage } from '../test/factories.js';
import crypto from 'crypto';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

vi.mock('../config.js', () => ({
  config: {
    webhookSecret: 'test-secret',
    ai: {},
  },
}));

vi.mock('../services/channel-health.js', () => ({
  updateChannelMetrics: vi.fn().mockResolvedValue({}),
}));

const { default: webhookRoutes } = await import('./webhooks.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/webhook', webhookRoutes);
  app.use(errorHandler);
  return app;
}

describe('Webhooks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /webhook/email', () => {
    it('should handle a reply email', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1', email: 'lead@test.com' }));
      mockPrisma.message.findFirst.mockResolvedValue(buildMessage({ id: 'msg_1', campaignId: 'camp_1' }));
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'inbound_1' }));
      mockPrisma.campaign.update.mockResolvedValue({} as any);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/webhook/email')
        .send({ to: 'lead@test.com', subject: 'Re: Hello', text: 'Thanks!', messageId: 'ext-msg-1' });

      expect(res.status).toBe(200);
      expect(res.body.data.processed).toBe(true);
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });

    it('should handle a bounce event', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1' }));
      mockPrisma.message.findFirst.mockResolvedValue(buildMessage({ id: 'msg_1' }));

      const res = await request(createApp())
        .post('/webhook/email')
        .send({ to: 'lead@test.com', event: 'bounce', messageId: 'ext-msg-1' });

      expect(res.status).toBe(200);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'bounced' } }),
      );
    });

    it('should ignore unknown leads', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/webhook/email')
        .send({ to: 'unknown@test.com', subject: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.data.ignored).toBe(true);
    });

    it('should handle an open event', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1' }));
      mockPrisma.message.findFirst.mockResolvedValue(buildMessage({ id: 'msg_1' }));

      const res = await request(createApp())
        .post('/webhook/email')
        .send({ to: 'lead@test.com', event: 'open', messageId: 'ext-msg-1' });

      expect(res.status).toBe(200);
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { readAt: expect.any(Date) } }),
      );
    });
  });

  describe('webhook signature verification', () => {
    it('should reject webhook with invalid signature', async () => {
      const res = await request(createApp())
        .post('/webhook/email')
        .set('x-webhook-signature', 'invalid-signature')
        .send({ to: 'lead@test.com', event: 'bounce' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Invalid webhook signature');
    });

    it('should accept webhook with valid signature', async () => {
      const payload = { to: 'lead@test.com', event: 'bounce' };
      const signature = crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex');

      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1' }));
      mockPrisma.message.findFirst.mockResolvedValue(buildMessage({ id: 'msg_1' }));

      const res = await request(createApp())
        .post('/webhook/email')
        .set('x-webhook-signature', signature)
        .send(payload);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /webhook/whatsapp', () => {
    it('should handle an incoming WhatsApp message', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1', phone: '+1234567890' }));
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'inbound_wa' }));
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/webhook/whatsapp')
        .send({ From: 'whatsapp:+1234567890', Body: 'Hello from WhatsApp', MessageSid: 'SM123' });

      expect(res.status).toBe(200);
      expect(res.body.data.processed).toBe(true);
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });

    it('should ignore unknown numbers', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/webhook/whatsapp')
        .send({ From: 'whatsapp:+9999999999', Body: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.data.ignored).toBe(true);
    });

    it('should strip whatsapp: prefix from phone number', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1' }));
      mockPrisma.message.create.mockResolvedValue(buildMessage());
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

      await request(createApp())
        .post('/webhook/whatsapp')
        .send({ From: 'whatsapp:+1234567890', Body: 'Test' });

      expect(mockPrisma.lead.findFirst.mock.calls[0][0].where.phone).toBe('+1234567890');
    });
  });

  describe('Lead scoring and channel health integration', () => {
    it('should pause active sequence enrollments on reply when pauseOnReply is true', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1', email: 'lead@test.com' }));
      mockPrisma.message.findFirst.mockResolvedValue(buildMessage({ id: 'msg_1', campaignId: 'camp_1' }));
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'inbound_1' }));
      mockPrisma.campaign.update.mockResolvedValue({} as any);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        {
          id: 'enroll_1',
          leadId: 'lead_1',
          status: 'active',
          sequence: { pauseOnReply: true },
        },
      ]);
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      const res = await request(createApp())
        .post('/webhook/email')
        .send({ to: 'lead@test.com', subject: 'Re: Hello', text: 'Thanks!', messageId: 'ext-msg-1' });

      expect(res.status).toBe(200);
      expect(mockPrisma.sequenceEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'enroll_1' },
        data: { status: 'paused', exitReason: 'replied' },
      });
    });

    it('should not pause sequence enrollment when pauseOnReply is false', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1', email: 'lead@test.com' }));
      mockPrisma.message.findFirst.mockResolvedValue(buildMessage({ id: 'msg_1', campaignId: 'camp_1' }));
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'inbound_1' }));
      mockPrisma.campaign.update.mockResolvedValue({} as any);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        {
          id: 'enroll_2',
          leadId: 'lead_1',
          status: 'active',
          sequence: { pauseOnReply: false },
        },
      ]);

      const res = await request(createApp())
        .post('/webhook/email')
        .send({ to: 'lead@test.com', subject: 'Re: Hello', text: 'Thanks!', messageId: 'ext-msg-1' });

      expect(res.status).toBe(200);
      expect(mockPrisma.sequenceEnrollment.update).not.toHaveBeenCalled();
    });

    it('should handle delivered event and update channel metrics', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1' }));
      mockPrisma.message.findFirst.mockResolvedValue(buildMessage({ id: 'msg_1' }));

      const res = await request(createApp())
        .post('/webhook/email')
        .send({ to: 'lead@test.com', event: 'delivered', messageId: 'ext-msg-1' });

      expect(res.status).toBe(200);
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'delivered' }) }),
      );
    });

    it('should pause WhatsApp sequence enrollments on inbound message', async () => {
      mockPrisma.lead.findFirst.mockResolvedValue(buildLead({ id: 'lead_1', phone: '+1234567890' }));
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'inbound_wa' }));
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        {
          id: 'enroll_3',
          leadId: 'lead_1',
          status: 'active',
          sequence: { pauseOnReply: true },
        },
      ]);
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      const res = await request(createApp())
        .post('/webhook/whatsapp')
        .send({ From: 'whatsapp:+1234567890', Body: 'Hello', MessageSid: 'SM123' });

      expect(res.status).toBe(200);
      expect(mockPrisma.sequenceEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'enroll_3' },
        data: { status: 'paused', exitReason: 'replied' },
      });
    });
  });
});
