import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildIntegration, buildCrmSync } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: crmRoutes } = await import('./crm.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/crm', crmRoutes);
  app.use(errorHandler);
  return app;
}

describe('CRM API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/crm/connect', () => {
    it('should connect CRM integration', async () => {
      const integration = buildIntegration({ type: 'hubspot', config: { provider: 'hubspot' } });
      const crmSync = buildCrmSync({ integrationId: integration.id });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.integration.update.mockResolvedValue({ ...integration, isActive: true });
      mockPrisma.crmSync.create.mockResolvedValue(crmSync);

      const res = await request(createApp())
        .post('/api/crm/connect')
        .send({ integrationId: integration.id, provider: 'hubspot', direction: 'bidirectional' });

      expect(res.status).toBe(201);
      expect(res.body.data.crmSync).toBeDefined();
    });

    it('should reject missing integrationId', async () => {
      const res = await request(createApp())
        .post('/api/crm/connect')
        .send({ provider: 'hubspot' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/crm/sync', () => {
    it('should trigger CRM sync', async () => {
      const integration = buildIntegration({ type: 'hubspot' });
      const crmSync = buildCrmSync({ integrationId: integration.id });

      mockPrisma.integration.findUnique.mockResolvedValue(integration);
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);
      mockPrisma.crmSync.update.mockResolvedValue({ ...crmSync, syncStatus: 'completed' });

      const res = await request(createApp())
        .post('/api/crm/sync')
        .send({ integrationId: integration.id, direction: 'outbound' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });

    it('should reject missing integrationId', async () => {
      const res = await request(createApp())
        .post('/api/crm/sync')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/crm/status', () => {
    it('should return sync status', async () => {
      const crmSync = buildCrmSync({ syncStatus: 'completed' });
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);

      const res = await request(createApp())
        .get('/api/crm/status?integrationId=int_1');

      expect(res.status).toBe(200);
      expect(res.body.data.syncStatus).toBe('completed');
    });

    it('should require integrationId query param', async () => {
      const res = await request(createApp())
        .get('/api/crm/status');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/crm/oauth/callback', () => {
    it('should handle OAuth callback', async () => {
      const integration = buildIntegration({ type: 'hubspot' });
      mockPrisma.integration.create.mockResolvedValue(integration);

      const res = await request(createApp())
        .post('/api/crm/oauth/callback')
        .send({ provider: 'hubspot', code: 'oauth_code_123' });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
    });

    it('should reject invalid provider', async () => {
      const res = await request(createApp())
        .post('/api/crm/oauth/callback')
        .send({ provider: 'invalid', code: 'test' });

      expect(res.status).toBe(400);
    });

    it('should reject missing code', async () => {
      const res = await request(createApp())
        .post('/api/crm/oauth/callback')
        .send({ provider: 'hubspot' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/crm/oauth/url', () => {
    it('should return OAuth URL for provider', async () => {
      const res = await request(createApp())
        .get('/api/crm/oauth/url?provider=hubspot');

      expect(res.status).toBe(200);
      expect(res.body.data.url).toContain('hubspot.com');
      expect(res.body.data.provider).toBe('hubspot');
    });

    it('should require provider query param', async () => {
      const res = await request(createApp())
        .get('/api/crm/oauth/url');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/crm/field-mapping', () => {
    it('should return field mapping', async () => {
      const crmSync = buildCrmSync({ fieldMapping: { firstname: 'name' } });
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);

      const res = await request(createApp())
        .get('/api/crm/field-mapping?integrationId=int_1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ firstname: 'name' });
    });

    it('should require integrationId', async () => {
      const res = await request(createApp())
        .get('/api/crm/field-mapping');

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/crm/field-mapping', () => {
    it('should update field mapping', async () => {
      const crmSync = buildCrmSync();
      const newMapping = { firstname: 'name', email_address: 'email' };
      mockPrisma.crmSync.findFirst.mockResolvedValue(crmSync);
      mockPrisma.crmSync.update.mockResolvedValue({ ...crmSync, fieldMapping: newMapping });

      const res = await request(createApp())
        .put('/api/crm/field-mapping?integrationId=int_1')
        .send({ fieldMapping: newMapping });

      expect(res.status).toBe(200);
      expect(res.body.data.fieldMapping).toEqual(newMapping);
    });

    it('should reject empty field mapping', async () => {
      const res = await request(createApp())
        .put('/api/crm/field-mapping?integrationId=int_1')
        .send({ fieldMapping: {} });

      expect(res.status).toBe(400);
    });
  });
});
