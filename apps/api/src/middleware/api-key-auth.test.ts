import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildApiKey, buildWorkspace } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { apiKeyAuth } = await import('./api-key-auth.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(apiKeyAuth);
  app.get('/test', (req, res) => {
    res.json({ apiKey: req.apiKey || null });
  });
  return app;
}

describe('API Key Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass through when no X-API-Key header is present', async () => {
    const res = await request(createApp()).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.apiKey).toBeNull();
  });

  it('should authenticate with valid API key', async () => {
    const workspace = buildWorkspace({ plan: 'pro' });
    const apiKey = buildApiKey({ workspace, isActive: true, permissions: ['read:leads'] });

    mockPrisma.apiKey.findUnique.mockResolvedValue(apiKey);
    mockPrisma.apiKey.update.mockResolvedValue(apiKey);

    const res = await request(createApp())
      .get('/test')
      .set('X-API-Key', 'lg_test1234_somekey');

    expect(res.status).toBe(200);
    expect(res.body.apiKey).toEqual({
      id: apiKey.id,
      workspaceId: apiKey.workspaceId,
      plan: 'pro',
      permissions: ['read:leads'],
    });
  });

  it('should return 401 for invalid API key', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .get('/test')
      .set('X-API-Key', 'lg_invalid_key');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid API key');
  });

  it('should return 401 for inactive API key', async () => {
    const workspace = buildWorkspace();
    const apiKey = buildApiKey({ workspace, isActive: false });

    mockPrisma.apiKey.findUnique.mockResolvedValue(apiKey);

    const res = await request(createApp())
      .get('/test')
      .set('X-API-Key', 'lg_inactive_key');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid API key');
  });
});
