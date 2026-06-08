import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { aiQueue, warmupQueue } from '../queue/index.js';
import { verifyWebhook } from '../middleware/webhook-verify.js';
import { dispatchWebhookEvent } from '../services/webhook-delivery.js';
import { scheduleNextWarmupStep } from '../services/warmup.js';

const router = Router();

router.post('/lead-import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leads } = req.body as { leads: Array<Record<string, string>> };
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      throw AppError.validation('leads array is required');
    }

    const created = await Promise.all(
      leads.map((lead) =>
        prisma.lead.create({
          data: {
            name: lead.name || undefined,
            email: lead.email || undefined,
            phone: lead.phone || undefined,
            company: lead.company || undefined,
            title: lead.title || undefined,
            source: lead.source || 'webhook',
            linkedinUrl: lead.linkedinUrl || undefined,
            websiteUrl: lead.websiteUrl || undefined,
            tags: lead.tags ? (typeof lead.tags === 'string' ? lead.tags.split(',').map((t: string) => t.trim()) : lead.tags) : [],
          },
        }),
      ),
    );

    for (const lead of created) {
      await prisma.leadTimeline.create({
        data: { leadId: lead.id, action: 'imported', detail: 'Imported via external webhook' },
      });
      dispatchWebhookEvent('lead.created', { leadId: lead.id, lead });
    }

    res.status(201).json({ data: { count: created.length } });
  } catch (err) { next(err); }
});

router.post('/email', verifyWebhook, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, subject, text, messageId, event } = req.body as Record<string, string>;
    const lead = await prisma.lead.findFirst({ where: { email: to } });
    if (!lead) return res.status(200).json({ data: { ignored: true } });

    if (event === 'bounce' || event === 'dropped') {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: 'bounced' } });
      const msg = await prisma.message.findFirst({ where: { providerId: messageId } });
      if (msg) {
        await prisma.message.update({ where: { id: msg.id }, data: { status: 'bounced' } });
      }
    } else if (event === 'open') {
      const msg = await prisma.message.findFirst({ where: { providerId: messageId } });
      if (msg) await prisma.message.update({ where: { id: msg.id }, data: { readAt: new Date() } });
    } else if (event === 'reply' || subject?.startsWith('Re:')) {
      const msg = await prisma.message.findFirst({ where: { providerId: messageId } });
      if (msg) {
        await prisma.message.update({ where: { id: msg.id }, data: { status: 'replied' } });
        await prisma.campaign.update({ where: { id: msg.campaignId! }, data: { replyCount: { increment: 1 } } });
      }
      const inboundMsg = await prisma.message.create({
        data: {
          leadId: lead.id, campaignId: msg?.campaignId,
          channel: 'email', direction: 'inbound',
          subject, body: text || subject || '',
          status: 'replied',
        },
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { lastContactedAt: new Date() } });
      await prisma.leadTimeline.create({
        data: { leadId: lead.id, action: 'email_reply', detail: `Inbound email reply: ${subject || 'no subject'}`, metadata: { messageId: inboundMsg.id } },
      });

      await aiQueue.add('analyze-intent', { messageId: inboundMsg.id });
    }
    res.json({ data: { processed: true } });
  } catch (err) { next(err); }
});

router.post('/whatsapp', verifyWebhook, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { From, Body, MessageSid } = req.body as Record<string, string>;
    const phone = From?.replace('whatsapp:', '');
    const lead = await prisma.lead.findFirst({ where: { phone } });
    if (!lead) return res.status(200).json({ data: { ignored: true } });

    const inboundMsg = await prisma.message.create({
      data: {
        leadId: lead.id, channel: 'whatsapp', direction: 'inbound',
        body: Body || '', providerId: MessageSid, status: 'replied',
      },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { lastContactedAt: new Date() } });
    await prisma.leadTimeline.create({
      data: { leadId: lead.id, action: 'whatsapp_reply', detail: `Inbound WhatsApp message`, metadata: { messageId: inboundMsg.id } },
    });

    await aiQueue.add('analyze-intent', { messageId: inboundMsg.id });
    res.json({ data: { processed: true } });
  } catch (err) { next(err); }
});

export default router;
