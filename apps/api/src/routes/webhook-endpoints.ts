import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import crypto from 'crypto';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

const updateSchema = createSchema.partial();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.webhookEndpoint.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, url, events } = req.body;
    const secret = crypto.randomBytes(16).toString('hex');
    const data = await prisma.webhookEndpoint.create({ data: { name, url, events, secret } });
    res.status(201).json({ data: { ...data, secret } });
  } catch (err) { next(err); }
});

router.put('/:id', validate(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.webhookEndpoint.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: { code: 404, message: 'Webhook not found' } });
    const data = await prisma.webhookEndpoint.update({ where: { id: req.params.id }, data: req.body });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

router.post('/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.webhookEndpoint.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: { code: 404, message: 'Webhook not found' } });
    const data = await prisma.webhookEndpoint.update({ where: { id: req.params.id }, data: { active: !existing.active } });
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/:id/deliveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.webhookDelivery.findMany({
      where: { endpointId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/regenerate-secret', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = crypto.randomBytes(16).toString('hex');
    const data = await prisma.webhookEndpoint.update({ where: { id: req.params.id }, data: { secret } });
    res.json({ data: { ...data, secret } });
  } catch (err) { next(err); }
});

export default router;
