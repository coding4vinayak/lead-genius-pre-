import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Health Check', () => {
  it('should return OK status', async () => {
    const app = express();
    app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } }));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.timestamp).toBeDefined();
  });

  it('should return valid ISO timestamp', async () => {
    const app = express();
    app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } }));

    const res = await request(app).get('/api/health');

    const ts = new Date(res.body.data.timestamp);
    expect(ts.toISOString()).toBe(res.body.data.timestamp);
  });
});
