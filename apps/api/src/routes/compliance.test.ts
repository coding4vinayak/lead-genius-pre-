import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildUnsubscribeRecord, buildGdprConsent, buildSuppressionEntry } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: complianceRoutes } = await import('./compliance.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/compliance', complianceRoutes);
  app.use(errorHandler);
  return app;
}

describe('Compliance API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/compliance/unsubscribe/:token', () => {
    it('should process unsubscribe by token', async () => {
      const record = buildUnsubscribeRecord({ token: 'tok_valid', reason: null, unsubscribedAt: new Date(0), leadId: 'lead_1' });
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(record);
      mockPrisma.unsubscribeRecord.update.mockResolvedValue({ ...record, reason: 'one_click', unsubscribedAt: new Date() });
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(buildSuppressionEntry());
      mockPrisma.lead.update.mockResolvedValue(buildLead({ status: 'unsubscribed' }));

      const res = await request(createApp())
        .post('/api/compliance/unsubscribe/tok_valid')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Successfully unsubscribed');
    });

    it('should return 404 for invalid token', async () => {
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/compliance/unsubscribe/fake_token')
        .send({});

      expect(res.status).toBe(404);
    });

    it('should accept optional reason', async () => {
      const record = buildUnsubscribeRecord({ token: 'tok_valid', reason: null, unsubscribedAt: new Date(0), leadId: null });
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(record);
      mockPrisma.unsubscribeRecord.update.mockResolvedValue({ ...record, reason: 'not_interested' });
      mockPrisma.suppressionEntry.upsert.mockResolvedValue(buildSuppressionEntry());

      const res = await request(createApp())
        .post('/api/compliance/unsubscribe/tok_valid')
        .send({ reason: 'not_interested' });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/compliance/unsubscribe/:token', () => {
    it('should return landing page data', async () => {
      const record = buildUnsubscribeRecord({ token: 'tok_valid', reason: null, unsubscribedAt: new Date(0) });
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(record);

      const res = await request(createApp())
        .get('/api/compliance/unsubscribe/tok_valid');

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBeDefined();
      expect(res.body.data.alreadyUnsubscribed).toBe(false);
    });

    it('should return 404 for invalid token', async () => {
      mockPrisma.unsubscribeRecord.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .get('/api/compliance/unsubscribe/invalid_tok');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/compliance/gdpr/export/:leadId', () => {
    it('should export lead data', async () => {
      const lead = {
        ...buildLead({ id: 'lead_1' }),
        messages: [],
        groupMembers: [],
        sequenceEnrollments: [],
        emailVerifications: [],
        unsubscribeRecords: [],
        gdprConsents: [],
      };
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const res = await request(createApp())
        .get('/api/compliance/gdpr/export/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.personalData.id).toBe('lead_1');
      expect(res.body.data.exportedAt).toBeDefined();
    });

    it('should return 404 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .get('/api/compliance/gdpr/export/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/compliance/gdpr/:leadId', () => {
    it('should delete all lead data', async () => {
      mockPrisma.gdprConsent.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.unsubscribeRecord.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerification.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.groupMember.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.sequenceEnrollment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.lead.delete.mockResolvedValue(buildLead({ id: 'lead_1' }));

      const res = await request(createApp())
        .delete('/api/compliance/gdpr/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });
  });

  describe('GET /api/compliance/consent/:leadId', () => {
    it('should return consent records for a lead', async () => {
      const consents = [
        buildGdprConsent({ consentType: 'marketing_email', revokedAt: null }),
        buildGdprConsent({ consentType: 'data_processing', revokedAt: new Date() }),
      ];
      mockPrisma.gdprConsent.findMany.mockResolvedValue(consents);

      const res = await request(createApp())
        .get('/api/compliance/consent/lead_1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].isActive).toBe(true);
      expect(res.body.data[1].isActive).toBe(false);
    });
  });

  describe('POST /api/compliance/consent', () => {
    it('should record consent', async () => {
      const consent = buildGdprConsent({ leadId: 'lead_1', consentType: 'marketing_email' });
      mockPrisma.gdprConsent.upsert.mockResolvedValue(consent);

      const res = await request(createApp())
        .post('/api/compliance/consent')
        .send({ leadId: 'lead_1', consentType: 'marketing_email', source: 'signup_form' });

      expect(res.status).toBe(201);
      expect(res.body.data.consentType).toBe('marketing_email');
    });

    it('should reject invalid consent type', async () => {
      const res = await request(createApp())
        .post('/api/compliance/consent')
        .send({ leadId: 'lead_1', consentType: 'invalid_type' });

      expect(res.status).toBe(400);
    });

    it('should reject missing leadId', async () => {
      const res = await request(createApp())
        .post('/api/compliance/consent')
        .send({ consentType: 'marketing_email' });

      expect(res.status).toBe(400);
    });
  });
});
