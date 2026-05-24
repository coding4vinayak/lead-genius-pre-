export const LEAD_STATUS = ['active', 'unsubscribed', 'bounced', 'invalid'] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const CHANNEL = ['email', 'whatsapp'] as const;
export type Channel = (typeof CHANNEL)[number];

export const DIRECTION = ['outbound', 'inbound'] as const;
export type Direction = (typeof DIRECTION)[number];

export const MESSAGE_STATUS = ['queued', 'sent', 'delivered', 'failed', 'bounced', 'replied'] as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[number];

export const CAMPAIGN_STATUS = ['draft', 'scheduled', 'running', 'paused', 'completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[number];

export const SCHEDULE_TYPE = ['immediate', 'scheduled', 'recurring'] as const;
export type ScheduleType = (typeof SCHEDULE_TYPE)[number];

export const SEND_STRATEGY = ['sequential', 'batch', 'burst'] as const;
export type SendStrategy = (typeof SEND_STRATEGY)[number];

export const AI_PROVIDER = ['openai', 'gemini', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDER)[number];

export const INTENT_CATEGORY = ['interested', 'not_interested', 'out_of_office', 'meeting_request', 'pricing_question', 'feature_question', 'competitor_mention', 'spam', 'other'] as const;
export type IntentCategory = (typeof INTENT_CATEGORY)[number];

export const AUTOMATION_STATUS = ['active', 'inactive', 'draft'] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUS)[number];

export const AUTOMATION_TRIGGER_TYPE = ['lead.created', 'lead.updated', 'lead.field_changed', 'lead.tag_added', 'lead.tag_removed', 'lead.score_threshold', 'message.received', 'message.sent', 'message.bounced', 'campaign.activated', 'campaign.paused', 'campaign.completed', 'webhook.received', 'cron', 'manual'] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPE)[number];

export const AUTOMATION_STEP_TYPE = ['send_message', 'update_lead_field', 'add_tag', 'remove_tag', 'move_to_group', 'remove_from_group', 'pause_campaign', 'send_webhook', 'delay', 'condition', 'create_task'] as const;
export type AutomationStepType = (typeof AUTOMATION_STEP_TYPE)[number];

export const AUTOMATION_EXECUTION_STATUS = ['running', 'completed', 'failed', 'cancelled'] as const;
export type AutomationExecutionStatus = (typeof AUTOMATION_EXECUTION_STATUS)[number];

export const WEBHOOK_STATUS = ['active', 'inactive'] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUS)[number];

export const WEBHOOK_EVENT = ['lead.created', 'lead.updated', 'lead.field_changed', 'lead.tag_added', 'lead.tag_removed', 'lead.score_threshold', 'message.received', 'message.sent', 'message.bounced', 'campaign.activated', 'campaign.paused', 'campaign.completed', 'webhook.received', 'cron', 'manual', 'automation.completed', 'task.created', 'task.completed'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENT)[number];

export const INTEGRATION_TYPE = ['slack', 'hubspot', 'salesforce', 'zapier', 'n8n', 'custom'] as const;
export type IntegrationType = (typeof INTEGRATION_TYPE)[number];

export const TASK_STATUS = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITY)[number];

export const SEQUENCE_STATUS = ['draft', 'active', 'paused', 'completed'] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUS)[number];

export const SEQUENCE_STEP_TYPE = ['send_email', 'send_whatsapp', 'delay', 'condition', 'update_lead_stage', 'update_lead_score'] as const;
export type SequenceStepType = (typeof SEQUENCE_STEP_TYPE)[number];

export const SEQUENCE_ENROLLMENT_STATUS = ['active', 'paused', 'completed', 'exited'] as const;
export type SequenceEnrollmentStatus = (typeof SEQUENCE_ENROLLMENT_STATUS)[number];

export const LEAD_STAGE = ['new', 'contacted', 'engaged', 'warm', 'hot', 'converted', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGE)[number];

export const CHANNEL_HEALTH_STATUS = ['healthy', 'degraded', 'down'] as const;
export type ChannelHealthStatus = (typeof CHANNEL_HEALTH_STATUS)[number];

export const WHATSAPP_TEMPLATE_STATUS = ['pending', 'approved', 'rejected'] as const;
export type WhatsAppTemplateStatus = (typeof WHATSAPP_TEMPLATE_STATUS)[number];

export const WHATSAPP_TEMPLATE_CATEGORY = ['marketing', 'utility', 'authentication'] as const;
export type WhatsAppTemplateCategory = (typeof WHATSAPP_TEMPLATE_CATEGORY)[number];

export const DOMAIN_AUTH_STATUS = ['verified', 'pending', 'failed'] as const;
export type DomainAuthStatus = (typeof DOMAIN_AUTH_STATUS)[number];

export const REVIEW_STATUS = ['pending_review', 'approved', 'rejected', 'auto_sent'] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];
