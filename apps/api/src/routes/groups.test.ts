import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildGroup, buildLead } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: groupRoutes } = await import('./groups.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/groups', groupRoutes);
  app.use(errorHandler);
  return app;
}

describe('Groups API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/groups', () => {
    it('should list all groups with member count', async () => {
      const groups = [
        buildGroup({ id: 'g1', name: 'Tech Leaders', _count: { members: 5 } }),
        buildGroup({ id: 'g2', name: 'Startups', _count: { members: 3 } }),
      ];
      mockPrisma.leadGroup.findMany.mockResolvedValue(groups);

      const res = await request(createApp()).get('/api/groups');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]._count.members).toBe(5);
    });

    it('should return empty array when no groups', async () => {
      mockPrisma.leadGroup.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/groups');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/groups/:id', () => {
    it('should return a group by id', async () => {
      const group = buildGroup({ id: 'g1', name: 'Tech Leaders', _count: { members: 5 } });
      mockPrisma.leadGroup.findUnique.mockResolvedValue(group);

      const res = await request(createApp()).get('/api/groups/g1');

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Tech Leaders');
      expect(res.body.data._count.members).toBe(5);
    });

    it('should return 404 for non-existent group', async () => {
      mockPrisma.leadGroup.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/groups/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Group not found');
    });
  });

  describe('POST /api/groups', () => {
    it('should create a group', async () => {
      const newGroup = buildGroup({ id: 'g_new', name: 'Enterprise' });
      mockPrisma.leadGroup.create.mockResolvedValue(newGroup);

      const res = await request(createApp())
        .post('/api/groups')
        .send({ name: 'Enterprise', description: 'Enterprise clients' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Enterprise');
    });

    it('should reject empty name', async () => {
      const res = await request(createApp())
        .post('/api/groups')
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/groups/:id', () => {
    it('should update a group', async () => {
      const updated = buildGroup({ id: 'g1', name: 'Updated Group' });
      mockPrisma.leadGroup.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/groups/g1')
        .send({ name: 'Updated Group' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Group');
    });
  });

  describe('DELETE /api/groups/:id', () => {
    it('should delete a group', async () => {
      mockPrisma.leadGroup.delete.mockResolvedValue(buildGroup({ id: 'g1' }));

      const res = await request(createApp()).delete('/api/groups/g1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('g1');
    });
  });

  describe('GET /api/groups/:id/leads', () => {
    it('should list leads in a group', async () => {
      const members = [
        { lead: buildLead({ id: 'lead_1', name: 'Alice' }) },
        { lead: buildLead({ id: 'lead_2', name: 'Bob' }) },
      ];
      mockPrisma.groupMember.findMany.mockResolvedValue(members as any);

      const res = await request(createApp()).get('/api/groups/g1/leads');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Alice');
    });
  });

  describe('POST /api/groups/:id/leads', () => {
    it('should add leads to a group', async () => {
      mockPrisma.groupMember.createMany.mockResolvedValue({ count: 2 });

      const res = await request(createApp())
        .post('/api/groups/g1/leads')
        .send({ leadIds: ['lead_1', 'lead_2'] });

      expect(res.status).toBe(201);
      expect(res.body.data.added).toBe(2);
    });

    it('should skip duplicates', async () => {
      mockPrisma.groupMember.createMany.mockResolvedValue({ count: 0 });

      const res = await request(createApp())
        .post('/api/groups/g1/leads')
        .send({ leadIds: ['lead_1'] });

      expect(res.status).toBe(201);
    });
  });

  describe('DELETE /api/groups/:id/leads/:leadId', () => {
    it('should remove a lead from a group', async () => {
      mockPrisma.groupMember.delete.mockResolvedValue({} as any);

      const res = await request(createApp()).delete('/api/groups/g1/leads/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.removed).toBe(true);
    });
  });
});
