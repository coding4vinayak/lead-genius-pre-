import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildApiKey, buildApiKeyUsage, buildWorkspace } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { generateApiKey, revokeApiKey, listApiKeys, validateApiKey, trackUsage, getUsageStats } = await import('./api-keys.js');

describe('API Keys Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateApiKey', () => {
    it('should create a new API key with hashed value', async () => {
      const apiKey = buildApiKey();
      mockPrisma.apiKey.create.mockResolvedValue(apiKey);

      const result = await generateApiKey('ws_1', 'Test Key', ['read:leads']);

      expect(mockPrisma.apiKey.create).toHaveBeenCalledOnce();
      const createArg = mockPrisma.apiKey.create.mock.calls[0][0];
      expect(createArg.data.workspaceId).toBe('ws_1');
      expect(createArg.data.name).toBe('Test Key');
      expect(createArg.data.permissions).toEqual(['read:leads']);
      expect(createArg.data.key).toBeDefined();
      expect(createArg.data.prefix).toMatch(/^lg_/);
      expect(result).toHaveProperty('fullKey');
    });

    it('should return the full key only on creation', async () => {
      const apiKey = buildApiKey();
      mockPrisma.apiKey.create.mockResolvedValue(apiKey);

      const result = await generateApiKey('ws_1', 'Test Key', []);

      expect(result.fullKey).toContain('lg_');
      expect(result.fullKey.length).toBeGreaterThan(20);
    });
  });

  describe('revokeApiKey', () => {
    it('should set isActive to false', async () => {
      const apiKey = buildApiKey({ isActive: false });
      mockPrisma.apiKey.update.mockResolvedValue(apiKey);

      await revokeApiKey('key_1');

      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key_1' },
        data: { isActive: false },
      });
    });
  });

  describe('listApiKeys', () => {
    it('should return keys with masked key field', async () => {
      const keys = [
        buildApiKey({ prefix: 'lg_abcd1234', key: 'somehashvalue1234' }),
        buildApiKey({ prefix: 'lg_efgh5678', key: 'anotherhashvalue5678' }),
      ];
      mockPrisma.apiKey.findMany.mockResolvedValue(keys);

      const result = await listApiKeys('ws_1');

      expect(result).toHaveLength(2);
      expect(result[0].key).toContain('****');
      expect(result[0].key).toContain('lg_abcd1234');
    });
  });

  describe('validateApiKey', () => {
    it('should return key record for valid active key', async () => {
      const workspace = buildWorkspace({ plan: 'pro' });
      const apiKey = buildApiKey({ workspace, isActive: true });

      mockPrisma.apiKey.findUnique.mockResolvedValue(apiKey);
      mockPrisma.apiKey.update.mockResolvedValue(apiKey);

      const result = await validateApiKey('lg_test1234_somekey');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(apiKey.id);
      expect(mockPrisma.apiKey.update).toHaveBeenCalled();
    });

    it('should return null for non-existent key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await validateApiKey('invalid_key');

      expect(result).toBeNull();
    });

    it('should return null for inactive key', async () => {
      const workspace = buildWorkspace();
      const apiKey = buildApiKey({ workspace, isActive: false });

      mockPrisma.apiKey.findUnique.mockResolvedValue(apiKey);

      const result = await validateApiKey('lg_inactive_key');

      expect(result).toBeNull();
    });
  });

  describe('trackUsage', () => {
    it('should create usage record and increment request count', async () => {
      mockPrisma.apiKeyUsage.create.mockResolvedValue(buildApiKeyUsage());
      mockPrisma.apiKey.update.mockResolvedValue(buildApiKey());

      await trackUsage('key_1', '/api/leads', 'GET', 200, 45);

      expect(mockPrisma.apiKeyUsage.create).toHaveBeenCalledWith({
        data: {
          apiKeyId: 'key_1',
          endpoint: '/api/leads',
          method: 'GET',
          statusCode: 200,
          responseTimeMs: 45,
        },
      });
      expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key_1' },
        data: { requestCount: { increment: 1 } },
      });
    });
  });

  describe('getUsageStats', () => {
    it('should return aggregated usage statistics', async () => {
      const records = [
        buildApiKeyUsage({ statusCode: 200, responseTimeMs: 40, endpoint: '/api/leads', method: 'GET' }),
        buildApiKeyUsage({ statusCode: 200, responseTimeMs: 60, endpoint: '/api/leads', method: 'POST' }),
        buildApiKeyUsage({ statusCode: 404, responseTimeMs: 30, endpoint: '/api/leads/1', method: 'GET' }),
      ];

      mockPrisma.apiKeyUsage.count.mockResolvedValue(3);
      mockPrisma.apiKeyUsage.findMany.mockResolvedValue(records);

      const stats = await getUsageStats('key_1');

      expect(stats.totalRequests).toBe(3);
      expect(stats.avgResponseTime).toBeGreaterThan(0);
      expect(stats.statusCodes).toBeDefined();
      expect(stats.endpoints).toBeDefined();
    });

    it('should filter by date range', async () => {
      mockPrisma.apiKeyUsage.count.mockResolvedValue(0);
      mockPrisma.apiKeyUsage.findMany.mockResolvedValue([]);

      await getUsageStats('key_1', '2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z');

      const countCall = mockPrisma.apiKeyUsage.count.mock.calls[0][0];
      expect(countCall.where.createdAt).toBeDefined();
      expect(countCall.where.createdAt.gte).toBeDefined();
      expect(countCall.where.createdAt.lte).toBeDefined();
    });
  });
});
