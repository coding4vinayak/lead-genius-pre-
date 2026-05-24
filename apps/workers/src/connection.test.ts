import { describe, it, expect } from 'vitest';

const originalEnv = process.env;

describe('connection', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should use defaults when env vars are not set', async () => {
    process.env = { ...originalEnv };
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    const { connection } = await import('./connection.js');
    expect(connection.host).toBe('localhost');
    expect(connection.port).toBe(6379);
  });

  it('should use env vars when set', async () => {
    process.env.REDIS_HOST = 'redis.example.com';
    process.env.REDIS_PORT = '6380';

    const { connection } = await import('./connection.js?2');
    expect(connection.host).toBe('redis.example.com');
    expect(connection.port).toBe(6380);
  });
});
