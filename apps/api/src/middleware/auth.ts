import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      correlationId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // If a valid API key has already been set by apiKeyAuth middleware, allow access
  if (req.apiKey) {
    req.user = {
      userId: `apikey:${req.apiKey.id}`,
      email: `apikey-${req.apiKey.id}@system.local`,
      role: 'apikey',
    };
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: { code: 401, message: 'Authentication required' } });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: { code: 401, message: 'Invalid or expired token' } });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      req.user = payload;
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}
