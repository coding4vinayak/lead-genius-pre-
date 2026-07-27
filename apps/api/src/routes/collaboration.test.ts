import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLeadNote, buildLeadActivity, buildAssignmentRule, buildLead } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../services/notification.js', () => ({ createNotification: vi.fn().mockResolvedValue({}) }));
vi.mock('../services/websocket.js', () => ({ broadcastToUser: vi.fn() }));

const { default: collaborationRoutes } = await import('./collaboration.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: 'user_1', email: 'test@example.com', role: 'user' };
    next();
  });
  app.use('/api', collaborationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Collaboration API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/leads/:id/notes', () => {
    it('should create a note', async () => {
      const note = buildLeadNote({ body: 'Test note' });
      mockPrisma.leadNote.create.mockResolvedValue(note);
      mockPrisma.leadActivity.create.mockResolvedValue({});

      const res = await request(createApp())
        .post('/api/leads/lead_1/notes')
        .send({ body: 'Test note' });

      expect(res.status).toBe(201);
      expect(res.body.data.body).toBe('Test note');
    });

    it('should reject empty body', async () => {
      const res = await request(createApp())
        .post('/api/leads/lead_1/notes')
        .send({ body: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/leads/:id/notes', () => {
    it('should return paginated notes', async () => {
      const notes = [buildLeadNote(), buildLeadNote()];
      mockPrisma.leadNote.findMany.mockResolvedValue(notes);
      mockPrisma.leadNote.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/leads/lead_1/notes?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update a note', async () => {
      const note = buildLeadNote({ id: 'note_1', authorId: 'user_1' });
      mockPrisma.leadNote.findUnique.mockResolvedValue(note);
      mockPrisma.leadNote.update.mockResolvedValue({ ...note, body: 'Updated' });

      const res = await request(createApp())
        .put('/api/notes/note_1')
        .send({ body: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.body).toBe('Updated');
    });

    it('should return 403 if not the author', async () => {
      const note = buildLeadNote({ id: 'note_1', authorId: 'user_other' });
      mockPrisma.leadNote.findUnique.mockResolvedValue(note);

      const res = await request(createApp())
        .put('/api/notes/note_1')
        .send({ body: 'Updated' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete a note', async () => {
      const note = buildLeadNote({ id: 'note_1', authorId: 'user_1' });
      mockPrisma.leadNote.findUnique.mockResolvedValue(note);
      mockPrisma.leadNote.delete.mockResolvedValue(note);

      const res = await request(createApp()).delete('/api/notes/note_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('note_1');
    });
  });

  describe('GET /api/leads/:id/activity', () => {
    it('should return paginated activity feed', async () => {
      const activities = [buildLeadActivity(), buildLeadActivity()];
      mockPrisma.leadActivity.findMany.mockResolvedValue(activities);
      mockPrisma.leadActivity.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/leads/lead_1/activity?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/leads/:id/assign', () => {
    it('should assign a lead', async () => {
      const lead = buildLead({ assignedToId: 'user_2' });
      mockPrisma.lead.update.mockResolvedValue(lead);
      mockPrisma.leadActivity.create.mockResolvedValue({});

      const res = await request(createApp())
        .post('/api/leads/lead_1/assign')
        .send({ userId: 'user_2' });

      expect(res.status).toBe(200);
      expect(res.body.data.assignedToId).toBe('user_2');
    });

    it('should reject missing userId', async () => {
      const res = await request(createApp())
        .post('/api/leads/lead_1/assign')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/assignment-rules', () => {
    it('should list rules for workspace', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });
      const rules = [buildAssignmentRule(), buildAssignmentRule()];
      mockPrisma.assignmentRule.findMany.mockResolvedValue(rules);

      const res = await request(createApp()).get('/api/assignment-rules');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 400 if no workspace selected', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: null });

      const res = await request(createApp()).get('/api/assignment-rules');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/assignment-rules', () => {
    it('should create a rule', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });
      const rule = buildAssignmentRule();
      mockPrisma.assignmentRule.create.mockResolvedValue(rule);

      const res = await request(createApp())
        .post('/api/assignment-rules')
        .send({ name: 'Round Robin', type: 'round_robin', config: {}, isActive: true, priority: 0 });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Round Robin Rule');
    });

    it('should reject invalid type', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });

      const res = await request(createApp())
        .post('/api/assignment-rules')
        .send({ name: 'Bad Rule', type: 'invalid_type', config: {} });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/assignment-rules/:id', () => {
    it('should update a rule', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });
      const existingRule = buildAssignmentRule({ id: 'rule_1', workspaceId: 'ws_1' });
      mockPrisma.assignmentRule.findUnique.mockResolvedValue(existingRule);
      const rule = buildAssignmentRule({ id: 'rule_1', name: 'Updated Rule' });
      mockPrisma.assignmentRule.update.mockResolvedValue(rule);

      const res = await request(createApp())
        .put('/api/assignment-rules/rule_1')
        .send({ name: 'Updated Rule', type: 'round_robin', config: {}, isActive: true, priority: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Rule');
    });

    it('should return 404 if rule belongs to another workspace', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });
      const existingRule = buildAssignmentRule({ id: 'rule_1', workspaceId: 'ws_other' });
      mockPrisma.assignmentRule.findUnique.mockResolvedValue(existingRule);

      const res = await request(createApp())
        .put('/api/assignment-rules/rule_1')
        .send({ name: 'Updated Rule', type: 'round_robin', config: {}, isActive: true, priority: 1 });

      expect(res.status).toBe(404);
    });

    it('should return 404 if rule does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });
      mockPrisma.assignmentRule.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/assignment-rules/rule_1')
        .send({ name: 'Updated Rule', type: 'round_robin', config: {}, isActive: true, priority: 1 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/assignment-rules/:id', () => {
    it('should delete a rule', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });
      const existingRule = buildAssignmentRule({ id: 'rule_1', workspaceId: 'ws_1' });
      mockPrisma.assignmentRule.findUnique.mockResolvedValue(existingRule);
      mockPrisma.assignmentRule.delete.mockResolvedValue({});

      const res = await request(createApp()).delete('/api/assignment-rules/rule_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('rule_1');
    });

    it('should return 404 if rule belongs to another workspace', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });
      const existingRule = buildAssignmentRule({ id: 'rule_1', workspaceId: 'ws_other' });
      mockPrisma.assignmentRule.findUnique.mockResolvedValue(existingRule);

      const res = await request(createApp()).delete('/api/assignment-rules/rule_1');

      expect(res.status).toBe(404);
    });

    it('should return 404 if rule does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_1', currentWorkspaceId: 'ws_1' });
      mockPrisma.assignmentRule.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).delete('/api/assignment-rules/rule_1');

      expect(res.status).toBe(404);
    });
  });
});
