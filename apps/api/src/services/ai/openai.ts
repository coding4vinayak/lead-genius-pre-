import OpenAI from 'openai';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { logger } from '../../lib/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPrompt(name: string): string {
  try {
    return fs.readFileSync(path.join(__dirname, 'prompts', `${name}.txt`), 'utf-8');
  } catch {
    return '';
  }
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

function extractJson(text: string): Record<string, unknown> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }
  return {};
}

export async function analyzeIntent(leadName: string, leadCompany: string | null, subject: string | null, body: string): Promise<Record<string, unknown>> {
  const prompt = loadPrompt('intent-analysis');
  const filled = prompt
    .replace('{{leadName}}', leadName || 'Unknown')
    .replace('{{leadCompany}}', leadCompany || 'Unknown')
    .replace('{{subject}}', subject || '(no subject)')
    .replace('{{body}}', body);

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
    return extractJson(text);
  } catch (err: any) {
    logger.error('AI intent analysis failed', { error: err.message });
    return { category: 'other', sentiment: 'neutral', urgency: 'low', confidence: 0 };
  }
}

export async function generateDraft(leadName: string, leadCompany: string | null, leadMessage: string, intentCategory: string, tone: string = 'professional'): Promise<{ subject: string; body: string }> {
  const prompt = loadPrompt('draft-reply');
  const filled = prompt
    .replace('{{tone}}', tone)
    .replace('{{leadName}}', leadName || 'Valued Customer')
    .replace('{{leadCompany}}', leadCompany || 'their company')
    .replace('{{leadMessage}}', leadMessage)
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
    return { subject: (json.subject as string) || 'Re: Your message', body: (json.body as string) || '' };
  } catch (err: any) {
    logger.error('AI draft generation failed', { error: err.message });
    return { subject: 'Re: Your message', body: 'Thank you for your message. Our team will get back to you shortly.' };
  }
}

export async function enrichLead(name: string | null, email: string | null, company: string | null, title: string | null, source: string | null): Promise<Record<string, unknown>> {
  const prompt = loadPrompt('lead-enrichment');
  const filled = prompt
    .replace('{{name}}', name || 'Unknown')
    .replace('{{email}}', email || 'Unknown')
    .replace('{{company}}', company || 'Unknown')
    .replace('{{title}}', title || 'Unknown')
    .replace('{{source}}', source || 'Unknown');

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
    return extractJson(text);
  } catch (err: any) {
    logger.error('AI lead enrichment failed', { error: err.message });
    return {};
  }
}

export async function generateCampaign(name: string, industry: string | null, product: string | null, channel: string, targetCount: number): Promise<Record<string, unknown>> {
  const prompt = loadPrompt('campaign-generation');
  const filled = prompt
    .replace('{{name}}', name)
    .replace('{{industry}}', industry || 'General')
    .replace('{{product}}', product || 'Our product')
    .replace('{{channel}}', channel)
    .replace('{{targetCount}}', String(targetCount || 100))
    .replace('{{stepCount}}', '3');

  try {
    const client = await getClient();
    const model = await getModel();
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: filled }],
      temperature: 0.7,
      max_tokens: 1500,
    });
    const text = res.choices[0]?.message?.content || '';
    return extractJson(text);
  } catch (err: any) {
    logger.error('AI campaign generation failed', { error: err.message });
    return { steps: [] };
  }
}
