import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildNotification, buildNotificationPreference } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../services/websocket.js', () => ({
  broadcastToUser: vi.fn(),
  broadcastToAll: vi.fn(),
  getConnectedCount: vi.fn().mockReturnValue(0),
}));

const { default: notificationRoutes } = await import('./notifications.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: 'user_1', email: 'test@example.com', role: 'user' };
    next();
  });
  app.use('/api/notifications', notificationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Notifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should return paginated notifications for the user', async () => {
      const notifications = [buildNotification(), buildNotification()];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);
      mockPrisma.notification.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/notifications?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
    });

    it('should return empty list when no notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/notifications?page=1&pageSize=50');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should use default pagination values', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(mockPrisma.notification.count).toHaveBeenCalledOnce();
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const res = await request(createApp()).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(5);
    });

    it('should return 0 when all read', async () => {
      mockPrisma.notification.count.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const notification = buildNotification({ id: 'notif_1', userId: 'user_1' });
      mockPrisma.notification.findUnique.mockResolvedValue(notification);
      mockPrisma.notification.update.mockResolvedValue({ ...notification, isRead: true, readAt: new Date() });

      const res = await request(createApp()).patch('/api/notifications/notif_1/read');

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).patch('/api/notifications/nonexistent/read');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
    });

    it('should return 404 if notification belongs to another user', async () => {
      const notification = buildNotification({ id: 'notif_1', userId: 'other_user' });
      mockPrisma.notification.findUnique.mockResolvedValue(notification);

      const res = await request(createApp()).patch('/api/notifications/notif_1/read');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const res = await request(createApp()).post('/api/notifications/mark-all-read');

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(3);
    });

    it('should handle case with no unread notifications', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const res = await request(createApp()).post('/api/notifications/mark-all-read');

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(0);
    });
  });

  describe('GET /api/notifications/preferences', () => {
    it('should return user preferences', async () => {
      const preferences = [
        buildNotificationPreference({ eventType: 'lead.replied', channel: 'in_app' }),
        buildNotificationPreference({ eventType: 'campaign.completed', channel: 'both' }),
      ];
      mockPrisma.notificationPreference.findMany.mockResolvedValue(preferences);

      const res = await request(createApp()).get('/api/notifications/preferences');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array when no preferences set', async () => {
      mockPrisma.notificationPreference.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/notifications/preferences');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('PUT /api/notifications/preferences', () => {
    it('should update notification preferences', async () => {
      const pref = buildNotificationPreference({ eventType: 'lead.replied', channel: 'both' });
      mockPrisma.notificationPreference.upsert.mockResolvedValue(pref);

      const res = await request(createApp())
        .put('/api/notifications/preferences')
        .send({ preferences: [{ eventType: 'lead.replied', channel: 'both' }] });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should reject invalid event type', async () => {
      const res = await request(createApp())
        .put('/api/notifications/preferences')
        .send({ preferences: [{ eventType: 'invalid.type', channel: 'in_app' }] });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toBeDefined();
    });

    it('should reject invalid channel', async () => {
      const res = await request(createApp())
        .put('/api/notifications/preferences')
        .send({ preferences: [{ eventType: 'lead.replied', channel: 'invalid' }] });

      expect(res.status).toBe(400);
    });

    it('should reject empty preferences array', async () => {
      const res = await request(createApp())
        .put('/api/notifications/preferences')
        .send({ preferences: [] });

      expect(res.status).toBe(400);
    });
  });
});
