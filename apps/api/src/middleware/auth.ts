import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { hashApiKey } from '../lib/crypto.js';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      req.user = payload;
      return next();
    } catch {
      return res.status(401).json({ error: { code: 401, message: 'Invalid or expired token' } });
    }
  }

  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    try {
      const hash = hashApiKey(apiKey);
      const key = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
      if (!key || !key.active) {
        return res.status(401).json({ error: { code: 401, message: 'Invalid or deactivated API key' } });
      }
      if (key.expiresAt && key.expiresAt < new Date()) {
        return res.status(401).json({ error: { code: 401, message: 'API key has expired' } });
      }
      await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
      req.user = { userId: key.userId, email: '', role: 'api' };
      return next();
    } catch {
      return res.status(500).json({ error: { code: 500, message: 'Authentication error' } });
    }
  }

  return res.status(401).json({ error: { code: 401, message: 'Authentication required' } });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
      req.user = payload;
      return next();
    } catch {
      // ignore invalid tokens for optional auth
    }
  }

  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    hashApiKey(apiKey).then((hash) =>
      prisma.apiKey.findUnique({ where: { keyHash: hash } }).then((key) => {
        if (key?.active) {
          req.user = { userId: key.userId, email: '', role: 'api' };
          prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        }
      }).catch(() => {})
    ).catch(() => {});
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
