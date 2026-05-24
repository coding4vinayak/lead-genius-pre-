import { Worker, ConnectionOptions } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const prisma = new PrismaClient();
const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

function loadPrompt(name: string): string {
  try {
    const promptPath = path.join(__dirname, '..', '..', '..', 'api', 'src', 'services', 'ai', 'prompts', `${name}.txt`);
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return '';
  }
}

function extractJson(text: string): Record<string, unknown> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }
  return {};
}

async function getClient(): Promise<OpenAI> {
  const agent = await prisma.agentSettings.findUnique({ where: { id: 'global' } });
  const apiKey = agent?.aiApiKey || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseURL = agent?.aiBaseUrl || process.env.AI_BASE_URL || undefined;
  return new OpenAI({ apiKey, baseURL });
}

async function getModel(): Promise<string> {
  const agent = await prisma.agentSettings.findUnique({ where: { id: 'global' } });
  return agent?.aiModel || process.env.AI_MODEL || 'gpt-4o-mini';
}

async function analyzeIntent(messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId }, include: { lead: true } });
  if (!message) throw new Error('Message not found');

  const prompt = loadPrompt('intent-analysis');
  const filled = prompt
    .replace('{{leadName}}', message.lead.name || 'Unknown')
    .replace('{{leadCompany}}', message.lead.company || 'Unknown')
    .replace('{{subject}}', message.subject || '(no subject)')
    .replace('{{body}}', message.body);

  try {
    const client = await getClient();
    const model = await getModel();
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: filled }],
      temperature: 0.3,
      max_tokens: 500,
    });
    const text = res.choices[0]?.message?.content || '';
    const result = extractJson(text);

    await prisma.message.update({ where: { id: messageId }, data: { intentAnalysis: result as any } });
    if (message.lead) {
      await prisma.lead.update({ where: { id: message.lead.id }, data: { intentAnalysis: result as any } });
    }

    const agent = await prisma.agentSettings.findUnique({ where: { id: 'global' } });
    if (agent?.isAutoPilotActive && result.confidence && Number(result.confidence) >= agent.autoReplyThreshold) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const repliesToday = await prisma.message.count({
        where: { isAiGenerated: true, createdAt: { gte: todayStart } },
      });

      if (repliesToday < (agent.maxDailyReplies || 50)) {
        await generateDraft(messageId, agent.tone || 'professional');
      }
    }

    logger.info(`Intent analyzed: ${messageId}`, { category: result.category });
  } catch (err: any) {
    logger.error('AI intent analysis failed', { error: err.message, messageId });
  }
}

async function generateDraft(messageId: string, tone?: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId }, include: { lead: true } });
  if (!message) throw new Error('Message not found');

  const prompt = loadPrompt('draft-reply');
  const intentCategory = (message.intentAnalysis as Record<string, unknown>)?.category as string || 'other';
  const filled = prompt
    .replace('{{tone}}', tone || 'professional')
    .replace('{{leadName}}', message.lead.name || 'Valued Customer')
    .replace('{{leadCompany}}', message.lead.company || 'their company')
    .replace('{{leadMessage}}', message.body)
    .replace('{{intentCategory}}', intentCategory);

  try {
    const client = await getClient();
    const model = await getModel();
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: filled }],
      temperature: 0.7,
      max_tokens: 600,
    });
    const text = res.choices[0]?.message?.content || '';
    const json = extractJson(text);
    const draftBody = (json.body as string) || '';

    await prisma.message.update({ where: { id: messageId }, data: { draftReply: draftBody } });

    const scheduledReply = await prisma.message.create({
      data: {
        leadId: message.leadId,
        channel: message.channel,
        direction: 'outbound',
        subject: (json.subject as string) || message.subject || 'Re: Your message',
        body: draftBody,
        isAiGenerated: true,
        status: 'queued',
      },
    });

    logger.info(`AI draft generated and queued`, { originalMessageId: messageId, replyId: scheduledReply.id });
  } catch (err: any) {
    logger.error('AI draft generation failed', { error: err.message, messageId });
  }
}

async function generateCampaignHandler(data: { name: string; industry?: string; product?: string; channel: string; targetCount?: number }) {
  try {
    const prompt = loadPrompt('campaign-generation');
    const filled = prompt
      .replace('{{name}}', data.name)
      .replace('{{industry}}', data.industry || 'General')
      .replace('{{product}}', data.product || 'Our product')
      .replace('{{channel}}', data.channel)
      .replace('{{targetCount}}', String(data.targetCount || 100))
      .replace('{{stepCount}}', '3');

    const client = await getClient();
    const model = await getModel();
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: filled }],
      temperature: 0.7,
      max_tokens: 1500,
    });
    const text = res.choices[0]?.message?.content || '';
    const result = extractJson(text);

    logger.info(`Campaign sequence generated`, { name: data.name, steps: (result.steps as any[])?.length || 0 });
    return result;
  } catch (err: any) {
    logger.error('AI campaign generation failed', { error: err.message, name: data.name });
  }
}

async function enrichLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  const prompt = loadPrompt('lead-enrichment');
  const filled = prompt
    .replace('{{name}}', lead.name || 'Unknown')
    .replace('{{email}}', lead.email || 'Unknown')
    .replace('{{company}}', lead.company || 'Unknown')
    .replace('{{title}}', lead.title || 'Unknown')
    .replace('{{source}}', lead.source || 'Unknown');

  try {
    const client = await getClient();
    const model = await getModel();
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: filled }],
      temperature: 0.4,
      max_tokens: 500,
    });
    const text = res.choices[0]?.message?.content || '';
    const result = extractJson(text);

    await prisma.lead.update({ where: { id: leadId }, data: { enrichmentData: result as any } });

    const suggestedTags = (result.suggestedTags as string[]) || [];
    if (suggestedTags.length > 0) {
      const existingTags = lead.tags || [];
      const newTags = [...new Set([...existingTags, ...suggestedTags])];
      await prisma.lead.update({ where: { id: leadId }, data: { tags: newTags } });
    }

    logger.info(`Lead enriched: ${leadId}`);
  } catch (err: any) {
    logger.error('AI lead enrichment failed', { error: err.message, leadId });
  }
}

export function startAiWorker() {
  const worker = new Worker('ai-queue', async (job) => {
    logger.info(`Processing AI job ${job.id}`, { name: job.name, data: job.data });

    switch (job.name) {
      case 'analyze-intent':
        await analyzeIntent(job.data.messageId);
        break;
      case 'generate-draft':
        await generateDraft(job.data.messageId, job.data.tone);
        break;
      case 'enrich-lead':
        await enrichLead(job.data.leadId);
        break;
      case 'generate-campaign':
        await generateCampaignHandler(job.data);
        break;
      default:
        logger.warn(`Unknown AI job type: ${job.name}`);
    }
  }, { connection, concurrency: 5 });

  worker.on('completed', (job) => logger.info(`AI job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`AI job ${job?.id} failed`, { error: err.message }));

  logger.info('AI worker started');
  return worker;
}
