import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import type { Prisma } from '@prisma/client';

export async function listTemplates(category?: string) {
  const where = category ? { category, isPublic: true } : { isPublic: true };
  return prisma.webhookTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTemplate(id: string) {
  const template = await prisma.webhookTemplate.findUnique({ where: { id } });
  if (!template) throw AppError.notFound('WebhookTemplate');
  return template;
}

export async function createFromTemplate(templateId: string, config: Record<string, unknown>) {
  const template = await prisma.webhookTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw AppError.notFound('WebhookTemplate');

  const targetUrl = (config.targetUrl as string) || template.targetUrl;
  const headers = (config.headers as Record<string, string>) || (template.headers as Record<string, string> | null) || undefined;

  const subscription = await prisma.webhookSubscription.create({
    data: {
      name: `${template.name} (from template)`,
      url: targetUrl,
      events: template.triggerEvents as string[],
      headers: headers || undefined,
      isActive: true,
    },
  });

  return subscription;
}

export async function listRecipes(category?: string) {
  const where = category ? { category } : {};
  return prisma.recipe.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRecipe(id: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) throw AppError.notFound('Recipe');
  return recipe;
}

export async function activateRecipe(recipeId: string, config: Record<string, unknown>) {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) throw AppError.notFound('Recipe');

  const updated = await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      isActive: true,
      steps: mergeStepsConfig(recipe.steps as Record<string, unknown>[], config) as unknown as Prisma.InputJsonValue,
    },
  });

  return updated;
}

export async function deactivateRecipe(recipeId: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) throw AppError.notFound('Recipe');

  return prisma.recipe.update({
    where: { id: recipeId },
    data: { isActive: false },
  });
}

function mergeStepsConfig(steps: Record<string, unknown>[], config: Record<string, unknown>): Record<string, unknown>[] {
  return steps.map((step) => ({
    ...step,
    ...((config.stepOverrides as Record<string, unknown>) || {}),
  }));
}
