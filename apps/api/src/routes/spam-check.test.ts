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

describe('Spam Check & Link Check Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/templates/:id/spam-check', () => {
    it('should return spam score for a template', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_1',
        subject: 'Hello',
        body: '<p>Normal professional message content here.</p>',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_1/spam-check')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('score');
      expect(res.body.data).toHaveProperty('issues');
      expect(res.body.data).toHaveProperty('suggestions');
      expect(typeof res.body.data.score).toBe('number');
      expect(res.body.data.score).toBeGreaterThanOrEqual(0);
      expect(res.body.data.score).toBeLessThanOrEqual(100);
    });

    it('should return 404 for non-existent template', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/templates/nonexistent/spam-check')
        .send({});

      expect(res.status).toBe(404);
    });

    it('should detect spam content in template', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_spam',
        subject: 'ACT NOW - FREE!!!',
        body: '<p>Buy direct with no obligation! Winner! You have been selected!</p>',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_spam/spam-check')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBeGreaterThan(20);
      expect(res.body.data.issues.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/templates/spam-check-content', () => {
    it('should check raw content for spam', async () => {
      const res = await request(createApp())
        .post('/api/templates/spam-check-content')
        .send({ subject: 'Hello', body: 'Normal content for a business email.' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('score');
      expect(res.body.data).toHaveProperty('issues');
      expect(res.body.data).toHaveProperty('suggestions');
    });

    it('should return high score for spammy content', async () => {
      const res = await request(createApp())
        .post('/api/templates/spam-check-content')
        .send({
          subject: 'ACT NOW FREE MONEY',
          body: 'Buy direct! No obligation! Winner! You have been selected! Click here now!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.score).toBeGreaterThan(30);
    });

    it('should require body field', async () => {
      const res = await request(createApp())
        .post('/api/templates/spam-check-content')
        .send({ subject: 'Hello' });

      expect(res.status).toBe(400);
    });

    it('should work with body only (no subject)', async () => {
      const res = await request(createApp())
        .post('/api/templates/spam-check-content')
        .send({ body: 'Simple message content.' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('score');
    });
  });

  describe('POST /api/templates/:id/link-check', () => {
    it('should validate links in a template', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_links',
        body: '<a href="https://example.com">Valid</a><a href="https://other.org/path">Also valid</a>',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_links/link-check')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('url');
      expect(res.body.data[0]).toHaveProperty('status');
      expect(res.body.data[0].status).toBe('valid');
    });

    it('should detect invalid links', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_badlinks',
        body: '<a href="ftp://invalid">Bad</a><a href="https://good.com">Good</a>',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_badlinks/link-check')
        .send({});

      expect(res.status).toBe(200);
      const invalidLink = res.body.data.find((l: { status: string }) => l.status === 'invalid');
      expect(invalidLink).toBeDefined();
      expect(invalidLink.reason).toBeDefined();
    });

    it('should return 404 for non-existent template', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/templates/nonexistent/link-check')
        .send({});

      expect(res.status).toBe(404);
    });

    it('should return empty array for templates without links', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_nolinks',
        body: '<p>No links in this template.</p>',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_nolinks/link-check')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/templates/:id/preview (enhanced)', () => {
    it('should return full HTML email preview', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_1',
        body: '<p>Hello {{name}}!</p>',
        subject: 'Welcome {{name}}',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_1/preview')
        .send({ variables: { name: 'Alice' }, device: 'desktop' });

      expect(res.status).toBe(200);
      expect(res.body.data.body).toBe('<p>Hello Alice!</p>');
      expect(res.body.data.subject).toBe('Welcome Alice');
      expect(res.body.data.html).toContain('<!DOCTYPE html>');
      expect(res.body.data.html).toContain('Hello Alice');
      expect(res.body.data.plainText).toContain('Hello Alice');
      expect(res.body.data.estimatedSize).toBeGreaterThan(0);
      expect(res.body.data.device).toBe('desktop');
    });

    it('should support mobile device preview', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_1',
        body: '<p>Test content</p>',
        subject: 'Test',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_1/preview')
        .send({ variables: {}, device: 'mobile' });

      expect(res.status).toBe(200);
      expect(res.body.data.device).toBe('mobile');
      expect(res.body.data.html).toContain('max-width: 100%');
    });

    it('should default to desktop when no device specified', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({
        id: 'tmpl_1',
        body: '<p>Test</p>',
        subject: 'Test',
      }));

      const res = await request(createApp())
        .post('/api/templates/tmpl_1/preview')
        .send({ variables: {} });

      expect(res.status).toBe(200);
      expect(res.body.data.device).toBe('desktop');
    });
  });
});
