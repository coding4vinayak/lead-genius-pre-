import { Request, Response, NextFunction } from 'express';

interface WindowEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const PLAN_LIMITS: Record<string, number> = {
  free: 100,
  pro: 1000,
  enterprise: 10000,
};

const windows = new Map<string, WindowEntry>();

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  if (!req.apiKey) {
    return next();
  }

  const key = req.apiKey.id;
  const limit = PLAN_LIMITS[req.apiKey.plan] || PLAN_LIMITS.free;
  const now = Date.now();

  let entry = windows.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    windows.set(key, entry);
  }

  entry.count++;

  const remaining = Math.max(0, limit - entry.count);
  const reset = Math.ceil((entry.windowStart + WINDOW_MS) / 1000);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: { code: 429, message: 'Rate limit exceeded' } });
  }

  next();
}

// Export for testing
export function clearWindows() {
  windows.clear();
}

export function getWindows() {
  return windows;
}
