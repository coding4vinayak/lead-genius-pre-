import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';
import { paginationSchema } from '@leadgenius/shared';
import { aiQueue } from '../queue/index.js';
import { analyzeMessageIntent } from '../services/ai/index.js';
import { processInboundMessage } from '../services/inbound-ai-pipeline.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { search, intentCategory, leadId } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { direction: 'inbound' };

    if (leadId) where.leadId = leadId;
    if (intentCategory) {
      where.intentAnalysis = { path: ['category'], equals: intentCategory };
    }
    if (search) {
      where.OR = [
        { body: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { lead: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          lead: { select: { id: true, name: true, email: true, phone: true, company: true, score: true } },
        },
      }),
      prisma.message.count({ where }),
    ]);

    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/unread-count', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.message.count({
      where: { direction: 'inbound', readAt: null },
    });
    res.json({ data: { count } });
  } catch (err) { next(err); }
});

router.get('/conversations', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { messages: { some: { direction: 'inbound' } } },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { lastContactedAt: 'desc' },
    });

    const conversations = await Promise.all(leads.map(async (lead) => {
      const lastMessage = lead.messages[0];
      const unreadCount = await prisma.message.count({
        where: { leadId: lead.id, direction: 'inbound', readAt: null },
      });
      return {
        leadId: lead.id,
        leadName: lead.name || lead.email || lead.phone || 'Unknown',
        leadCompany: lead.company,
        lastMessage: lastMessage?.body || '',
        lastMessageAt: lastMessage?.createdAt || lead.lastContactedAt,
        intentCategory: (lastMessage?.intentAnalysis as Record<string, unknown>)?.category || null,
        unreadCount,
        messageCount: lead._count.messages,
      };
    }));

    res.json({ data: conversations });
  } catch (err) { next(err); }
});

router.get('/review-queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const where = {
      direction: 'inbound' as const,
      reviewStatus: 'pending_review',
    };

    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          lead: { select: { id: true, name: true, email: true, phone: true, company: true, score: true } },
        },
      }),
      prisma.message.count({ where }),
    ]);

    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [unread, pendingReviews, autoRepliedToday] = await Promise.all([
      prisma.message.count({ where: { direction: 'inbound', readAt: null } }),
      prisma.message.count({ where: { direction: 'inbound', reviewStatus: 'pending_review' } }),
      prisma.message.count({
        where: {
          direction: 'outbound',
          isAiGenerated: true,
          reviewStatus: 'auto_sent',
          createdAt: { gte: startOfDay },
        },
      }),
    ]);

    res.json({ data: { unread, pendingReviews, autoRepliedToday } });
  } catch (err) { next(err); }
});

router.get('/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.leadId as string;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true, email: true, phone: true, company: true, title: true, score: true, enrichmentData: true },
    });
    if (!lead) return res.status(404).json({ error: { code: 404, message: 'Lead not found' } });

    const messages = await prisma.message.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ data: { lead, messages } });
  } catch (err) { next(err); }
});

router.post('/:messageId/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.messageId as string;
    const result = await analyzeMessageIntent(messageId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/:messageId/send-draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.messageId as string;
    const { draftBody, draftSubject } = req.body as { draftBody: string; draftSubject?: string };

    const original = await prisma.message.findUnique({ where: { id: messageId }, include: { lead: true } });
    if (!original) return res.status(404).json({ error: { code: 404, message: 'Message not found' } });

    const reply = await prisma.message.create({
      data: {
        leadId: original.leadId,
        channel: original.channel,
        direction: 'outbound',
        subject: draftSubject || original.subject || 'Re: Your message',
        body: draftBody,
        isAiGenerated: true,
        status: 'queued',
      },
    });

    res.json({ data: reply });
  } catch (err) { next(err); }
});

router.post('/:messageId/approve-draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.messageId as string;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, leadId: true, channel: true, subject: true, draftReply: true, reviewStatus: true },
    });
    if (!message) return res.status(404).json({ error: { code: 404, message: 'Message not found' } });
    if (message.reviewStatus !== 'pending_review') {
      return res.status(400).json({ error: { code: 400, message: 'Message is not pending review' } });
    }
    if (!message.draftReply) {
      return res.status(400).json({ error: { code: 400, message: 'No draft reply available' } });
    }

    const reply = await prisma.message.create({
      data: {
        leadId: message.leadId,
        channel: message.channel,
        direction: 'outbound',
        subject: message.subject || 'Re: Your message',
        body: message.draftReply,
        isAiGenerated: true,
        reviewStatus: 'approved',
        status: 'queued',
      },
    });

    await prisma.message.update({
      where: { id: messageId },
      data: { reviewStatus: 'approved' },
    });

    res.json({ data: reply });
  } catch (err) { next(err); }
});

router.post('/:messageId/reject-draft', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.messageId as string;
    const { manualReply } = req.body as { manualReply?: string };

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, leadId: true, channel: true, subject: true, reviewStatus: true },
    });
    if (!message) return res.status(404).json({ error: { code: 404, message: 'Message not found' } });
    if (message.reviewStatus !== 'pending_review') {
      return res.status(400).json({ error: { code: 400, message: 'Message is not pending review' } });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { reviewStatus: 'rejected' },
    });

    let reply = null;
    if (manualReply) {
      reply = await prisma.message.create({
        data: {
          leadId: message.leadId,
          channel: message.channel,
          direction: 'outbound',
          subject: message.subject || 'Re: Your message',
          body: manualReply,
          isAiGenerated: false,
          status: 'queued',
        },
      });
    }

    res.json({ data: { rejected: true, reply } });
  } catch (err) { next(err); }
});

export default router;
