import { z } from 'zod';
import { LEAD_STATUS, LEAD_STAGE, CHANNEL, MESSAGE_STATUS, CAMPAIGN_STATUS, SCHEDULE_TYPE, SEND_STRATEGY, AI_PROVIDER, INTENT_CATEGORY, WARMUP_STEP } from '../types/index.js';

export const leadSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(LEAD_STATUS).default('active'),
  stage: z.enum(LEAD_STAGE).default('new'),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  customFields: z.record(z.string()).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

export const groupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
  description: z.string().optional(),
  filterRules: z.any().optional(),
});

export const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  channel: z.enum(CHANNEL),
  subject: z.string().optional(),
  body: z.string().min(1, 'Template body is required'),
  variables: z.array(z.string()).default([]),
  category: z.string().optional(),
});

export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  channel: z.enum(CHANNEL),
  templateId: z.string().min(1),
  leadGroupIds: z.array(z.string()).default([]),
  productFilter: z.string().optional(),
  scheduleType: z.enum(SCHEDULE_TYPE).default('immediate'),
  scheduledAt: z.string().datetime().optional(),
  recurringRule: z.string().optional(),
  sendStrategy: z.enum(SEND_STRATEGY).default('sequential'),
  dailyLimit: z.number().int().positive().optional(),
  minDelayMs: z.number().int().positive().optional(),
});

export const settingsSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  sendgridApiKey: z.string().optional(),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioFromNumber: z.string().optional(),
  fromEmail: z.string().optional(),
  fromName: z.string().optional(),
  dailyGlobalLimit: z.number().int().positive().optional(),
  defaultMinDelayMs: z.number().int().positive().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
}).passthrough();

export const agentSettingsSchema = z.object({
  aiProvider: z.enum(AI_PROVIDER).default('openai'),
  aiModel: z.string().default('gpt-4o-mini'),
  aiApiKey: z.string().optional(),
  aiBaseUrl: z.string().optional(),
  tone: z.string().default('professional'),
  autoReplyThreshold: z.number().int().min(0).max(100).default(70),
  isAutoPilotActive: z.boolean().default(false),
  maxDailyReplies: z.number().int().positive().default(50),
  workingHoursStart: z.string().optional(),
  workingHoursEnd: z.string().optional(),
  humanHandoffRules: z.any().optional(),
});

export const analyzeIntentSchema = z.object({
  messageId: z.string().min(1),
});

export const generateDraftSchema = z.object({
  messageId: z.string().min(1),
  tone: z.string().optional(),
});

export const enrichLeadSchema = z.object({
  leadId: z.string().min(1),
});

export const generateCampaignSchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  product: z.string().optional(),
  channel: z.enum(CHANNEL),
  targetCount: z.number().int().positive().optional(),
});

export const exportSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  status: z.enum(LEAD_STATUS).optional(),
  source: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  fields: z.array(z.string()).optional(),
});

export const warmupSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  maxActiveWarmups: z.number().int().positive().default(20),
  stepsPerDay: z.number().int().positive().max(10).default(2),
  minDelayHours: z.number().int().positive().default(12),
  maxDelayHours: z.number().int().positive().default(48),
  workingHoursStart: z.string().default('09:00'),
  workingHoursEnd: z.string().default('18:00'),
  timezone: z.string().default('UTC'),
  steps: z.array(z.enum(WARMUP_STEP)).default([...WARMUP_STEP]),
});

export const linkedinImportSchema = z.object({
  searchUrl: z.string().optional(),
  keywords: z.string().optional(),
  location: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  maxLeads: z.number().int().positive().max(100).default(25),
  groupId: z.string().optional(),
});

export const websiteImportSchema = z.object({
  url: z.string().url(),
  selector: z.string().optional(),
  maxLeads: z.number().int().positive().max(100).default(25),
  groupId: z.string().optional(),
});

export const webhookLeadSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  source: z.string().default('webhook'),
  linkedinUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.string()).optional(),
});

export const warmupStartSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(500),
});

export type WarmupSettingsInput = z.infer<typeof warmupSettingsSchema>;
export type LinkedinImportInput = z.infer<typeof linkedinImportSchema>;
export type WebsiteImportInput = z.infer<typeof websiteImportSchema>;
export type WebhookLeadInput = z.infer<typeof webhookLeadSchema>;
export type WarmupStartInput = z.infer<typeof warmupStartSchema>;

export type AgentSettingsInput = z.infer<typeof agentSettingsSchema>;
export type LeadInput = z.infer<typeof leadSchema>;
export type GroupInput = z.infer<typeof groupSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
