import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildMessage } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

vi.mock('../queue/index.js', () => ({
  sendQueue: { add: vi.fn().mockResolvedValue(undefined) },
  aiQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../services/ai/index.js', () => ({
  analyzeMessageIntent: vi.fn().mockResolvedValue({ category: 'interested', sentiment: 'positive', urgency: 'medium', confidence: 85 }),
  generateReplyDraft: vi.fn().mockResolvedValue({ subject: 'Re: Test', body: 'Thank you for your interest' }),
  enrichLeadData: vi.fn().mockResolvedValue({ companySize: '50-200', industry: 'Tech', suggestedTags: ['tech', 'saas'] }),
  generateCampaignSequence: vi.fn().mockResolvedValue({ steps: [{ subject: 'Step 1', body: 'Hello' }] }),
}));

vi.mock('../services/inbound-ai-pipeline.js', () => ({
  processInboundMessage: vi.fn().mockResolvedValue({ action: 'draft_generated', messageId: 'msg_1' }),
}));

const { default: inboxRoutes } = await import('./inbox.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/inbox', inboxRoutes);
  app.use(errorHandler);
  return app;
}

describe('Inbox API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/inbox', () => {
    it('should list inbound messages with pagination', async () => {
      const messages = [buildMessage({ direction: 'inbound' }), buildMessage({ direction: 'inbound' })];
      mockPrisma.message.findMany.mockResolvedValue(messages);
      mockPrisma.message.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/inbox?page=1&pageSize=20');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should only return inbound messages', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      await request(createApp()).get('/api/inbox?page=1&pageSize=50');

      expect(mockPrisma.message.findMany.mock.calls[0][0].where.direction).toBe('inbound');
    });

    it('should filter by intent category', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      await request(createApp()).get('/api/inbox?intentCategory=interested&page=1&pageSize=50');

      const where = mockPrisma.message.findMany.mock.calls[0][0].where;
      expect(where.intentAnalysis).toBeDefined();
    });
  });

  describe('GET /api/inbox/unread-count', () => {
    it('should return unread inbound message count', async () => {
      mockPrisma.message.count.mockResolvedValue(3);

      const res = await request(createApp()).get('/api/inbox/unread-count');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);
      expect(mockPrisma.message.count).toHaveBeenCalledWith({
        where: { direction: 'inbound', readAt: null },
      });
    });
  });

  describe('GET /api/inbox/conversations', () => {
    it('should list conversations grouped by lead', async () => {
      const leads = [
        {
          ...buildLead({ id: 'lead_1', name: 'Alice' }),
          messages: [buildMessage({ body: 'Last message', createdAt: new Date('2025-01-02') })],
          _count: { messages: 5 },
        },
      ];
      mockPrisma.lead.findMany.mockResolvedValue(leads as any);

      const res = await request(createApp()).get('/api/inbox/conversations');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].leadName).toBe('Alice');
      expect(res.body.data[0].messageCount).toBe(5);
    });

    it('should return empty array when no conversations', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/inbox/conversations');

      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/inbox/:leadId', () => {
    it('should return lead thread with messages', async () => {
      const lead = buildLead({ id: 'lead_1', name: 'Alice' });
      const messages = [
        buildMessage({ id: 'msg_1', direction: 'inbound', body: 'Hello' }),
        buildMessage({ id: 'msg_2', direction: 'outbound', body: 'Hi there' }),
      ];
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.message.findMany.mockResolvedValue(messages);

      const res = await request(createApp()).get('/api/inbox/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.lead.name).toBe('Alice');
      expect(res.body.data.messages).toHaveLength(2);
    });

    it('should return 404 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/inbox/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/inbox/:messageId/analyze', () => {
    it('should analyze message intent', async () => {
      const res = await request(createApp())
        .post('/api/inbox/msg_1/analyze');

      expect(res.status).toBe(200);
      expect(res.body.data.category).toBe('interested');
    });
  });

  describe('POST /api/inbox/:messageId/send-draft', () => {
    it('should create a reply from draft', async () => {
      const original = buildMessage({ id: 'msg_1', leadId: 'lead_1', channel: 'email' });
      mockPrisma.message.findUnique.mockResolvedValue({ ...original, lead: buildLead() });
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'reply_1', isAiGenerated: true }));

      const res = await request(createApp())
        .post('/api/inbox/msg_1/send-draft')
        .send({ draftBody: 'Thanks for your message!' });

      expect(res.status).toBe(200);
      expect(res.body.data.isAiGenerated).toBe(true);
    });

    it('should return 404 for non-existent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/inbox/nonexistent/send-draft')
        .send({ draftBody: 'Hello' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/inbox/review-queue', () => {
    it('should return messages pending review', async () => {
      const messages = [
        buildMessage({ id: 'msg_1', direction: 'inbound', reviewStatus: 'pending_review', draftReply: 'Draft reply' }),
      ];
      mockPrisma.message.findMany.mockResolvedValue(messages);
      mockPrisma.message.count.mockResolvedValue(1);

      const res = await request(createApp()).get('/api/inbox/review-queue?page=1&pageSize=20');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should return empty list when no pending reviews', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/inbox/review-queue');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('POST /api/inbox/:messageId/approve-draft', () => {
    it('should approve a pending draft and create outbound message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg_1', leadId: 'lead_1', channel: 'email',
        subject: 'Hello', draftReply: 'Thank you!', reviewStatus: 'pending_review',
      });
      mockPrisma.lead.findUnique.mockResolvedValue({ email: 'test@example.com', phone: null });
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'reply_1', isAiGenerated: true, reviewStatus: 'approved' }));
      mockPrisma.message.update.mockResolvedValue({});

      const res = await request(createApp())
        .post('/api/inbox/msg_1/approve-draft');

      expect(res.status).toBe(200);
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leadId: 'lead_1',
          direction: 'outbound',
          isAiGenerated: true,
          reviewStatus: 'approved',
          status: 'queued',
        }),
      });
    });

    it('should return 404 for non-existent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/inbox/nonexistent/approve-draft');

      expect(res.status).toBe(404);
    });

    it('should return 400 if message is not pending review', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg_1', reviewStatus: 'approved', draftReply: 'Hi',
      });

      const res = await request(createApp())
        .post('/api/inbox/msg_1/approve-draft');

      expect(res.status).toBe(400);
    });

    it('should return 400 if no draft reply exists', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg_1', reviewStatus: 'pending_review', draftReply: null,
      });

      const res = await request(createApp())
        .post('/api/inbox/msg_1/approve-draft');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/inbox/:messageId/reject-draft', () => {
    it('should reject a pending draft', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg_1', leadId: 'lead_1', channel: 'email',
        subject: 'Hello', reviewStatus: 'pending_review',
      });
      mockPrisma.message.update.mockResolvedValue({});

      const res = await request(createApp())
        .post('/api/inbox/msg_1/reject-draft');

      expect(res.status).toBe(200);
      expect(res.body.data.rejected).toBe(true);
      expect(res.body.data.reply).toBeNull();
    });

    it('should reject a draft and send manual reply', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg_1', leadId: 'lead_1', channel: 'email',
        subject: 'Hello', reviewStatus: 'pending_review',
      });
      mockPrisma.message.update.mockResolvedValue({});
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'reply_1', isAiGenerated: false }));

      const res = await request(createApp())
        .post('/api/inbox/msg_1/reject-draft')
        .send({ manualReply: 'My custom reply' });

      expect(res.status).toBe(200);
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          body: 'My custom reply',
          isAiGenerated: false,
        }),
      });
    });

    it('should return 404 for non-existent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/inbox/nonexistent/reject-draft');

      expect(res.status).toBe(404);
    });

    it('should return 400 if message is not pending review', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg_1', reviewStatus: 'approved',
      });

      const res = await request(createApp())
        .post('/api/inbox/msg_1/reject-draft');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/inbox/stats', () => {
    it('should return inbox statistics', async () => {
      mockPrisma.message.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(10);

      const res = await request(createApp()).get('/api/inbox/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.unread).toBe(5);
      expect(res.body.data.pendingReviews).toBe(3);
      expect(res.body.data.autoRepliedToday).toBe(10);
    });
  });
});
