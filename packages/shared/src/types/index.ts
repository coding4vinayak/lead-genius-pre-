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
