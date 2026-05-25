import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';
import { getCorrelationId } from './correlation-id.js';

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const correlationId = getCorrelationId() || req.correlationId;
    const logData = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      correlationId,
    };

    if (duration > 1000) {
      logger.warn('Slow request', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}
