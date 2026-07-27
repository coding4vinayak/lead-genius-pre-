import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

export interface CorrelationStore {
  correlationId: string;
  userId?: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationStore>();

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Request-Id', correlationId);

  correlationStorage.run({ correlationId }, () => {
    next();
  });
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

export function setCorrelationUserId(userId: string): void {
  const store = correlationStorage.getStore();
  if (store) {
    store.userId = userId;
  }
}

export function getCorrelationUserId(): string | undefined {
  return correlationStorage.getStore()?.userId;
}
