import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import IORedis from 'ioredis';
import { config } from '../config.js';

const router = Router();

let isShuttingDown = false;

export function setShuttingDown(value: boolean): void {
  isShuttingDown = value;
}

router.get('/health', (_req: Request, res: Response) => {
  if (isShuttingDown) {
    res.status(503).json({
      data: { status: 'shutting_down', timestamp: new Date().toISOString(), uptime: process.uptime() },
    });
    return;
  }
  res.json({
    data: { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() },
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  const checks: { database: 'ok' | 'error'; redis: 'ok' | 'error' } = {
    database: 'error',
    redis: 'error',
  };

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    checks.database = 'ok';
  } catch {
    // database check failed
  }

  let redis: IORedis | undefined;
  try {
    redis = new IORedis({ host: config.redis.host, port: config.redis.port, maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
    await redis.connect();
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    // redis check failed
  } finally {
    if (redis) {
      redis.disconnect();
    }
  }

  const allHealthy = checks.database === 'ok' && checks.redis === 'ok';
  const status = allHealthy ? 'ready' : 'not_ready';
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({ data: { status, checks } });
});

export default router;
