import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { generateApiKey } from '../lib/crypto.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  expiresInDays: z.number().int().positive().optional(),
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, keyPrefix: true, active: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, expiresInDays } = req.body;
    const { raw, prefix, hash } = generateApiKey();

    await prisma.apiKey.create({
      data: {
        name,
        keyPrefix: prefix,
        keyHash: hash,
        userId: req.user!.userId,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
      },
    });

    res.status(201).json({ data: { key: raw, name, prefix } });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.apiKey.delete({ where: { id: req.params.id } });
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

router.post('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: { code: 404, message: 'API key not found' } });
    const data = await prisma.apiKey.update({ where: { id: req.params.id }, data: { active: !existing.active } });
    res.json({ data });
  } catch (err) { next(err); }
});

export default router;
