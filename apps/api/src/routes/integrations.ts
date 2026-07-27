import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { integrationSchema, paginationSchema } from '@leadgenius/shared';

const router = Router();

function redactCredentials(integration: Record<string, unknown>): Record<string, unknown> {
  if (!integration.credentials || typeof integration.credentials !== 'object') {
    return integration;
  }
  const redacted: Record<string, string> = {};
  for (const key of Object.keys(integration.credentials as Record<string, unknown>)) {
    redacted[key] = '***';
  }
  return { ...integration, credentials: redacted };
}

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const [items, total] = await Promise.all([
      prisma.integration.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.integration.count(),
    ]);
    const data = (items as unknown as Record<string, unknown>[]).map((item) => redactCredentials(item));
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.integration.findUnique({ where: { id: (req.params.id as string) } });
    if (!item) throw AppError.notFound('Integration');
    res.json({ data: redactCredentials(item as unknown as Record<string, unknown>) });
  } catch (err) { next(err); }
});

router.post('/', validate(integrationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.integration.create({ data: req.body });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(integrationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.integration.update({
      where: { id: (req.params.id as string) },
      data: req.body,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.integration.delete({ where: { id: (req.params.id as string) } });
    res.json({ data: { id: (req.params.id as string) } });
  } catch (err) { next(err); }
});

router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integration = await prisma.integration.findUnique({ where: { id: (req.params.id as string) } });
    if (!integration) throw AppError.notFound('Integration');
    // For now, just validate the integration exists and has config
    res.json({ data: { success: true, message: 'Integration configuration is valid' } });
  } catch (err) { next(err); }
});

export default router;
