import { analyzeIntent, generateDraft, enrichLead, generateCampaign } from './openai.js';
import { prisma } from '../../db.js';
import { logger } from '../../lib/logger.js';

export async function analyzeMessageIntent(messageId: string): Promise<Record<string, unknown>> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { lead: true },
  });
  if (!message) throw new Error('Message not found');

  const leadName = message.lead?.name || '';
  const leadCompany = message.lead?.company ?? null;
  const result = await analyzeIntent(leadName, leadCompany, message.subject, message.body);

  await prisma.message.update({
    where: { id: messageId },
    data: { intentAnalysis: result as any },
  });

  if (message.lead) {
    await prisma.lead.update({
      where: { id: message.lead.id },
      data: { intentAnalysis: result as any },
    });
  }

  logger.info(`Intent analyzed for message ${messageId}`, { category: result.category });
  return result;
}

export async function generateReplyDraft(messageId: string, tone?: string): Promise<{ subject: string; body: string }> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { lead: true },
  });
  if (!message) throw new Error('Message not found');

  const intentCategory = (message.intentAnalysis as Record<string, unknown>)?.category as string || 'other';
  const result = await generateDraft(
    message.lead.name || '',
    message.lead.company,
    message.body,
    intentCategory,
    tone || 'professional',
  );

  await prisma.message.update({
    where: { id: messageId },
    data: { draftReply: result.body },
  });

  return result;
}

export async function enrichLeadData(leadId: string): Promise<Record<string, unknown>> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  const result = await enrichLead(lead.name, lead.email, lead.company, lead.title, lead.source);

  await prisma.lead.update({
    where: { id: leadId },
    data: { enrichmentData: result as any },
  });

  const suggestedTags = (result.suggestedTags as string[]) || [];
  if (suggestedTags.length > 0) {
    const existingTags = lead.tags || [];
    const newTags = [...new Set([...existingTags, ...suggestedTags])];
    await prisma.lead.update({
      where: { id: leadId },
      data: { tags: newTags },
    });
  }

  return result;
}

export async function generateCampaignSequence(name: string, industry: string, product: string, channel: string, targetCount: number): Promise<Record<string, unknown>> {
  return generateCampaign(name, industry, product, channel, targetCount);
}
