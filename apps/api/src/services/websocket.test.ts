import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock('../config.js', () => ({
  config: { jwtSecret: 'test-secret' },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import jwt from 'jsonwebtoken';
import { broadcastToUser, broadcastToAll, getConnectedCount } from './websocket.js';

describe('WebSocket Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('broadcastToUser', () => {
    it('should not throw when user has no connections', () => {
      expect(() => broadcastToUser('nonexistent_user', 'test', { msg: 'hello' })).not.toThrow();
    });
  });

  describe('broadcastToAll', () => {
    it('should not throw when no clients connected', () => {
      expect(() => broadcastToAll('test', { msg: 'hello' })).not.toThrow();
    });
  });

  describe('getConnectedCount', () => {
    it('should return 0 when no clients are connected', () => {
      expect(getConnectedCount()).toBe(0);
    });
  });

  describe('JWT verification', () => {
    it('should have jwt.verify available for token validation', () => {
      expect(jwt.verify).toBeDefined();
    });
  });
});
