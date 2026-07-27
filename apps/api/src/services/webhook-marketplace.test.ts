import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWebhookTemplate, buildRecipe, buildWebhookSubscription } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  listTemplates,
  getTemplate,
  createFromTemplate,
  listRecipes,
  getRecipe,
  activateRecipe,
  deactivateRecipe,
} = await import('./webhook-marketplace.js');

describe('Webhook Marketplace Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listTemplates', () => {
    it('should return all public templates', async () => {
      const templates = [buildWebhookTemplate(), buildWebhookTemplate()];
      mockPrisma.webhookTemplate.findMany.mockResolvedValue(templates);

      const result = await listTemplates();

      expect(result).toHaveLength(2);
      expect(mockPrisma.webhookTemplate.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter templates by category', async () => {
      const templates = [buildWebhookTemplate({ category: 'notifications' })];
      mockPrisma.webhookTemplate.findMany.mockResolvedValue(templates);

      const result = await listTemplates('notifications');

      expect(result).toHaveLength(1);
      expect(mockPrisma.webhookTemplate.findMany).toHaveBeenCalledWith({
        where: { category: 'notifications', isPublic: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getTemplate', () => {
    it('should return a template by id', async () => {
      const template = buildWebhookTemplate();
      mockPrisma.webhookTemplate.findUnique.mockResolvedValue(template);

      const result = await getTemplate(template.id);

      expect(result).toEqual(template);
    });

    it('should throw not found if template does not exist', async () => {
      mockPrisma.webhookTemplate.findUnique.mockResolvedValue(null);

      await expect(getTemplate('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('createFromTemplate', () => {
    it('should create a webhook subscription from template', async () => {
      const template = buildWebhookTemplate({
        triggerEvents: ['lead.created'],
        targetUrl: 'https://hooks.slack.com/services/xxx',
      });
      const subscription = buildWebhookSubscription();

      mockPrisma.webhookTemplate.findUnique.mockResolvedValue(template);
      mockPrisma.webhookSubscription.create.mockResolvedValue(subscription);

      const result = await createFromTemplate(template.id, {});

      expect(result).toEqual(subscription);
      expect(mockPrisma.webhookSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          url: 'https://hooks.slack.com/services/xxx',
          events: ['lead.created'],
          isActive: true,
        }),
      });
    });

    it('should use config targetUrl if provided', async () => {
      const template = buildWebhookTemplate({ targetUrl: 'https://default.com' });
      const subscription = buildWebhookSubscription();

      mockPrisma.webhookTemplate.findUnique.mockResolvedValue(template);
      mockPrisma.webhookSubscription.create.mockResolvedValue(subscription);

      await createFromTemplate(template.id, { targetUrl: 'https://custom.com' });

      expect(mockPrisma.webhookSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          url: 'https://custom.com',
        }),
      });
    });

    it('should throw not found if template does not exist', async () => {
      mockPrisma.webhookTemplate.findUnique.mockResolvedValue(null);

      await expect(createFromTemplate('nonexistent', {})).rejects.toThrow('not found');
    });
  });

  describe('listRecipes', () => {
    it('should return all recipes', async () => {
      const recipes = [buildRecipe(), buildRecipe()];
      mockPrisma.recipe.findMany.mockResolvedValue(recipes);

      const result = await listRecipes();

      expect(result).toHaveLength(2);
    });

    it('should filter recipes by category', async () => {
      const recipes = [buildRecipe({ category: 'data_sync' })];
      mockPrisma.recipe.findMany.mockResolvedValue(recipes);

      const result = await listRecipes('data_sync');

      expect(result).toHaveLength(1);
      expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith({
        where: { category: 'data_sync' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getRecipe', () => {
    it('should return a recipe by id', async () => {
      const recipe = buildRecipe();
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);

      const result = await getRecipe(recipe.id);

      expect(result).toEqual(recipe);
    });

    it('should throw not found if recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(getRecipe('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('activateRecipe', () => {
    it('should activate a recipe', async () => {
      const recipe = buildRecipe({ isActive: false });
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);
      mockPrisma.recipe.update.mockResolvedValue({ ...recipe, isActive: true });

      const result = await activateRecipe(recipe.id, {});

      expect(result.isActive).toBe(true);
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: recipe.id },
        data: expect.objectContaining({ isActive: true }),
      });
    });

    it('should throw not found if recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(activateRecipe('nonexistent', {})).rejects.toThrow('not found');
    });
  });

  describe('deactivateRecipe', () => {
    it('should deactivate a recipe', async () => {
      const recipe = buildRecipe({ isActive: true });
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);
      mockPrisma.recipe.update.mockResolvedValue({ ...recipe, isActive: false });

      const result = await deactivateRecipe(recipe.id);

      expect(result.isActive).toBe(false);
    });

    it('should throw not found if recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);

      await expect(deactivateRecipe('nonexistent')).rejects.toThrow('not found');
    });
  });
});
