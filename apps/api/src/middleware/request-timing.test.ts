import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestTimingMiddleware } from './request-timing.js';
import { correlationIdMiddleware } from './correlation-id.js';

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '../lib/logger.js';

function createApp(delay = 0) {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(requestTimingMiddleware);
  app.get('/fast', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/slow', (_req, res) => {
    setTimeout(() => res.json({ ok: true }), delay);
  });
  return app;
}

describe('requestTimingMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log request completion at info level for fast requests', async () => {
    const app = createApp();
    await request(app).get('/fast');

    expect(logger.info).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        method: 'GET',
        path: '/fast',
        statusCode: 200,
        duration: expect.any(Number),
      }),
    );
  });

  it('should log slow requests at warn level', async () => {
    const app = createApp(1100);
    await request(app).get('/slow');

    expect(logger.warn).toHaveBeenCalledWith(
      'Slow request',
      expect.objectContaining({
        method: 'GET',
        path: '/slow',
        statusCode: 200,
        duration: expect.any(Number),
      }),
    );
  }, 5000);

  it('should include correlationId in log', async () => {
    const app = createApp();
    await request(app).get('/fast').set('X-Request-Id', 'test-corr-id');

    expect(logger.info).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        correlationId: 'test-corr-id',
      }),
    );
  });
});
