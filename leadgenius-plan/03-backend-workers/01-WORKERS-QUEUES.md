# BACKEND WORKERS & QUEUES - LeadGenius
## Complete Worker Architecture with BullMQ

================================================================================
## 1. QUEUE ARCHITECTURE OVERVIEW
================================================================================

Redis (BullMQ) -> 5 Queues + 1 Scheduler

Queue Name            | Purpose                       | Concurrency | Retries
----------------------|-------------------------------|-------------|--------
campaign-queue        | Send campaign messages        | 10          | 3
ai-queue              | AI generation tasks           | 5           | 2
webhook-queue         | Process inbound messages      | 15          | 3
enrichment-queue      | Lead enrichment                | 5           | 2
billing-queue         | Usage tracking & billing       | 3           | 3

================================================================================
## 2. QUEUE DEFINITIONS
================================================================================

### 2.1 Campaign Queue (campaign-queue)

JOBS:
  send_campaign_message
    Input: { campaignId, leadId, stepIndex }
    Process: 
      1. Get lead + campaign from DB
      2. Get sequence step config
      3. Build message content (template substitution)
      4. Send via channel (email/SendGrid or WhatsApp/Twilio)
      5. Create outbound message record
      6. Update lead (current_step, next_action_at, status)
      7. Log activity
    Retry: 3 times with exponential backoff (1min, 5min, 15min)
    Concurrency: 10

  pause_campaign
    Input: { campaignId }
    Process:
      1. Update campaign status to 'paused'
      2. Remove all scheduled jobs for this campaign
      3. Log activity

  resume_campaign
    Input: { campaignId }
    Process:
      1. Update campaign status to 'active'
      2. Reschedule all eligible leads
      3. Log activity

### 2.2 AI Queue (ai-queue)

JOBS:
  analyze_intent
    Input: { leadId, messageId }
    Process:
      1. Get lead messages (context: last 10)
      2. Build prompt with lead info + message history
      3. Call Gemini analyzeIntent
      4. Parse response: { level, reasoning }
      5. Update lead.intent_analysis
      6. Generate draft reply if threshold met
      7. Update message with intent + draft
      8. If HIGH intent: flag for human handoff
    Retry: 2 times
    Concurrency: 5

  generate_draft
    Input: { leadId, messageId }
    Process:
      1. Get lead info + campaign context + message
      2. Get agent_settings (tone, etc.)
      3. Build prompt
      4. Call Gemini generateDraft
      5. Update message.draft_reply
    Retry: 2 times
    Concurrency: 5

  enrich_lead
    Input: { leadId }
    Process:
      1. Get lead (name, company)
      2. Call Gemini enrichLead
      3. Parse response: { company_description, icebreaker }
      4. Update lead.enrichment_data
      5. Update lead.score
    Retry: 2 times
    Concurrency: 5

  generate_campaign
    Input: { product, industry, occasion }
    Process:
      1. Build prompt with product details
      2. Call Gemini generateCampaign
      3. Parse response: sequence steps array
      4. Return structured campaign config
    Retry: 2 times
    Concurrency: 3

### 2.3 Webhook Queue (webhook-queue)

JOBS:
  process_inbound_email
    Input: { sendgridPayload }
    Process:
      1. Parse SendGrid inbound parse webhook
      2. Extract from/to/subject/body
      3. Find lead by email
      4. Create inbound message record
      5. Queue AI intent analysis
      6. Log activity

  process_inbound_whatsapp
    Input: { twilioPayload }
    Process:
      1. Parse Twilio webhook
      2. Extract from/body
      3. Find lead by phone
      4. Create inbound message record
      5. Queue AI intent analysis
      6. Log activity

  process_stripe_webhook
    Input: { stripeEvent }
    Process:
      1. Verify Stripe signature
      2. Handle events:
         - invoice.payment_succeeded
         - invoice.payment_failed
         - customer.subscription.updated
         - customer.subscription.deleted
      3. Update workspace/subscription status
      4. Log billing activity

### 2.4 Enrichment Queue (enrichment-queue)

JOBS:
  enrich_single_lead (same as ai-queue enrich_lead)
  bulk_enrich
    Input: { workspaceId, leadIds[] }
    Process:
      1. For each lead, queue enrich_single_lead
      2. Track progress
      3. Notify on completion

### 2.5 Billing Queue (billing-queue)

JOBS:
  record_usage
    Input: { workspaceId, metric, quantity, metadata }
    Process:
      1. Insert into usage_records
      2. Check if needs Stripe meter report
      3. If yes, report to Stripe

  report_usage_to_stripe
    Input: { workspaceId, periodStart, periodEnd }
    Process:
      1. Aggregate usage for period
      2. Create Stripe meter events
      3. Update usage_records with stripe_event_id

  check_subscription_limits
    Input: { workspaceId }
    Process:
      1. Check current usage vs plan limits
      2. If exceeded, send warning notification
      3. If critically exceeded, throttle API

================================================================================
## 3. CRON JOB SCHEDULES
================================================================================

Every 5 minutes:
  campaign_scheduler
    - Query leads WHERE next_action_at <= NOW() AND status IN ('new','contacted')
    - For each: queue send_campaign_message

Every 15 minutes:
  auto_pilot_check
    - Query messages WHERE draft_reply IS NOT NULL AND is_read = false
    - Check agent_settings.is_auto_pilot_active
    - Check intent threshold
    - Auto-send or flag for human

Every hour:
  usage_aggregator
    - Aggregate usage for each workspace for current billing period
    - Report to Stripe metered billing

Every day at midnight:
  daily_cleanup
    - Archive old activity_logs ( > 90 days)
    - Clean up expired API keys
    - Send daily digest emails
    - Reset daily counters

Every Sunday:
  weekly_report_generation
    - Generate weekly analytics for each workspace
    - Send weekly report email

================================================================================
## 4. WORKER IMPLEMENTATION
================================================================================

// File: src/workers/campaignWorker.ts

import { Worker, Job } from 'bullmq';
import { sendEmail } from '../services/email';
import { sendWhatsApp } from '../services/whatsapp';
import { updateLead, getLead } from '../db/leads';
import { getCampaign } from '../db/campaigns';
import { createMessage } from '../db/messages';
import { logActivity } from '../db/activityLogs';
import { redisConnection } from '../config/redis';

const campaignWorker = new Worker('campaign-queue', async (job: Job) => {
  const { type, data } = job;

  switch (type) {
    case 'send_campaign_message':
      return handleSendCampaignMessage(data);
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}, {
  connection: redisConnection,
  concurrency: 10,
  limiter: {
    max: 50,      // max jobs per
    duration: 1000 // per second
  }
});

async function handleSendCampaignMessage(data: {
  campaignId: string;
  leadId: string;
  stepIndex: number;
}) {
  const { campaignId, leadId, stepIndex } = data;

  // 1. Get lead and campaign
  const [lead, campaign] = await Promise.all([
    getLead(leadId),
    getCampaign(campaignId)
  ]);

  if (!lead || !campaign || campaign.status !== 'active') {
    return { skipped: true, reason: 'Campaign not active or lead not found' };
  }

  // 2. Get sequence step
  const step = campaign.sequence_config[stepIndex];
  if (!step) {
    return { skipped: true, reason: 'Step not found' };
  }

  // 3. Build message content (template substitution)
  const body = step.body
    .replace('{{lead_name}}', lead.name)
    .replace('{{company}}', lead.company || '')
    .replace('{{product}}', campaign.product || '');

  // 4. Send via channel
  let providerMessageId: string | null = null;
  let status = 'sent';

  try {
    if (step.channel === 'email') {
      const result = await sendEmail({
        to: lead.email,
        subject: step.subject,
        body,
        campaignId,
        leadId
      });
      providerMessageId = result.messageId;
    } else if (step.channel === 'whatsapp') {
      const result = await sendWhatsApp({
        to: lead.phone,
        body,
        campaignId,
        leadId
      });
      providerMessageId = result.sid;
    }
  } catch (error) {
    status = 'failed';
    // Log error, will be retried by BullMQ
    throw error;
  }

  // 5. Create message record
  const message = await createMessage({
    workspaceId: lead.workspace_id,
    leadId: lead.id,
    campaignId: campaign.id,
    content: body,
    subject: step.subject || null,
    direction: 'outbound',
    channel: step.channel,
    status,
    providerMessageId,
    isAiGenerated: false,
    sentAt: new Date()
  });

  // 6. Update lead
  const nextStep = stepIndex + 1;
  const hasMoreSteps = nextStep < campaign.sequence_config.length;
  const nextStepConfig = hasMoreSteps ? campaign.sequence_config[nextStep] : null;

  await updateLead(leadId, {
    currentStep: nextStep,
    status: 'contacted',
    nextActionAt: nextStepConfig
      ? new Date(Date.now() + nextStepConfig.delay_hours * 3600000)
      : null,
    lastContactedAt: new Date()
  });

  // 7. Log activity
  await logActivity({
    workspaceId: lead.workspace_id,
    leadId: lead.id,
    campaignId: campaign.id,
    eventType: 'message_sent',
    severity: 'info',
    title: `Message sent via ${step.channel}`,
    description: `Step ${stepIndex + 1}/${campaign.sequence_config.length} sent to ${lead.name}`,
    metadata: { channel: step.channel, messageId: message.id, stepIndex }
  });

  return { sent: true, messageId: message.id, nextStep };
}

export { campaignWorker };

================================================================================
## 5. ERROR HANDLING & RETRY LOGIC
================================================================================

BullMQ Retry Strategy:
  - Default attempts: 3
  - Backoff: exponential (1min, 5min, 15min)
  - Dead letter queue after max retries
  - Manual re-queue from admin panel

Error Categories:
  1. Transient (network timeout, rate limit): Retry
  2. Provider error (Twilio/SendGrid down): Retry with backoff
  3. Data error (lead not found, invalid phone): Skip + log
  4. AI error (Gemini timeout, bad response): Retry once, then skip

Monitoring:
  - BullMQ dashboard for queue visualization
  - Winston logging to files + Grafana Loki
  - Error rate alerts (PagerDuty if >5% error rate in 5min)
  - Stalled job alerts

================================================================================
## 6. QUEUE PRIORITY & JOB WEIGHTING
================================================================================

Priority Levels:
  1 = Critical (webhook processing, billing)
  2 = High (AI intent analysis, auto-reply)
  3 = Normal (campaign messages)
  4 = Low (enrichment, historical analysis)

Each queue has a weight:
  webhook-queue: 40%
  ai-queue: 30%
  campaign-queue: 20%
  enrichment-queue: 5%
  billing-queue: 5%

================================================================================
## 7. SCRIPT: workers/index.ts (Main Entry)
================================================================================

import { campaignWorker } from './campaignWorker';
import { aiWorker } from './aiWorker';
import { webhookWorker } from './webhookWorker';
import { enrichmentWorker } from './enrichmentWorker';
import { billingWorker } from './billingWorker';
import { startCronJobs } from './cron';

console.log('[Workers] Starting all workers...');

const workers = [
  campaignWorker,
  aiWorker,
  webhookWorker,
  enrichmentWorker,
  billingWorker
];

workers.forEach(w => {
  w.on('completed', (job) => {
    console.log(`[${w.name}] Job ${job.id} completed`);
  });
  w.on('failed', (job, err) => {
    console.error(`[${w.name}] Job ${job.id} failed:`, err.message);
  });
});

startCronJobs();

process.on('SIGTERM', async () => {
  console.log('[Workers] Shutting down...');
  await Promise.all(workers.map(w => w.close()));
  process.exit(0);
});
