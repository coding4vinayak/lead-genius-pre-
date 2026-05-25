import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildChannelHealth, buildEmailDomainAuth, buildSettings } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { default: channelHealthRoutes } = await import('./channel-health.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/channel-health', channelHealthRoutes);
  app.use(errorHandler);
  return app;
}

describe('Channel Health API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/channel-health', () => {
    it('should return all channel health records', async () => {
      const records = [
        buildChannelHealth({ channel: 'email' }),
        buildChannelHealth({ channel: 'whatsapp', provider: 'twilio' }),
      ];
      mockPrisma.channelHealth.findMany.mockResolvedValue(records);

      const res = await request(createApp()).get('/api/channel-health');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/channel-health/:channel', () => {
    it('should return health for a specific channel', async () => {
      const health = buildChannelHealth({ channel: 'email' });
      mockPrisma.channelHealth.findFirst.mockResolvedValue(health);

      const res = await request(createApp()).get('/api/channel-health/email');

      expect(res.status).toBe(200);
      expect(res.body.data.channel).toBe('email');
    });

    it('should create default record if none exists', async () => {
      mockPrisma.channelHealth.findFirst.mockResolvedValue(null);
      const newHealth = buildChannelHealth({ channel: 'whatsapp', provider: 'twilio' });
      mockPrisma.channelHealth.create.mockResolvedValue(newHealth);

      const res = await request(createApp()).get('/api/channel-health/whatsapp');

      expect(res.status).toBe(200);
      expect(res.body.data.channel).toBe('whatsapp');
    });

    it('should reject invalid channel name', async () => {
      const res = await request(createApp()).get('/api/channel-health/sms');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/channel-health/check', () => {
    it('should trigger a manual health check', async () => {
      const settings = buildSettings({ smtpHost: null, smtpPort: null, twilioAccountSid: 'sid', twilioAuthToken: 'token' });
      mockPrisma.settings.findUnique.mockResolvedValue(settings);
      mockPrisma.channelHealth.upsert.mockResolvedValue(buildChannelHealth());

      const res = await request(createApp()).post('/api/channel-health/check').send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].channel).toBe('email');
      expect(res.body.data[1].channel).toBe('whatsapp');
    });
  });

  describe('GET /api/channel-health/domains', () => {
    it('should list all domain auth records', async () => {
      const domains = [buildEmailDomainAuth(), buildEmailDomainAuth({ domain: 'other.com' })];
      mockPrisma.emailDomainAuth.findMany.mockResolvedValue(domains);

      const res = await request(createApp()).get('/api/channel-health/domains');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/channel-health/domains', () => {
    it('should add a new domain to track', async () => {
      mockPrisma.emailDomainAuth.findUnique.mockResolvedValue(null);
      const newDomain = buildEmailDomainAuth({ domain: 'new.com', spfStatus: 'pending', dkimStatus: 'pending', dmarcStatus: 'pending' });
      mockPrisma.emailDomainAuth.create.mockResolvedValue(newDomain);

      const res = await request(createApp())
        .post('/api/channel-health/domains')
        .send({ domain: 'new.com' });

      expect(res.status).toBe(201);
      expect(res.body.data.domain).toBe('new.com');
    });

    it('should reject if domain already exists', async () => {
      mockPrisma.emailDomainAuth.findUnique.mockResolvedValue(buildEmailDomainAuth());

      const res = await request(createApp())
        .post('/api/channel-health/domains')
        .send({ domain: 'example.com' });

      expect(res.status).toBe(400);
    });

    it('should reject if domain is empty', async () => {
      const res = await request(createApp())
        .post('/api/channel-health/domains')
        .send({ domain: '' });

      expect(res.status).toBe(400);
    });
  });
});
