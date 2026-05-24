import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { aiQueue } from '../queue/index.js';
import { verifyWebhook } from '../middleware/webhook-verify.js';
import { publishEvent } from '../services/event-bus.js';
import { handleScoringEvent } from '../services/lead-scoring.js';
import { updateChannelMetrics } from '../services/channel-health.js';

const router = Router();

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
      handleScoringEvent(lead.id, 'bounce').catch(() => {});
      updateChannelMetrics('email', 'bounced').catch(() => {});
    } else if (event === 'open') {
      const msg = await prisma.message.findFirst({ where: { providerId: messageId } });
      if (msg) await prisma.message.update({ where: { id: msg.id }, data: { readAt: new Date() } });
      handleScoringEvent(lead.id, 'open').catch(() => {});
    } else if (event === 'click') {
      handleScoringEvent(lead.id, 'click').catch(() => {});
    } else if (event === 'delivered') {
      const msg = await prisma.message.findFirst({ where: { providerId: messageId } });
      if (msg) await prisma.message.update({ where: { id: msg.id }, data: { status: 'delivered', deliveredAt: new Date() } });
      updateChannelMetrics('email', 'delivered').catch(() => {});
    } else if (event === 'complaint') {
      updateChannelMetrics('email', 'complaint').catch(() => {});
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

      // Pause active sequence enrollments if pauseOnReply is enabled
      const activeEnrollments = await prisma.sequenceEnrollment.findMany({
        where: { leadId: lead.id, status: 'active' },
        include: { sequence: { select: { pauseOnReply: true } } },
      });
      for (const enrollment of activeEnrollments) {
        if (enrollment.sequence.pauseOnReply) {
          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: { status: 'paused', exitReason: 'replied' },
          });
        }
      }

      await aiQueue.add('analyze-intent', { messageId: inboundMsg.id });
      publishEvent('message.received', 'message', inboundMsg.id, { message: inboundMsg, leadId: lead.id, channel: 'email' });
      handleScoringEvent(lead.id, 'reply').catch(() => {});
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

    // Pause active sequence enrollments if pauseOnReply is enabled
    const activeEnrollments = await prisma.sequenceEnrollment.findMany({
      where: { leadId: lead.id, status: 'active' },
      include: { sequence: { select: { pauseOnReply: true } } },
    });
    for (const enrollment of activeEnrollments) {
      if (enrollment.sequence.pauseOnReply) {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'paused', exitReason: 'replied' },
        });
      }
    }

    await aiQueue.add('analyze-intent', { messageId: inboundMsg.id });
    publishEvent('message.received', 'message', inboundMsg.id, { message: inboundMsg, leadId: lead.id, channel: 'whatsapp' });
    handleScoringEvent(lead.id, 'reply').catch(() => {});
    updateChannelMetrics('whatsapp', 'delivered').catch(() => {});
    res.json({ data: { processed: true } });
  } catch (err) { next(err); }
});

export default router;
