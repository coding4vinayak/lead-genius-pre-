import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as sandbox from './email-sandbox.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sandbox', sandbox.getRouter());
  return app;
}

describe('email-sandbox', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    sandbox.clearEmails();
    app = buildApp();
  });

  describe('captureEmail / getAllEmails', () => {
    it('should capture and return emails', () => {
      const e = sandbox.captureEmail({ to: 'a@b.com', from: 'me@x.com', fromName: 'Me', subject: 'Test', html: '<p>Hi</p>' });
      expect(e.id).toMatch(/^sandbox_/);
      expect(e.to).toBe('a@b.com');
      expect(e.provider).toBe('smtp');
      expect(sandbox.getAllEmails()).toHaveLength(1);
    });

    it('should return most recent first', () => {
      sandbox.captureEmail({ to: 'first@test.com', from: '', fromName: '', subject: 'First', html: '' });
      sandbox.captureEmail({ to: 'second@test.com', from: '', fromName: '', subject: 'Second', html: '' });
      expect(sandbox.getAllEmails()[0].subject).toBe('Second');
    });
  });

  describe('getEmail / deleteEmail', () => {
    it('should get by id and delete', () => {
      const e = sandbox.captureEmail({ to: 'test@t.com', from: '', fromName: '', subject: 'Test', html: '' });
      expect(sandbox.getEmail(e.id)).toBeDefined();
      expect(sandbox.deleteEmail(e.id)).toBe(true);
      expect(sandbox.getEmail(e.id)).toBeUndefined();
      expect(sandbox.deleteEmail('nonexistent')).toBe(false);
    });
  });

  describe('clearEmails', () => {
    it('should clear all emails', () => {
      sandbox.captureEmail({ to: 'a@b.com', from: '', fromName: '', subject: 'A', html: '' });
      sandbox.captureEmail({ to: 'b@b.com', from: '', fromName: '', subject: 'B', html: '' });
      sandbox.clearEmails();
      expect(sandbox.getAllEmails()).toHaveLength(0);
    });
  });

  describe('HTTP API', () => {
    it('GET /api/sandbox/emails — list', async () => {
      sandbox.captureEmail({ to: 'a@b.com', from: '', fromName: '', subject: 'Test', html: '' });
      const res = await request(app).get('/api/sandbox/emails');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('GET /api/sandbox/emails/:id — get by id', async () => {
      const e = sandbox.captureEmail({ to: 'a@b.com', from: 'f@x.com', fromName: 'F', subject: 'S', html: '<p>H</p>' });
      const res = await request(app).get(`/api/sandbox/emails/${e.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.subject).toBe('S');
    });

    it('GET /api/sandbox/emails/:id — 404 for missing', async () => {
      const res = await request(app).get('/api/sandbox/emails/nonexistent');
      expect(res.status).toBe(404);
    });

    it('GET /api/sandbox/emails/:id/raw — raw text', async () => {
      const e = sandbox.captureEmail({ to: 'a@b.com', from: 'f@x.com', fromName: 'F', subject: 'Test', html: '<p>Hello World</p>', text: 'Hello World' });
      const res = await request(app).get(`/api/sandbox/emails/${e.id}/raw`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Hello World');
      expect(res.text).toContain('Subject: Test');
      expect(res.headers['content-type']).toMatch(/text\/plain/);
    });

    it('DELETE /api/sandbox/emails — clear all', async () => {
      sandbox.captureEmail({ to: 'a@b.com', from: '', fromName: '', subject: 'X', html: '' });
      const res = await request(app).delete('/api/sandbox/emails');
      expect(res.status).toBe(200);
      expect(sandbox.getAllEmails()).toHaveLength(0);
    });

    it('DELETE /api/sandbox/emails/:id — delete one', async () => {
      const e = sandbox.captureEmail({ to: 'a@b.com', from: '', fromName: '', subject: 'X', html: '' });
      const res = await request(app).delete(`/api/sandbox/emails/${e.id}`);
      expect(res.status).toBe(200);
      expect(sandbox.getAllEmails()).toHaveLength(0);
    });

    it('DELETE /api/sandbox/emails/:id — 404 for missing', async () => {
      const res = await request(app).delete('/api/sandbox/emails/nonexistent');
      expect(res.status).toBe(404);
    });

    it('POST /api/sandbox/simulate/send — simulate email', async () => {
      const res = await request(app).post('/api/sandbox/simulate/send').send({
        to: 'test@example.com', subject: 'Hello', fromName: 'Tester', provider: 'sendgrid',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toMatch(/^sandbox_/);
      expect(res.body.data.to).toBe('test@example.com');
      expect(res.body.data.provider).toBe('sendgrid');
      expect(res.body.data.tags).toContain('simulated');
    });

    it('POST /api/sandbox/simulate/send — 400 missing fields', async () => {
      const res = await request(app).post('/api/sandbox/simulate/send').send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/sandbox/simulate/batch — batch simulate', async () => {
      const res = await request(app).post('/api/sandbox/simulate/batch').send({
        emails: [
          { to: 'a@b.com', subject: 'A' },
          { to: 'c@d.com', subject: 'B' },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.count).toBe(2);
    });

    it('POST /api/sandbox/simulate/batch — 400 for empty', async () => {
      const res = await request(app).post('/api/sandbox/simulate/batch').send({ emails: [] });
      expect(res.status).toBe(400);
    });

    it('GET /api/sandbox/dashboard — returns HTML', async () => {
      sandbox.captureEmail({ to: 'a@b.com', from: '', fromName: '', subject: 'Test', html: '' });
      const res = await request(app).get('/api/sandbox/dashboard');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Email Sandbox');
      expect(res.text).toContain('Test');
    });

    it('GET /api/sandbox/dashboard — empty state', async () => {
      const res = await request(app).get('/api/sandbox/dashboard');
      expect(res.text).toContain('No emails captured');
    });
  });
});
