import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../db.js', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

let redisConnectShouldFail = false;

vi.mock('ioredis', () => {
  return {
    default: class MockIORedis {
      connect() {
        if (redisConnectShouldFail) {
          return Promise.reject(new Error('Redis connection refused'));
        }
        return Promise.resolve();
      }
      ping() {
        return Promise.resolve('PONG');
      }
      disconnect() {}
    },
  };
});

import healthRoutes from './health.js';
import { prisma } from '../db.js';

function createApp() {
  const app = express();
  app.use('/', healthRoutes);
  return app;
}

describe('Health Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisConnectShouldFail = false;
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.timestamp).toBeDefined();
      expect(res.body.data.uptime).toBeDefined();
      expect(typeof res.body.data.uptime).toBe('number');
    });

    it('should return valid ISO timestamp', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      const ts = new Date(res.body.data.timestamp);
      expect(ts.toISOString()).toBe(res.body.data.timestamp);
    });
  });

  describe('GET /ready', () => {
    it('should return 200 when DB and Redis are healthy', async () => {
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue([{ '?column?': 1 }]);

      const app = createApp();
      const res = await request(app).get('/ready');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.checks.database).toBe('ok');
      expect(res.body.data.checks.redis).toBe('ok');
    });

    it('should return 503 when DB fails', async () => {
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

      const app = createApp();
      const res = await request(app).get('/ready');

      expect(res.status).toBe(503);
      expect(res.body.data.status).toBe('not_ready');
      expect(res.body.data.checks.database).toBe('error');
    });

    it('should return 503 when Redis fails', async () => {
      (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockResolvedValue([{ '?column?': 1 }]);
      redisConnectShouldFail = true;

      const app = createApp();
      const res = await request(app).get('/ready');

      expect(res.status).toBe(503);
      expect(res.body.data.status).toBe('not_ready');
      expect(res.body.data.checks.redis).toBe('error');
    });
  });
});
