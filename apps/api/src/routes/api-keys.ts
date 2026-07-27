import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { apiKeyCreateSchema, apiKeyUsageQuerySchema } from '@leadgenius/shared';
import { generateApiKey, revokeApiKey, listApiKeys, getUsageStats } from '../services/api-keys.js';
import { prisma } from '../db.js';

const router = Router();

router.post('/', validate(apiKeyCreateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, permissions } = req.body;

    const member = await prisma.workspaceMember.findFirst({
      where: { userId: req.user!.userId },
      include: { workspace: true },
    });

    if (!member) {
      throw AppError.notFound('Workspace membership');
    }

    const result = await generateApiKey(member.workspaceId, name, permissions);

    res.status(201).json({
      data: {
        id: result.id,
        name: result.name,
        key: result.fullKey,
        prefix: result.prefix,
        permissions: result.permissions,
        createdAt: result.createdAt,
      },
    });
  } catch (err) { next(err); }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: req.user!.userId },
    });

    if (!member) {
      throw AppError.notFound('Workspace membership');
    }

    const keys = await listApiKeys(member.workspaceId);
    res.json({ data: keys });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const apiKey = await prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) {
      throw AppError.notFound('API key');
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { userId: req.user!.userId, workspaceId: apiKey.workspaceId },
    });

    if (!member) {
      throw AppError.notFound('API key');
    }

    await revokeApiKey(id);
    res.json({ data: { id } });
  } catch (err) { next(err); }
});

router.get('/:id/usage', validate(apiKeyUsageQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const apiKey = await prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) {
      throw AppError.notFound('API key');
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { userId: req.user!.userId, workspaceId: apiKey.workspaceId },
    });

    if (!member) {
      throw AppError.notFound('API key');
    }

    const stats = await getUsageStats(id, startDate, endDate);
    res.json({ data: stats });
  } catch (err) { next(err); }
});

export default router;
