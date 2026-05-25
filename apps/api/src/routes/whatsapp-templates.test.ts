import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWhatsAppTemplate } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: whatsappTemplateRoutes } = await import('./whatsapp-templates.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/whatsapp-templates', whatsappTemplateRoutes);
  app.use(errorHandler);
  return app;
}

describe('WhatsApp Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/whatsapp-templates', () => {
    it('should list all WhatsApp templates', async () => {
      const templates = [buildWhatsAppTemplate(), buildWhatsAppTemplate({ name: 'Second' })];
      mockPrisma.whatsAppTemplate.findMany.mockResolvedValue(templates);

      const res = await request(createApp()).get('/api/whatsapp-templates');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array when no templates exist', async () => {
      mockPrisma.whatsAppTemplate.findMany.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/whatsapp-templates');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/whatsapp-templates', () => {
    it('should create a new WhatsApp template', async () => {
      const newTemplate = buildWhatsAppTemplate({ name: 'New Template', status: 'pending' });
      mockPrisma.whatsAppTemplate.create.mockResolvedValue(newTemplate);

      const res = await request(createApp())
        .post('/api/whatsapp-templates')
        .send({
          name: 'New Template',
          body: 'Hello {{name}}, welcome!',
          category: 'marketing',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Template');
    });

    it('should reject template without name', async () => {
      const res = await request(createApp())
        .post('/api/whatsapp-templates')
        .send({ body: 'Hello' });

      expect(res.status).toBe(400);
    });

    it('should reject template without body', async () => {
      const res = await request(createApp())
        .post('/api/whatsapp-templates')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should accept template with all fields', async () => {
      const fullTemplate = buildWhatsAppTemplate({
        name: 'Full Template',
        headerType: 'text',
        headerContent: 'Header text',
        footerText: 'Footer text',
        buttons: [{ type: 'quick_reply', text: 'Yes' }],
        twilioTemplateSid: 'HX123',
      });
      mockPrisma.whatsAppTemplate.create.mockResolvedValue(fullTemplate);

      const res = await request(createApp())
        .post('/api/whatsapp-templates')
        .send({
          name: 'Full Template',
          body: 'Hello {{name}}!',
          category: 'utility',
          language: 'es',
          headerType: 'text',
          headerContent: 'Header text',
          footerText: 'Footer text',
          buttons: [{ type: 'quick_reply', text: 'Yes' }],
          twilioTemplateSid: 'HX123',
        });

      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/whatsapp-templates/:id', () => {
    it('should update an existing template', async () => {
      const existing = buildWhatsAppTemplate({ id: 'wat_1' });
      mockPrisma.whatsAppTemplate.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, name: 'Updated Template' };
      mockPrisma.whatsAppTemplate.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/whatsapp-templates/wat_1')
        .send({ name: 'Updated Template', body: 'Updated body' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Template');
    });

    it('should return 404 for non-existent template', async () => {
      mockPrisma.whatsAppTemplate.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/whatsapp-templates/nonexistent')
        .send({ name: 'Updated', body: 'Updated body' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/whatsapp-templates/:id', () => {
    it('should delete an existing template', async () => {
      mockPrisma.whatsAppTemplate.findUnique.mockResolvedValue(buildWhatsAppTemplate({ id: 'wat_1' }));
      mockPrisma.whatsAppTemplate.delete.mockResolvedValue({});

      const res = await request(createApp()).delete('/api/whatsapp-templates/wat_1');

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('should return 404 for non-existent template', async () => {
      mockPrisma.whatsAppTemplate.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).delete('/api/whatsapp-templates/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
