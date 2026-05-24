import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { campaignSchema, paginationSchema } from '@leadgenius/shared';
import { campaignQueue } from '../queue/index.js';
import { publishEvent } from '../services/event-bus.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { status } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.campaign.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { template: { select: { name: true, channel: true } } },
      }),
      prisma.campaign.count({ where }),
    ]);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.campaign.findUnique({
      where: { id: (req.params.id as string) },
      include: {
        template: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!data) throw AppError.notFound('Campaign');
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(campaignSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.campaign.create({ data: req.body });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(campaignSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.campaign.update({ where: { id: (req.params.id as string) }, data: req.body });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.campaign.delete({ where: { id: (req.params.id as string) } });
    res.json({ data: { id: (req.params.id as string) } });
  } catch (err) { next(err); }
});

router.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: (req.params.id as string) } });
    if (!campaign) throw AppError.notFound('Campaign');

    const status = campaign.scheduleType === 'scheduled' ? 'scheduled' : 'running';
    const updated = await prisma.campaign.update({
      where: { id: (req.params.id as string) },
      data: { status },
    });

    await campaignQueue.add('execute-campaign', { campaignId: updated.id });
    res.json({ data: updated });
    publishEvent('campaign.activated', 'campaign', updated.id, { campaign: updated }).catch(() => {});
  } catch (err) { next(err); }
});

router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.campaign.update({
      where: { id: (req.params.id as string) },
      data: { status: 'paused' },
    });
    res.json({ data });
    publishEvent('campaign.paused', 'campaign', data.id, { campaign: data }).catch(() => {});
  } catch (err) { next(err); }
});

router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.campaign.update({
      where: { id: (req.params.id as string) },
      data: { status: 'running' },
    });
    await campaignQueue.add('execute-campaign', { campaignId: data.id });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.campaign.update({
      where: { id: (req.params.id as string) },
      data: { status: 'completed' },
    });
    res.json({ data });
    publishEvent('campaign.completed', 'campaign', data.id, { campaign: data }).catch(() => {});
  } catch (err) { next(err); }
});

router.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    const campaign = await prisma.campaign.findUnique({
      where: { id: (req.params.id as string) },
      include: { template: true },
    });
    if (!campaign) throw AppError.notFound('Campaign');

    await campaignQueue.add('send-message', {
      campaignId: campaign.id,
      leadId: null,
      to: email,
      templateId: campaign.templateId,
      variables: { name: 'Test', email },
    });
    res.json({ data: { message: 'Test queued' } });
  } catch (err) { next(err); }
});

export default router;
