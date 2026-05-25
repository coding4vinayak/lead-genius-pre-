import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { rateLimiter, clearWindows } from './rate-limiter.js';

function createApp(plan = 'free') {
  const app = express();
  app.use((req, _res, next) => {
    req.apiKey = { id: 'key_1', workspaceId: 'ws_1', plan, permissions: [] };
    next();
  });
  app.use(rateLimiter);
  app.get('/test', (_req, res) => {
    res.json({ data: 'ok' });
  });
  return app;
}

function createAppNoApiKey() {
  const app = express();
  app.use(rateLimiter);
  app.get('/test', (_req, res) => {
    res.json({ data: 'ok' });
  });
  return app;
}

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    clearWindows();
  });

  it('should pass through when no API key is present', async () => {
    const res = await request(createAppNoApiKey()).get('/test');

    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('should set rate limit headers for API key requests', async () => {
    const res = await request(createApp('pro')).get('/test');

    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('1000');
    expect(res.headers['x-ratelimit-remaining']).toBe('999');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('should enforce free plan limit of 100 requests per hour', async () => {
    const app = createApp('free');

    for (let i = 0; i < 100; i++) {
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
    }

    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe(429);
    expect(res.body.error.message).toBe('Rate limit exceeded');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('should use correct limits per plan', async () => {
    const freeApp = createApp('free');
    const res1 = await request(freeApp).get('/test');
    expect(res1.headers['x-ratelimit-limit']).toBe('100');

    clearWindows();

    const proApp = createApp('pro');
    const res2 = await request(proApp).get('/test');
    expect(res2.headers['x-ratelimit-limit']).toBe('1000');

    clearWindows();

    const enterpriseApp = createApp('enterprise');
    const res3 = await request(enterpriseApp).get('/test');
    expect(res3.headers['x-ratelimit-limit']).toBe('10000');
  });

  it('should return 429 with Retry-After header when limit exceeded', async () => {
    const app = createApp('free');

    for (let i = 0; i < 101; i++) {
      await request(app).get('/test');
    }

    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(parseInt(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});
