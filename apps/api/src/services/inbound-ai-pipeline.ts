import { prisma } from '../db.js';
import { aiQueue, sendQueue } from '../queue/index.js';
import { analyzeMessageIntent, generateReplyDraft } from './ai/index.js';
import { publishEvent } from './event-bus.js';
import { logger } from '../lib/logger.js';

export interface InboundPipelineResult {
  action: 'skipped' | 'analyzed' | 'draft_generated' | 'auto_sent';
  messageId: string;
  reason?: string;
}

/**
 * Check if the current time is within working hours.
 */
function isWithinWorkingHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Count how many auto-sent replies were made today.
 */
async function getDailyAutoReplyCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.message.count({
    where: {
      direction: 'outbound',
      isAiGenerated: true,
      reviewStatus: 'auto_sent',
      createdAt: { gte: startOfDay },
    },
  });
}

/**
 * Process an inbound message through the AI pipeline.
 * This is the main orchestrator for AI-assisted inbound handling.
 */
export async function processInboundMessage(messageId: string): Promise<InboundPipelineResult> {
  const settings = await prisma.agentSettings.findUnique({ where: { id: 'global' } });

  if (!settings || !settings.autoReplyEnabled) {
    logger.info(`AI auto-reply disabled, skipping message ${messageId}`);
    return { action: 'skipped', messageId, reason: 'auto_reply_disabled' };
  }

  // Analyze intent
  let intentResult: Record<string, unknown>;
  try {
    intentResult = await analyzeMessageIntent(messageId);
  } catch (err) {
    logger.error(`Failed to analyze intent for message ${messageId}`, { error: (err as Error).message });
    return { action: 'skipped', messageId, reason: 'analysis_failed' };
  }

  const intentCategory = (intentResult.category as string) || 'other';
  const confidence = (intentResult.confidence as number) || 0;

  // Check if intent is excluded
  const excludedIntents = settings.excludedIntents || [];
  if (excludedIntents.includes(intentCategory)) {
    logger.info(`Intent '${intentCategory}' is excluded, notifying user for message ${messageId}`);
    await prisma.message.update({
      where: { id: messageId },
      data: { reviewStatus: 'rejected' },
    });
    publishEvent('inbound.processed', 'message', messageId, {
      action: 'analyzed',
      intentCategory,
      reason: 'excluded_intent',
    }).catch(() => {});
    return { action: 'analyzed', messageId, reason: 'excluded_intent' };
  }

  // Generate draft reply
  let draft: { subject: string; body: string };
  try {
    draft = await generateReplyDraft(messageId, settings.tone);
  } catch (err) {
    logger.error(`Failed to generate draft for message ${messageId}`, { error: (err as Error).message });
    return { action: 'analyzed', messageId, reason: 'draft_generation_failed' };
  }

  // If review queue is enabled and autopilot is not active, mark as pending_review
  if (settings.reviewQueueEnabled && !settings.isAutoPilotActive) {
    await prisma.message.update({
      where: { id: messageId },
      data: { reviewStatus: 'pending_review', draftReply: draft.body },
    });
    publishEvent('inbound.processed', 'message', messageId, {
      action: 'draft_generated',
      intentCategory,
      confidence,
    }).catch(() => {});
    return { action: 'draft_generated', messageId };
  }

  // Auto-send checks: confidence threshold, working hours, daily limit
  if (confidence < settings.autoReplyThreshold) {
    await prisma.message.update({
      where: { id: messageId },
      data: { reviewStatus: 'pending_review', draftReply: draft.body },
    });
    publishEvent('inbound.processed', 'message', messageId, {
      action: 'draft_generated',
      intentCategory,
      confidence,
      reason: 'below_threshold',
    }).catch(() => {});
    return { action: 'draft_generated', messageId, reason: 'below_threshold' };
  }

  if (!isWithinWorkingHours(settings.workingHoursStart, settings.workingHoursEnd)) {
    await prisma.message.update({
      where: { id: messageId },
      data: { reviewStatus: 'pending_review', draftReply: draft.body },
    });
    publishEvent('inbound.processed', 'message', messageId, {
      action: 'draft_generated',
      intentCategory,
      confidence,
      reason: 'outside_working_hours',
    }).catch(() => {});
    return { action: 'draft_generated', messageId, reason: 'outside_working_hours' };
  }

  const dailyCount = await getDailyAutoReplyCount();
  if (dailyCount >= settings.maxDailyReplies) {
    await prisma.message.update({
      where: { id: messageId },
      data: { reviewStatus: 'pending_review', draftReply: draft.body },
    });
    publishEvent('inbound.processed', 'message', messageId, {
      action: 'draft_generated',
      intentCategory,
      confidence,
      reason: 'daily_limit_reached',
    }).catch(() => {});
    return { action: 'draft_generated', messageId, reason: 'daily_limit_reached' };
  }

  // All checks passed - auto send
  const originalMessage = await prisma.message.findUnique({
    where: { id: messageId },
    include: { lead: { select: { email: true, phone: true } } },
  });

  if (originalMessage) {
    const replyMsg = await prisma.message.create({
      data: {
        leadId: originalMessage.leadId,
        channel: originalMessage.channel,
        direction: 'outbound',
        subject: draft.subject || originalMessage.subject || 'Re: Your message',
        body: draft.body,
        isAiGenerated: true,
        reviewStatus: 'auto_sent',
        status: 'queued',
      },
    });

    const to = originalMessage.channel === 'email'
      ? originalMessage.lead?.email
      : originalMessage.lead?.phone;

    if (to) {
      await sendQueue.add('send-message', {
        messageId: replyMsg.id,
        channel: originalMessage.channel,
        to,
        subject: draft.subject || originalMessage.subject || 'Re: Your message',
        body: draft.body,
      });
    }
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { reviewStatus: 'auto_sent', draftReply: draft.body },
  });

  publishEvent('inbound.processed', 'message', messageId, {
    action: 'auto_sent',
    intentCategory,
    confidence,
  }).catch(() => {});

  return { action: 'auto_sent', messageId };
}
