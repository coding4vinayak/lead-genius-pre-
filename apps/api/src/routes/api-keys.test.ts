import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildApiKey, buildWorkspaceMember, buildWorkspace } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: apiKeyRoutes } = await import('./api-keys.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: 'user_1', email: 'test@example.com', role: 'user' };
    next();
  });
  app.use('/api/api-keys', apiKeyRoutes);
  app.use(errorHandler);
  return app;
}

describe('API Keys Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/api-keys', () => {
    it('should create a new API key', async () => {
      const member = buildWorkspaceMember({ workspaceId: 'ws_1', userId: 'user_1' });
      const workspace = buildWorkspace();
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ ...member, workspace });
      mockPrisma.apiKey.create.mockResolvedValue(buildApiKey({ workspaceId: 'ws_1', name: 'My Key' }));

      const res = await request(createApp())
        .post('/api/api-keys')
        .send({ name: 'My Key', permissions: ['read:leads'] });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('key');
      expect(res.body.data).toHaveProperty('name', 'My Key');
    });

    it('should return 400 for missing name', async () => {
      const res = await request(createApp())
        .post('/api/api-keys')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 when user has no workspace membership', async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/api-keys')
        .send({ name: 'My Key' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/api-keys', () => {
    it('should list API keys for workspace', async () => {
      const member = buildWorkspaceMember({ workspaceId: 'ws_1', userId: 'user_1' });
      mockPrisma.workspaceMember.findFirst.mockResolvedValue(member);

      const keys = [buildApiKey(), buildApiKey()];
      mockPrisma.apiKey.findMany.mockResolvedValue(keys);

      const res = await request(createApp()).get('/api/api-keys');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return masked keys', async () => {
      const member = buildWorkspaceMember({ workspaceId: 'ws_1', userId: 'user_1' });
      mockPrisma.workspaceMember.findFirst.mockResolvedValue(member);

      const key = buildApiKey({ prefix: 'lg_abcd1234', key: 'fullhashedkeyvalue1234' });
      mockPrisma.apiKey.findMany.mockResolvedValue([key]);

      const res = await request(createApp()).get('/api/api-keys');

      expect(res.status).toBe(200);
      expect(res.body.data[0].key).toContain('****');
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should revoke an API key', async () => {
      const apiKey = buildApiKey({ id: 'key_1', workspaceId: 'ws_1' });
      const member = buildWorkspaceMember({ workspaceId: 'ws_1', userId: 'user_1' });

      mockPrisma.apiKey.findUnique.mockResolvedValue(apiKey);
      mockPrisma.workspaceMember.findFirst.mockResolvedValue(member);
      mockPrisma.apiKey.update.mockResolvedValue({ ...apiKey, isActive: false });

      const res = await request(createApp()).delete('/api/api-keys/key_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('key_1');
    });

    it('should return 404 for non-existent key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).delete('/api/api-keys/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/api-keys/:id/usage', () => {
    it('should return usage statistics', async () => {
      const apiKey = buildApiKey({ id: 'key_1', workspaceId: 'ws_1' });
      const member = buildWorkspaceMember({ workspaceId: 'ws_1', userId: 'user_1' });

      mockPrisma.apiKey.findUnique.mockResolvedValue(apiKey);
      mockPrisma.workspaceMember.findFirst.mockResolvedValue(member);
      mockPrisma.apiKeyUsage.count.mockResolvedValue(10);
      mockPrisma.apiKeyUsage.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/api-keys/key_1/usage');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalRequests');
    });
  });
});
