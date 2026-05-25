import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWorkspace, buildWorkspaceMember, buildWorkspaceInvite } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: workspaceRoutes } = await import('./workspaces.js');

function createApp() {
  const app = express();
  app.use(express.json());
  // Inject a mock user
  app.use((req, _res, next) => {
    req.user = { userId: 'user_1', email: 'test@example.com', role: 'user' };
    next();
  });
  app.use('/api/workspaces', workspaceRoutes);
  app.use(errorHandler);
  return app;
}

describe('Workspaces API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/workspaces', () => {
    it('should list workspaces for user', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspaceMember.findMany.mockResolvedValue([
        { ...buildWorkspaceMember({ role: 'owner' }), workspace },
      ]);

      const res = await request(createApp()).get('/api/workspaces');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/workspaces', () => {
    it('should create a workspace', async () => {
      const workspace = buildWorkspace({ name: 'New Workspace', slug: 'new-workspace' });
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue(workspace);
      mockPrisma.workspaceMember.create.mockResolvedValue(buildWorkspaceMember({ role: 'owner' }));
      mockPrisma.user.update.mockResolvedValue({ id: 'user_1' });

      const res = await request(createApp())
        .post('/api/workspaces')
        .send({ name: 'New Workspace', slug: 'new-workspace' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Workspace');
    });

    it('should reject invalid slug', async () => {
      const res = await request(createApp())
        .post('/api/workspaces')
        .send({ name: 'Test', slug: 'Invalid Slug!' });

      expect(res.status).toBe(400);
    });

    it('should reject missing name', async () => {
      const res = await request(createApp())
        .post('/api/workspaces')
        .send({ slug: 'test-slug' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/workspaces/:id', () => {
    it('should return workspace by id', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const res = await request(createApp()).get(`/api/workspaces/${workspace.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(workspace.id);
    });

    it('should return 404 for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/workspaces/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/workspaces/:id', () => {
    it('should update workspace', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspace.update.mockResolvedValue({ ...workspace, name: 'Updated' });

      const res = await request(createApp())
        .put(`/api/workspaces/${workspace.id}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('should return 404 for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/workspaces/nonexistent')
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/workspaces/:id/invite', () => {
    it('should create an invite', async () => {
      const workspace = buildWorkspace();
      const invite = buildWorkspaceInvite();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspaceInvite.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.workspaceInvite.create.mockResolvedValue(invite);

      const res = await request(createApp())
        .post(`/api/workspaces/${workspace.id}/invite`)
        .send({ email: 'invited@example.com', role: 'member' });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('invited@example.com');
    });

    it('should reject invalid email', async () => {
      const res = await request(createApp())
        .post('/api/workspaces/ws_1/invite')
        .send({ email: 'not-an-email', role: 'member' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/workspaces/:id/members', () => {
    it('should return workspace members', async () => {
      const members = [
        { ...buildWorkspaceMember({ role: 'owner' }), user: { id: 'user_1', email: 'owner@test.com', name: 'Owner' } },
      ];
      mockPrisma.workspaceMember.findMany.mockResolvedValue(members);

      const res = await request(createApp()).get('/api/workspaces/ws_1/members');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('DELETE /api/workspaces/:id/members/:userId', () => {
    it('should remove a member', async () => {
      const member = buildWorkspaceMember({ role: 'member' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);
      mockPrisma.workspaceMember.delete.mockResolvedValue(member);

      const res = await request(createApp()).delete('/api/workspaces/ws_1/members/user_2');

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).delete('/api/workspaces/ws_1/members/user_2');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/workspaces/switch', () => {
    it('should switch workspace', async () => {
      const member = buildWorkspaceMember();
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);
      mockPrisma.user.update.mockResolvedValue({ id: 'user_1' });

      const res = await request(createApp())
        .post('/api/workspaces/switch')
        .send({ workspaceId: 'ws_1' });

      expect(res.status).toBe(200);
      expect(res.body.data.workspaceId).toBe('ws_1');
    });

    it('should return 404 if not a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/workspaces/switch')
        .send({ workspaceId: 'ws_unknown' });

      expect(res.status).toBe(404);
    });

    it('should reject missing workspaceId', async () => {
      const res = await request(createApp())
        .post('/api/workspaces/switch')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
