import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildTemplate } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: templateRoutes } = await import('./templates.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/templates', templateRoutes);
  app.use(errorHandler);
  return app;
}

describe('Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/templates', () => {
    it('should list all templates', async () => {
      const templates = [buildTemplate(), buildTemplate({ channel: 'whatsapp' })];
      mockPrisma.template.findMany.mockResolvedValue(templates);

      const res = await request(createApp()).get('/api/templates');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by channel', async () => {
      mockPrisma.template.findMany.mockResolvedValue([]);

      await request(createApp()).get('/api/templates?channel=email');

      expect(mockPrisma.template.findMany.mock.calls[0][0].where.channel).toBe('email');
    });

    it('should filter by category', async () => {
      mockPrisma.template.findMany.mockResolvedValue([]);

      await request(createApp()).get('/api/templates?category=onboarding');

      expect(mockPrisma.template.findMany.mock.calls[0][0].where.category).toBe('onboarding');
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should return a template by id', async () => {
      const tmpl = buildTemplate({ id: 'tmpl_1' });
      mockPrisma.template.findUnique.mockResolvedValue(tmpl);

      const res = await request(createApp()).get('/api/templates/tmpl_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('tmpl_1');
    });

    it('should return 404 for non-existent template', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/templates/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Template not found');
    });
  });

  describe('POST /api/templates', () => {
    it('should create a template', async () => {
      const newTmpl = buildTemplate({ id: 'tmpl_new', name: 'Follow-up' });
      mockPrisma.template.create.mockResolvedValue(newTmpl);

      const res = await request(createApp())
        .post('/api/templates')
        .send({
          name: 'Follow-up', channel: 'email', body: 'Hello {{name}}',
          subject: 'Follow up', variables: ['name'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Follow-up');
    });

    it('should reject missing body', async () => {
      const res = await request(createApp())
        .post('/api/templates')
        .send({ name: 'Test', channel: 'email' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/templates/:id', () => {
    it('should update a template', async () => {
      const updated = buildTemplate({ id: 'tmpl_1', name: 'Updated' });
      mockPrisma.template.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/templates/tmpl_1')
        .send({
          name: 'Updated', channel: 'email', body: 'New body',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/templates/:id', () => {
    it('should delete a template', async () => {
      mockPrisma.template.delete.mockResolvedValue(buildTemplate({ id: 'tmpl_1' }));

      const res = await request(createApp()).delete('/api/templates/tmpl_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('tmpl_1');
    });
  });

  describe('POST /api/templates/:id/preview', () => {
    it('should render a template with variables', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_1', body: 'Hello {{name}}!', subject: 'Hi {{name}}',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_1/preview')
        .send({ variables: { name: 'Alice' } });

      expect(res.status).toBe(200);
      expect(res.body.data.body).toBe('Hello Alice!');
      expect(res.body.data.subject).toBe('Hi Alice');
    });

    it('should return 404 for non-existent template', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/templates/nonexistent/preview')
        .send({ variables: {} });

      expect(res.status).toBe(404);
    });

    it('should render with empty variables', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_1', body: 'Hello {{name}}!', subject: 'Hi',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_1/preview')
        .send({ variables: {} });

      expect(res.status).toBe(200);
      expect(res.body.data.body).toBe('Hello !');
    });
  });
});
