import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildMessage } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: messageRoutes } = await import('./messages.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/messages', messageRoutes);
  app.use(errorHandler);
  return app;
}

describe('Messages API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/messages', () => {
    it('should list messages with pagination', async () => {
      const messages = [buildMessage(), buildMessage()];
      mockPrisma.message.findMany.mockResolvedValue(messages);
      mockPrisma.message.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/messages?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should filter by channel', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      await request(createApp()).get('/api/messages?channel=email&page=1&pageSize=50');

      expect(mockPrisma.message.findMany.mock.calls[0][0].where.channel).toBe('email');
    });

    it('should filter by status', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      await request(createApp()).get('/api/messages?status=failed&page=1&pageSize=50');

      expect(mockPrisma.message.findMany.mock.calls[0][0].where.status).toBe('failed');
    });

    it('should filter by campaignId', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      await request(createApp()).get('/api/messages?campaignId=camp_1&page=1&pageSize=50');

      expect(mockPrisma.message.findMany.mock.calls[0][0].where.campaignId).toBe('camp_1');
    });

    it('should include lead and campaign relations', async () => {
      mockPrisma.message.findMany.mockResolvedValue([buildMessage()]);
      mockPrisma.message.count.mockResolvedValue(1);

      await request(createApp()).get('/api/messages?page=1&pageSize=50');

      const include = mockPrisma.message.findMany.mock.calls[0][0].include;
      expect(include.lead.select).toEqual({ name: true, email: true });
      expect(include.campaign.select).toEqual({ name: true });
    });

    it('should return empty array when no messages', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/messages?page=1&pageSize=50');

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should return a message by id', async () => {
      const msg = buildMessage({ id: 'msg_1' });
      mockPrisma.message.findUnique.mockResolvedValue(msg);

      const res = await request(createApp()).get('/api/messages/msg_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('msg_1');
    });

    it('should return 404 for non-existent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/messages/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Message not found');
    });
  });

  describe('POST /api/messages', () => {
    it('should create a message', async () => {
      const newMsg = buildMessage({ id: 'msg_new', leadId: 'lead_1', body: 'Hello' });
      mockPrisma.message.create.mockResolvedValue(newMsg);

      const res = await request(createApp())
        .post('/api/messages')
        .send({ leadId: 'lead_1', channel: 'email', body: 'Hello' });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('msg_new');
    });

    it('should reject missing body', async () => {
      const res = await request(createApp())
        .post('/api/messages')
        .send({ leadId: 'lead_1', channel: 'email' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid channel', async () => {
      const res = await request(createApp())
        .post('/api/messages')
        .send({ leadId: 'lead_1', channel: 'sms', body: 'Hello' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/messages/:id', () => {
    it('should update a message', async () => {
      const existing = buildMessage({ id: 'msg_1', status: 'queued' as const });
      mockPrisma.message.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, status: 'sent' as const };
      mockPrisma.message.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/messages/msg_1')
        .send({ leadId: 'lead_1', channel: 'email', body: 'Updated', status: 'sent' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('sent');
    });

    it('should return 404 for non-existent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/messages/nonexistent')
        .send({ leadId: 'lead_1', channel: 'email', body: 'Test' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('should delete a message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(buildMessage({ id: 'msg_1' }));
      mockPrisma.message.delete.mockResolvedValue(buildMessage({ id: 'msg_1' }));

      const res = await request(createApp()).delete('/api/messages/msg_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('msg_1');
    });

    it('should return 404 for non-existent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).delete('/api/messages/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
