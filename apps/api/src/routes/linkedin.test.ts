import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildLinkedInProfile, buildLinkedInMessage } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const { default: linkedinRoutes } = await import('./linkedin.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/linkedin', linkedinRoutes);
  app.use(errorHandler);
  return app;
}

describe('LinkedIn Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/linkedin/connect/:leadId', () => {
    it('should send a connection request', async () => {
      const lead = buildLead();
      const profile = buildLinkedInProfile({ leadId: lead.id, connectionStatus: 'pending' });

      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);
      mockPrisma.linkedInProfile.upsert.mockResolvedValue(profile);

      const res = await request(createApp())
        .post(`/api/linkedin/connect/${lead.id}`)
        .send({ note: 'Hi, lets connect' });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.connectionStatus).toBe('pending');
    });

    it('should return 404 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/linkedin/connect/nonexistent')
        .send({});

      expect(res.status).toBe(404);
    });

    it('should accept optional profileUrl', async () => {
      const lead = buildLead();
      const profile = buildLinkedInProfile({ leadId: lead.id, connectionStatus: 'pending' });

      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);
      mockPrisma.linkedInProfile.upsert.mockResolvedValue(profile);

      const res = await request(createApp())
        .post(`/api/linkedin/connect/${lead.id}`)
        .send({ profileUrl: 'https://linkedin.com/in/johndoe' });

      expect(res.status).toBe(201);
    });
  });

  describe('POST /api/linkedin/message/:leadId', () => {
    it('should send a message when connected', async () => {
      const profile = buildLinkedInProfile({ connectionStatus: 'connected' });
      const message = buildLinkedInMessage();

      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.linkedInMessage.create.mockResolvedValue(message);
      mockPrisma.linkedInProfile.update.mockResolvedValue(profile);

      const res = await request(createApp())
        .post('/api/linkedin/message/lead_1')
        .send({ body: 'Hello there' });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 if not connected', async () => {
      const profile = buildLinkedInProfile({ connectionStatus: 'pending' });
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(profile);

      const res = await request(createApp())
        .post('/api/linkedin/message/lead_1')
        .send({ body: 'Hello' });

      expect(res.status).toBe(400);
    });

    it('should validate body is required', async () => {
      const res = await request(createApp())
        .post('/api/linkedin/message/lead_1')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/linkedin/view/:leadId', () => {
    it('should view a profile', async () => {
      const lead = buildLead();
      const profile = buildLinkedInProfile({ leadId: lead.id });

      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.linkedInProfile.upsert.mockResolvedValue(profile);

      const res = await request(createApp())
        .post(`/api/linkedin/view/${lead.id}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/linkedin/profile/:leadId', () => {
    it('should return profile data', async () => {
      const profile = buildLinkedInProfile();
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue({ ...profile, messages: [] });

      const res = await request(createApp())
        .get('/api/linkedin/profile/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return null if no profile', async () => {
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .get('/api/linkedin/profile/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  describe('PUT /api/linkedin/profile/:leadId', () => {
    it('should update profile', async () => {
      const profile = buildLinkedInProfile();
      const updated = { ...profile, connectionStatus: 'connected' };

      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.linkedInProfile.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/linkedin/profile/lead_1')
        .send({ connectionStatus: 'connected' });

      expect(res.status).toBe(200);
      expect(res.body.data.connectionStatus).toBe('connected');
    });

    it('should return 404 if profile not found', async () => {
      mockPrisma.linkedInProfile.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/linkedin/profile/lead_1')
        .send({ connectionStatus: 'connected' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/linkedin/connections', () => {
    it('should return paginated connections', async () => {
      const profiles = [buildLinkedInProfile(), buildLinkedInProfile()];
      mockPrisma.linkedInProfile.findMany.mockResolvedValue(profiles);
      mockPrisma.linkedInProfile.count.mockResolvedValue(2);

      const res = await request(createApp())
        .get('/api/linkedin/connections');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrisma.linkedInProfile.findMany.mockResolvedValue([]);
      mockPrisma.linkedInProfile.count.mockResolvedValue(0);

      const res = await request(createApp())
        .get('/api/linkedin/connections?status=pending');

      expect(res.status).toBe(200);
      expect(mockPrisma.linkedInProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { connectionStatus: 'pending' } }),
      );
    });
  });
});
