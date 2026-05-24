import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSettings } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-msg-id' });
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
  createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
}));

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: vi.fn().mockResolvedValue({ sid: 'SMtest' }) },
  })),
}));

const { default: settingsRoutes } = await import('./settings.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/settings', settingsRoutes);
  app.use(errorHandler);
  return app;
}

describe('Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/settings', () => {
    it('should return settings', async () => {
      const settings = buildSettings();
      mockPrisma.settings.findUnique.mockResolvedValue(settings);

      const res = await request(createApp()).get('/api/settings');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('global');
      expect(res.body.data.smtpHost).toBe('smtp.example.com');
    });

    it('should return 404 when settings not found', async () => {
      mockPrisma.settings.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/settings');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/settings', () => {
    it('should update settings via upsert', async () => {
      const updated = buildSettings({ smtpHost: 'smtp.new.com' });
      mockPrisma.settings.upsert.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/settings')
        .send({ smtpHost: 'smtp.new.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.smtpHost).toBe('smtp.new.com');
      expect(mockPrisma.settings.upsert).toHaveBeenCalledTimes(1);
    });

    it('should partially update settings', async () => {
      const updated = buildSettings({ fromName: 'New Name' });
      mockPrisma.settings.upsert.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/settings')
        .send({ fromName: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.fromName).toBe('New Name');
    });
  });

  describe('POST /api/settings/test-email', () => {
    it('should send test email and return success', async () => {
      mockPrisma.settings.findUnique.mockResolvedValue(buildSettings());

      const res = await request(createApp())
        .post('/api/settings/test-email')
        .send({ to: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('success');
    });

    it('should return 404 when settings not configured', async () => {
      mockPrisma.settings.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/settings/test-email')
        .send({ to: 'test@example.com' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/settings/test-whatsapp', () => {
    it('should send test WhatsApp and return success', async () => {
      mockPrisma.settings.findUnique.mockResolvedValue(buildSettings());

      const res = await request(createApp())
        .post('/api/settings/test-whatsapp')
        .send({ to: '+1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('success');
    });

    it('should return 400 when twilio not configured', async () => {
      mockPrisma.settings.findUnique.mockResolvedValue(buildSettings({
        twilioAccountSid: null,
        twilioAuthToken: null,
        twilioFromNumber: null,
      }));

      const res = await request(createApp())
        .post('/api/settings/test-whatsapp')
        .send({ to: '+1234567890' });

      expect(res.status).toBe(400);
    });
  });
});
