import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { correlationIdMiddleware, getCorrelationId } from './correlation-id.js';

function createApp() {
  const app = express();
  app.use(correlationIdMiddleware);
  app.get('/test', (req, res) => {
    res.json({
      correlationId: req.correlationId,
      fromStorage: getCorrelationId(),
    });
  });
  return app;
}

describe('correlationIdMiddleware', () => {
  it('should generate a correlation ID when not present in headers', async () => {
    const app = createApp();
    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.correlationId).toBeDefined();
    expect(res.body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-request-id']).toBe(res.body.correlationId);
  });

  it('should preserve correlation ID from X-Request-Id header', async () => {
    const app = createApp();
    const customId = 'custom-request-id-123';
    const res = await request(app).get('/test').set('X-Request-Id', customId);

    expect(res.status).toBe(200);
    expect(res.body.correlationId).toBe(customId);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('should make correlation ID available via getCorrelationId()', async () => {
    const app = createApp();
    const res = await request(app).get('/test');

    expect(res.body.fromStorage).toBe(res.body.correlationId);
  });

  it('should set X-Request-Id response header', async () => {
    const app = createApp();
    const res = await request(app).get('/test');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.correlationId);
  });
});
