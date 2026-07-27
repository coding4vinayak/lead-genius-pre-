import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export interface VariantInput {
  name: string;
  subject?: string;
  body?: string;
  weight?: number;
}

export async function createTest(sequenceStepId: string, name: string, variants: VariantInput[]) {
  if (variants.length < 2) {
    throw AppError.validation('At least two variants are required');
  }

  const test = await prisma.abTest.create({
    data: {
      sequenceStepId,
      name,
      status: 'draft',
      variants: {
        create: variants.map((v) => ({
          name: v.name,
          subject: v.subject || null,
          body: v.body || null,
          weight: v.weight ?? 50,
        })),
      },
    },
    include: { variants: true },
  });

  return test;
}

export async function startTest(testId: string) {
  const test = await prisma.abTest.findUnique({ where: { id: testId }, include: { variants: true } });
  if (!test) throw AppError.notFound('AbTest');
  if (test.status !== 'draft') throw AppError.validation('Test can only be started from draft status');
  if (test.variants.length < 2) throw AppError.validation('Test must have at least 2 variants');

  return prisma.abTest.update({
    where: { id: testId },
    data: { status: 'running', startedAt: new Date() },
    include: { variants: true },
  });
}

export async function assignVariant(testId: string, _leadId: string) {
  const test = await prisma.abTest.findUnique({ where: { id: testId }, include: { variants: true } });
  if (!test) throw AppError.notFound('AbTest');
  if (test.status !== 'running') throw AppError.validation('Test is not running');

  const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
  const random = Math.random() * totalWeight;
  let cumulative = 0;

  for (const variant of test.variants) {
    cumulative += variant.weight;
    if (random <= cumulative) {
      await prisma.abTestVariant.update({
        where: { id: variant.id },
        data: { sentCount: { increment: 1 } },
      });
      return variant;
    }
  }

  // Fallback to last variant
  const lastVariant = test.variants[test.variants.length - 1];
  await prisma.abTestVariant.update({
    where: { id: lastVariant.id },
    data: { sentCount: { increment: 1 } },
  });
  return lastVariant;
}

export async function recordResult(variantId: string, metric: 'open' | 'click' | 'reply') {
  const fieldMap: Record<string, string> = {
    open: 'openCount',
    click: 'clickCount',
    reply: 'replyCount',
  };

  const field = fieldMap[metric];
  if (!field) throw AppError.validation('Invalid metric');

  return prisma.abTestVariant.update({
    where: { id: variantId },
    data: { [field]: { increment: 1 } },
  });
}

export async function checkSignificance(testId: string) {
  const test = await prisma.abTest.findUnique({ where: { id: testId }, include: { variants: true } });
  if (!test) throw AppError.notFound('AbTest');

  // Basic z-test for proportions between variants
  const variants = test.variants.filter((v) => v.sentCount > 0);
  if (variants.length < 2) {
    return { significant: false, reason: 'Not enough variants with data' };
  }

  // Minimum sample size check
  const minSample = 30;
  if (variants.some((v) => v.sentCount < minSample)) {
    return { significant: false, reason: 'Insufficient sample size (need at least 30 per variant)' };
  }

  // Compare open rates using z-test for proportions
  const rates = variants.map((v) => ({
    id: v.id,
    name: v.name,
    rate: v.sentCount > 0 ? v.openCount / v.sentCount : 0,
    n: v.sentCount,
  }));

  // Sort by rate descending
  rates.sort((a, b) => b.rate - a.rate);
  const best = rates[0];
  const second = rates[1];

  // Pooled proportion
  const pooledP = (best.rate * best.n + second.rate * second.n) / (best.n + second.n);
  const pooledSE = Math.sqrt(pooledP * (1 - pooledP) * (1 / best.n + 1 / second.n));

  if (pooledSE === 0) {
    return { significant: false, reason: 'No variance in data' };
  }

  const zScore = (best.rate - second.rate) / pooledSE;
  // z > 1.96 means 95% confidence
  const isSignificant = zScore > 1.96;

  return {
    significant: isSignificant,
    zScore: Math.round(zScore * 100) / 100,
    confidence: isSignificant ? 95 : Math.round((1 - 2 * (1 - normalCDF(Math.abs(zScore)))) * 100),
    winner: isSignificant ? best : null,
    variants: rates,
  };
}

function normalCDF(x: number): number {
  // Approximation of the normal CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327;
  const p = d * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export async function selectWinner(testId: string) {
  const test = await prisma.abTest.findUnique({ where: { id: testId }, include: { variants: true } });
  if (!test) throw AppError.notFound('AbTest');
  if (test.status !== 'running') throw AppError.validation('Test must be running to select a winner');

  // Find the variant with the highest open rate
  const variants = test.variants.filter((v) => v.sentCount > 0);
  if (variants.length === 0) throw AppError.validation('No variants have data');

  const winner = variants.reduce((best, v) => {
    const bestRate = best.sentCount > 0 ? best.openCount / best.sentCount : 0;
    const vRate = v.sentCount > 0 ? v.openCount / v.sentCount : 0;
    return vRate > bestRate ? v : best;
  });

  return prisma.abTest.update({
    where: { id: testId },
    data: {
      status: 'completed',
      winnerVariantId: winner.id,
      completedAt: new Date(),
    },
    include: { variants: true },
  });
}

export async function getTestResults(testId: string) {
  const test = await prisma.abTest.findUnique({ where: { id: testId }, include: { variants: true } });
  if (!test) throw AppError.notFound('AbTest');

  const variants = test.variants.map((v) => ({
    ...v,
    openRate: v.sentCount > 0 ? Math.round((v.openCount / v.sentCount) * 10000) / 100 : 0,
    clickRate: v.sentCount > 0 ? Math.round((v.clickCount / v.sentCount) * 10000) / 100 : 0,
    replyRate: v.sentCount > 0 ? Math.round((v.replyCount / v.sentCount) * 10000) / 100 : 0,
  }));

  return {
    ...test,
    variants,
  };
}

export async function listTests(page: number, pageSize: number) {
  const [data, total] = await Promise.all([
    prisma.abTest.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { variants: true },
    }),
    prisma.abTest.count(),
  ]);
  return { data, total };
}

export async function getTest(testId: string) {
  const test = await prisma.abTest.findUnique({ where: { id: testId }, include: { variants: true } });
  if (!test) throw AppError.notFound('AbTest');
  return test;
}
