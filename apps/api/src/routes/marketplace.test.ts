import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWebhookTemplate, buildRecipe, buildWebhookSubscription } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: marketplaceRoutes } = await import('./marketplace.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/marketplace', marketplaceRoutes);
  app.use(errorHandler);
  return app;
}

describe('Marketplace API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/marketplace/templates', () => {
    it('should list all public templates', async () => {
      const templates = [buildWebhookTemplate(), buildWebhookTemplate()];
      mockPrisma.webhookTemplate.findMany.mockResolvedValue(templates);

      const res = await request(createApp())
        .get('/api/marketplace/templates');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter templates by category', async () => {
      const templates = [buildWebhookTemplate({ category: 'notifications' })];
      mockPrisma.webhookTemplate.findMany.mockResolvedValue(templates);

      const res = await request(createApp())
        .get('/api/marketplace/templates?category=notifications');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/marketplace/recipes', () => {
    it('should list all recipes', async () => {
      const recipes = [buildRecipe(), buildRecipe()];
      mockPrisma.recipe.findMany.mockResolvedValue(recipes);

      const res = await request(createApp())
        .get('/api/marketplace/recipes');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter recipes by category', async () => {
      const recipes = [buildRecipe({ category: 'data_sync' })];
      mockPrisma.recipe.findMany.mockResolvedValue(recipes);

      const res = await request(createApp())
        .get('/api/marketplace/recipes?category=data_sync');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/marketplace/recipes/:id/activate', () => {
    it('should activate a recipe', async () => {
      const recipe = buildRecipe({ isActive: false });
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);
      mockPrisma.recipe.update.mockResolvedValue({ ...recipe, isActive: true });

      const res = await request(createApp())
        .post(`/api/marketplace/recipes/${recipe.id}/activate`)
        .send({ config: {} });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('should return 404 for non-existent recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/marketplace/recipes/nonexistent/activate')
        .send({ config: {} });

      expect(res.status).toBe(404);
    });

    it('should accept empty body (defaults to empty config)', async () => {
      const recipe = buildRecipe({ isActive: false });
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);
      mockPrisma.recipe.update.mockResolvedValue({ ...recipe, isActive: true });

      const res = await request(createApp())
        .post(`/api/marketplace/recipes/${recipe.id}/activate`)
        .send({});

      expect(res.status).toBe(200);
    });
  });
});
