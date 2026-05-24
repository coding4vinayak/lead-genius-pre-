import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { paginationSchema } from '@leadgenius/shared';
import { z } from 'zod';

const router = Router();

const messageSchema = z.object({
  campaignId: z.string().optional(),
  leadId: z.string().min(1),
  channel: z.enum(['email', 'whatsapp']),
  direction: z.enum(['outbound', 'inbound']).default('outbound'),
  subject: z.string().optional(),
  body: z.string().min(1),
  status: z.enum(['queued', 'sent', 'delivered', 'failed', 'bounced', 'replied']).default('queued'),
  providerId: z.string().optional(),
  isAiGenerated: z.boolean().default(false),
});

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { channel, status, campaignId, leadId } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;
    if (leadId) where.leadId = leadId;

    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { lead: { select: { name: true, email: true } }, campaign: { select: { name: true } } },
      }),
      prisma.message.count({ where }),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.message.findUnique({
      where: { id: (req.params.id as string) },
      include: { lead: true, campaign: true },
    });
    if (!data) return res.status(404).json({ error: { code: 404, message: 'Message not found' } });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(messageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.message.create({ data: req.body });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(messageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.message.findUnique({ where: { id: (req.params.id as string) } });
    if (!existing) throw AppError.notFound('Message');
    const data = await prisma.message.update({ where: { id: (req.params.id as string) }, data: req.body });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.message.findUnique({ where: { id: (req.params.id as string) } });
    if (!existing) throw AppError.notFound('Message');
    await prisma.message.delete({ where: { id: (req.params.id as string) } });
    res.json({ data: { id: (req.params.id as string) } });
  } catch (err) { next(err); }
});

export default router;
