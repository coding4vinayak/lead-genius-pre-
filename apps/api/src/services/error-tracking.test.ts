import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../middleware/correlation-id.js', () => ({
  getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
  getCorrelationUserId: vi.fn().mockReturnValue(undefined),
  setCorrelationUserId: vi.fn(),
}));

import { captureException, captureMessage, setUser } from './error-tracking.js';
import { logger } from '../lib/logger.js';
import { getCorrelationUserId, setCorrelationUserId } from '../middleware/correlation-id.js';

describe('error-tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('captureException', () => {
    it('should log error with message and stack trace', () => {
      const error = new Error('Test error');

      captureException(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Exception captured',
        expect.objectContaining({
          message: 'Test error',
          stack: expect.any(String),
          correlationId: 'test-correlation-id',
        }),
      );
    });

    it('should include additional context', () => {
      const error = new Error('DB error');

      captureException(error, { endpoint: '/api/leads', method: 'POST' });

      expect(logger.error).toHaveBeenCalledWith(
        'Exception captured',
        expect.objectContaining({
          message: 'DB error',
          endpoint: '/api/leads',
          method: 'POST',
        }),
      );
    });
  });

  describe('captureMessage', () => {
    it('should log at specified level', () => {
      captureMessage('Something happened', 'warn', { detail: 'extra' });

      expect(logger.log).toHaveBeenCalledWith(
        'warn',
        'Something happened',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          detail: 'extra',
        }),
      );
    });

    it('should log at info level', () => {
      captureMessage('Info message', 'info');

      expect(logger.log).toHaveBeenCalledWith(
        'info',
        'Info message',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
        }),
      );
    });
  });

  describe('setUser', () => {
    it('should call setCorrelationUserId', () => {
      setUser('user-123');

      expect(setCorrelationUserId).toHaveBeenCalledWith('user-123');
    });
  });
});
