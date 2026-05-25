import { z } from 'zod';
import { LEAD_STATUS, CHANNEL, MESSAGE_STATUS, CAMPAIGN_STATUS, SCHEDULE_TYPE, SEND_STRATEGY, AI_PROVIDER, INTENT_CATEGORY, AUTOMATION_STATUS, AUTOMATION_TRIGGER_TYPE, AUTOMATION_STEP_TYPE, AUTOMATION_EXECUTION_STATUS, WEBHOOK_EVENT, INTEGRATION_TYPE, TASK_STATUS, TASK_PRIORITY, SEQUENCE_STATUS, SEQUENCE_STEP_TYPE, SEQUENCE_ENROLLMENT_STATUS, LEAD_STAGE, CHANNEL_HEALTH_STATUS, WHATSAPP_TEMPLATE_STATUS, WHATSAPP_TEMPLATE_CATEGORY, DOMAIN_AUTH_STATUS, EMAIL_VERIFICATION_STATUS, SUPPRESSION_REASON, GDPR_CONSENT_TYPE, WARMUP_STATUS, ROTATION_STRATEGY, TRACKING_DOMAIN_STATUS } from '../types';

export const leadSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(LEAD_STATUS).default('active'),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.string()).optional(),
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
  physicalAddress: z.string().optional(),
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

export type AgentSettingsInput = z.infer<typeof agentSettingsSchema>;
export type LeadInput = z.infer<typeof leadSchema>;
export type GroupInput = z.infer<typeof groupSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;

export const automationSchema = z.object({
  name: z.string().min(1, 'Automation name is required'),
  description: z.string().optional(),
  triggerType: z.enum(AUTOMATION_TRIGGER_TYPE),
  triggerConfig: z.record(z.unknown()).default({}),
  status: z.enum(AUTOMATION_STATUS).default('draft'),
  isActive: z.boolean().default(false),
});

export const automationStepSchema = z.object({
  type: z.enum(AUTOMATION_STEP_TYPE),
  config: z.record(z.unknown()).default({}),
  position: z.number().int().min(0),
  nextStepId: z.string().optional(),
  conditionTrueStepId: z.string().optional(),
  conditionFalseStepId: z.string().optional(),
});

export const webhookSubscriptionSchema = z.object({
  name: z.string().min(1, 'Webhook name is required'),
  url: z.string().url('Valid URL is required'),
  events: z.array(z.enum(WEBHOOK_EVENT)).min(1, 'At least one event is required'),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export const integrationSchema = z.object({
  type: z.enum(INTEGRATION_TYPE),
  name: z.string().min(1, 'Integration name is required'),
  config: z.record(z.unknown()).default({}),
  credentials: z.record(z.unknown()).optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(TASK_STATUS).default('pending'),
  priority: z.enum(TASK_PRIORITY).default('medium'),
  dueDate: z.string().datetime().optional(),
  automationId: z.string().optional(),
});

export const inboundWebhookSchema = z.object({
  name: z.string().min(1, 'Inbound webhook name is required'),
  description: z.string().optional(),
  secret: z.string().optional(),
});

export type AutomationInput = z.infer<typeof automationSchema>;
export type AutomationStepInput = z.infer<typeof automationStepSchema>;
export type WebhookSubscriptionInput = z.infer<typeof webhookSubscriptionSchema>;
export type IntegrationInput = z.infer<typeof integrationSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type InboundWebhookInput = z.infer<typeof inboundWebhookSchema>;

export const sequenceSchema = z.object({
  name: z.string().min(1, 'Sequence name is required'),
  description: z.string().optional(),
  status: z.enum(SEQUENCE_STATUS).default('draft'),
  leadGroupIds: z.array(z.string()).default([]),
  triggerType: z.enum(['manual', 'on_lead_created', 'on_tag_added'] as const).default('manual'),
  triggerConfig: z.record(z.unknown()).default({}),
  pauseOnReply: z.boolean().default(true),
  sendingWindowStart: z.string().optional(),
  sendingWindowEnd: z.string().optional(),
  dailyLimit: z.number().int().positive().optional(),
  timezone: z.string().default('UTC'),
});

export const sequenceStepSchema = z.object({
  position: z.number().int().min(0),
  type: z.enum(SEQUENCE_STEP_TYPE),
  config: z.record(z.unknown()).default({}),
  nextStepId: z.string().optional(),
  conditionTrueStepId: z.string().optional(),
  conditionFalseStepId: z.string().optional(),
});

export type SequenceInput = z.infer<typeof sequenceSchema>;
export type SequenceStepInput = z.infer<typeof sequenceStepSchema>;

export const whatsAppTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  language: z.string().default('en'),
  category: z.enum(WHATSAPP_TEMPLATE_CATEGORY).default('marketing'),
  body: z.string().min(1, 'Template body is required'),
  headerType: z.enum(['text', 'image', 'document'] as const).optional(),
  headerContent: z.string().optional(),
  footerText: z.string().optional(),
  buttons: z.any().optional(),
  twilioTemplateSid: z.string().optional(),
});

export const emailDomainAuthSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  spfStatus: z.enum(DOMAIN_AUTH_STATUS).default('pending'),
  dkimStatus: z.enum(DOMAIN_AUTH_STATUS).default('pending'),
  dmarcStatus: z.enum(DOMAIN_AUTH_STATUS).default('pending'),
});

export type WhatsAppTemplateInput = z.infer<typeof whatsAppTemplateSchema>;
export type EmailDomainAuthInput = z.infer<typeof emailDomainAuthSchema>;

export const emailVerificationSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const bulkEmailVerificationSchema = z.object({
  emails: z.array(z.string().email()).min(1, 'At least one email is required'),
});

export const suppressionEntrySchema = z.object({
  email: z.string().email('Valid email is required'),
  reason: z.enum(SUPPRESSION_REASON),
  source: z.string().optional(),
  campaignId: z.string().optional(),
});

export const suppressionImportSchema = z.object({
  entries: z.array(z.object({
    email: z.string().email(),
    reason: z.enum(SUPPRESSION_REASON),
    source: z.string().optional(),
  })).min(1, 'At least one entry is required'),
});

export const unsubscribeSchema = z.object({
  reason: z.string().optional(),
});

export const gdprConsentSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  consentType: z.enum(GDPR_CONSENT_TYPE),
  source: z.string().optional(),
});

export const complianceSettingsSchema = z.object({
  physicalAddress: z.string().min(1, 'Physical address is required for CAN-SPAM compliance'),
});

export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;
export type SuppressionEntryInput = z.infer<typeof suppressionEntrySchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
export type GdprConsentInput = z.infer<typeof gdprConsentSchema>;
export type ComplianceSettingsInput = z.infer<typeof complianceSettingsSchema>;

export const warmupScheduleSchema = z.object({
  accountEmail: z.string().email('Valid email is required'),
  maxDailyLimit: z.number().int().positive().default(50),
  rampPercentage: z.number().min(1).max(100).default(20),
  bounceThreshold: z.number().min(0).max(100).default(5),
});

export const warmupScheduleUpdateSchema = z.object({
  maxDailyLimit: z.number().int().positive().optional(),
  rampPercentage: z.number().min(1).max(100).optional(),
  bounceThreshold: z.number().min(0).max(100).optional(),
});

export type WarmupScheduleInput = z.infer<typeof warmupScheduleSchema>;
export type WarmupScheduleUpdateInput = z.infer<typeof warmupScheduleUpdateSchema>;

export const emailAccountSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  sendgridApiKey: z.string().optional(),
  dailyLimit: z.number().int().positive().default(100),
  isActive: z.boolean().default(true),
});

export const emailAccountUpdateSchema = z.object({
  name: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  sendgridApiKey: z.string().optional(),
  dailyLimit: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const trackingDomainSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  cnameTarget: z.string().min(1, 'CNAME target is required'),
  isDefault: z.boolean().default(false),
});

export const accountRotationConfigSchema = z.object({
  strategy: z.enum(ROTATION_STRATEGY).default('round_robin'),
  weights: z.record(z.number()).optional(),
  skipOnDailyLimit: z.boolean().default(true),
  skipOnHighBounce: z.boolean().default(true),
  bounceThreshold: z.number().min(0).max(100).default(10),
});

export type EmailAccountInput = z.infer<typeof emailAccountSchema>;
export type EmailAccountUpdateInput = z.infer<typeof emailAccountUpdateSchema>;
export type TrackingDomainInput = z.infer<typeof trackingDomainSchema>;
export type AccountRotationConfigInput = z.infer<typeof accountRotationConfigSchema>;
