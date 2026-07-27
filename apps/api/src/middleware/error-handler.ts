import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { captureException } from '../services/error-tracking.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.statusCode, message: err.message, details: err.details },
    });
    return;
  }

  captureException(err, {
    method: req.method,
    path: req.originalUrl,
    correlationId: req.correlationId,
  });

  res.status(500).json({
    error: { code: 500, message: 'Internal server error', correlationId: req.correlationId },
  });
}
