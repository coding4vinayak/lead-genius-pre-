import { logger } from '../lib/logger.js';
import { getCorrelationId, getCorrelationUserId, setCorrelationUserId } from '../middleware/correlation-id.js';

export function captureException(error: Error, context?: Record<string, unknown>): void {
  logger.error('Exception captured', {
    message: error.message,
    stack: error.stack,
    correlationId: getCorrelationId(),
    userId: getCorrelationUserId(),
    ...context,
  });
}

export function captureMessage(
  message: string,
  level: 'info' | 'warn' | 'error',
  context?: Record<string, unknown>,
): void {
  logger.log(level, message, {
    correlationId: getCorrelationId(),
    userId: getCorrelationUserId(),
    ...context,
  });
}

export function setUser(userId: string): void {
  setCorrelationUserId(userId);
}
