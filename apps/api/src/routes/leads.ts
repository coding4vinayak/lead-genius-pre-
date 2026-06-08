import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { leadSchema, paginationSchema, exportSchema } from '@leadgenius/shared';
import { z } from 'zod';
import { dispatchWebhookEvent } from '../services/webhook-delivery.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { search, status, tag, source, sort, warmupActive, warmup, scoreSegment } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (tag) where.tags = { has: tag };
    if (warmupActive === 'true') where.warmupActive = true;
    if (warmupActive === 'false') where.warmupActive = false;
    if (scoreSegment === 'hot') where.score = { gte: 70 };
    if (scoreSegment === 'warm') where.score = { gte: 40, lt: 70 };
    if (scoreSegment === 'cool') where.score = { gte: 20, lt: 40 };
    if (scoreSegment === 'cold') where.score = { gte: 1, lt: 20 };
    if (scoreSegment === 'unscored') where.score = null;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy = sort ? { [sort.replace('-', '')]: sort.startsWith('-') ? 'desc' : 'asc' } : { createdAt: 'desc' as const };

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = await prisma.lead.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 50 },
        groupMembers: { include: { group: true } },
        warmupTasks: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!data) throw AppError.notFound('Lead');
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(leadSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.lead.create({ data: req.body });
    dispatchWebhookEvent('lead.created', { leadId: data.id, lead: data });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(leadSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = await prisma.lead.update({ where: { id }, data: req.body });
    dispatchWebhookEvent('lead.updated', { leadId: id, lead: data });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.lead.delete({ where: { id } });
    dispatchWebhookEvent('lead.deleted', { leadId: id });
    res.json({ data: { id } });
  } catch (err) { next(err); }
});

router.post('/bulk-tag', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, tags, action } = req.body as { ids: string[]; tags: string[]; action: 'add' | 'remove' };
    const leads = await prisma.lead.findMany({ where: { id: { in: ids } } });
    await Promise.all(leads.map((lead) =>
      prisma.lead.update({
        where: { id: lead.id },
        data: { tags: action === 'add' ? [...new Set([...lead.tags, ...tags])] : lead.tags.filter((t) => !tags.includes(t)) },
      }),
    ));
    res.json({ data: { updated: ids.length } });
  } catch (err) { next(err); }
});

router.post('/bulk-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, status } = req.body as { ids: string[]; status: string };
    await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { status: status as any } });
    res.json({ data: { updated: ids.length } });
  } catch (err) { next(err); }
});

router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leads } = req.body as { leads: Array<Record<string, string>> };
    const created = await prisma.lead.createMany({ data: leads });
    res.status(201).json({ data: { count: created.count } });
  } catch (err) { next(err); }
});

router.post('/export', validate(exportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format, status, source, tag, search, fields } = req.body as {
      format: 'csv' | 'json'; status?: string; source?: string; tag?: string; search?: string; fields?: string[];
    };

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (tag) where.tags = { has: tag };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' } });

    if (format === 'json') {
      const data = fields ? leads.map((l) => {
        const filtered: Record<string, unknown> = {};
        fields.forEach((f) => { (filtered as any)[f] = (l as any)[f]; });
        return filtered;
      }) : leads;
      res.json({ data });
      return;
    }

    const allFields = fields || ['name', 'email', 'phone', 'company', 'title', 'source', 'status', 'tags', 'score', 'createdAt'];
    const header = allFields.join(',');
    const csvRows = leads.map((l) =>
      allFields.map((f) => {
        const val = (l as any)[f];
        if (Array.isArray(val)) return `"${val.join('; ')}"`;
        if (val && typeof val === 'object') return `"${JSON.stringify(val)}"`;
        return `"${val ?? ''}"`;
      }).join(','),
    );
    const csv = [header, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads-export.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

const leadStageSchema = z.object({
  stage: z.enum(['new', 'contacted', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
});

const leadNotesSchema = z.object({
  notes: z.string().optional(),
});

router.put('/:id/stage', validate(leadStageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { stage } = req.body;
    const data = await prisma.lead.update({ where: { id }, data: { stage } });
    await prisma.leadTimeline.create({
      data: { leadId: id, action: 'stage_change', detail: `Stage changed to ${stage}` },
    });
    dispatchWebhookEvent('lead.stage_changed', { leadId: id, stage, lead: data });
    res.json({ data });
  } catch (err) { next(err); }
});

router.put('/:id/notes', validate(leadNotesSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { notes } = req.body;
    const data = await prisma.lead.update({ where: { id }, data: { notes } });
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = await prisma.leadTimeline.findMany({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { action, detail, metadata } = req.body as { action: string; detail?: string; metadata?: any };
    const data = await prisma.leadTimeline.create({
      data: { leadId: id, action, detail, metadata },
    });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

export default router;
