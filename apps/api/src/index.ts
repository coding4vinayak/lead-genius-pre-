import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { prisma } from './db.js';
import { errorHandler } from './middleware/error-handler.js';
import { requireAuth } from './middleware/auth.js';
import { logger } from './lib/logger.js';
import { correlationIdMiddleware } from './middleware/correlation-id.js';
import { requestTimingMiddleware } from './middleware/request-timing.js';
import healthRoutes, { setShuttingDown } from './routes/health.js';
import { createCampaignWorker, createSendWorker, createAiWorker, createEventWorker, createAutomationWorker, createWebhookWorker, createSequenceWorker, campaignQueue, sendQueue } from './queue/index.js';

import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import groupRoutes from './routes/groups.js';
import templateRoutes from './routes/templates.js';
import campaignRoutes from './routes/campaigns.js';
import messageRoutes from './routes/messages.js';
import analyticsRoutes from './routes/analytics.js';
import settingsRoutes from './routes/settings.js';
import webhookRoutes from './routes/webhooks.js';
import aiRoutes from './routes/ai.js';
import inboxRoutes from './routes/inbox.js';
import agentRoutes from './routes/agent.js';
import automationRoutes from './routes/automations.js';
import webhookSubscriptionRoutes from './routes/webhook-subscriptions.js';
import inboundWebhookRoutes from './routes/inbound-webhooks.js';
import hooksRoutes from './routes/hooks.js';
import integrationRoutes from './routes/integrations.js';
import taskRoutes from './routes/tasks.js';
import eventRoutes from './routes/events.js';
import sequenceRoutes from './routes/sequences.js';
import channelHealthRoutes from './routes/channel-health.js';
import whatsappTemplateRoutes from './routes/whatsapp-templates.js';
import emailVerificationRoutes from './routes/email-verification.js';
import suppressionRoutes from './routes/suppression.js';
import complianceRoutes from './routes/compliance.js';
import warmupRoutes from './routes/warmup.js';
import emailAccountRoutes from './routes/email-accounts.js';
import trackingDomainRoutes from './routes/tracking-domains.js';
import reputationRoutes from './routes/reputation.js';
import workspaceRoutes from './routes/workspaces.js';
import billingRoutes from './routes/billing.js';
import crmRoutes from './routes/crm.js';
import calendarRoutes from './routes/calendar.js';
import slackRoutes from './routes/slack.js';
import marketplaceRoutes from './routes/marketplace.js';
import abTestRoutes from './routes/ab-tests.js';
import sendOptimizationRoutes from './routes/send-optimization.js';
import advancedAnalyticsRoutes from './routes/advanced-analytics.js';
import benchmarkRoutes from './routes/benchmarks.js';
import notificationRoutes from './routes/notifications.js';
import enrichmentRoutes from './routes/enrichment.js';
import docsRoutes from './routes/docs.js';
import apiKeyRoutes from './routes/api-keys.js';
import linkedinRoutes from './routes/linkedin.js';
import collaborationRoutes from './routes/collaboration.js';
import { apiKeyAuth } from './middleware/api-key-auth.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { sendEmail } from './services/email.js';
import { sendWhatsApp } from './services/whatsapp.js';
import { renderTemplate } from './services/template.js';
import { prisma as db } from './db.js';
import { getRouter as getSandboxRouter } from './services/email-sandbox.js';
import { startSmtpServer, stopSmtpServer } from './services/smtp-server.js';
import { createEtherealAccount } from './services/external-email-test.js';
import { initWebSocket } from './services/websocket.js';
import { subscribeToEvent } from './services/event-bus.js';
import { createNotification } from './services/notification.js';
import type { Server } from 'node:http';

const app = express();

// Core middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(correlationIdMiddleware);
app.use(requestTimingMiddleware);
app.use(apiKeyAuth);
app.use(rateLimiter);

// Health routes (no auth required)
app.use('/', healthRoutes);

app.use('/api/docs', docsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/hooks', hooksRoutes);
app.use('/api/api-keys', requireAuth, apiKeyRoutes);
app.use('/api/leads', requireAuth, leadRoutes);
app.use('/api/groups', requireAuth, groupRoutes);
app.use('/api/templates', requireAuth, templateRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/messages', requireAuth, messageRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes);
app.use('/api/agent', requireAuth, agentRoutes);
app.use('/api/automations', requireAuth, automationRoutes);
app.use('/api/webhook-subscriptions', requireAuth, webhookSubscriptionRoutes);
app.use('/api/inbound-webhooks', requireAuth, inboundWebhookRoutes);
app.use('/api/integrations', requireAuth, integrationRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/events', requireAuth, eventRoutes);
app.use('/api/sequences', requireAuth, sequenceRoutes);
app.use('/api/channel-health', requireAuth, channelHealthRoutes);
app.use('/api/whatsapp-templates', requireAuth, whatsappTemplateRoutes);
app.use('/api/email-verification', requireAuth, emailVerificationRoutes);
app.use('/api/suppression', requireAuth, suppressionRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/warmup', requireAuth, warmupRoutes);
app.use('/api/email-accounts', requireAuth, emailAccountRoutes);
app.use('/api/tracking-domains', requireAuth, trackingDomainRoutes);
app.use('/api/reputation', requireAuth, reputationRoutes);
app.use('/api/workspaces', requireAuth, workspaceRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/crm', requireAuth, crmRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/slack', requireAuth, slackRoutes);
app.use('/api/marketplace', requireAuth, marketplaceRoutes);
app.use('/api/ab-tests', requireAuth, abTestRoutes);
app.use('/api/send-optimization', requireAuth, sendOptimizationRoutes);
app.use('/api/analytics/advanced', requireAuth, advancedAnalyticsRoutes);
app.use('/api/benchmarks', requireAuth, benchmarkRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api', requireAuth, enrichmentRoutes);
app.use('/api/linkedin', requireAuth, linkedinRoutes);
app.use('/api', requireAuth, collaborationRoutes);
app.use('/webhook', webhookRoutes);

if (process.env.EMAIL_SANDBOX !== 'false') {
  app.use('/api/sandbox', getSandboxRouter());
}

app.use(errorHandler);

let server: Server | undefined;
const workers: Array<{ close: () => Promise<void> }> = [];

async function shutdown() {
  logger.info('Shutting down gracefully...');
  setShuttingDown(true);

  // Stop accepting new connections
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
      // Timeout for in-flight requests
      setTimeout(() => resolve(), 30000);
    });
  }

  // Close BullMQ workers
  for (const worker of workers) {
    try {
      await worker.close();
    } catch {
      // ignore worker close errors during shutdown
    }
  }

  // Stop SMTP server
  await stopSmtpServer().catch(() => {});

  // Disconnect Prisma
  await prisma.$disconnect().catch(() => {});

  logger.info('Shutdown complete');
  process.exit(0);
}

async function start() {
  await prisma.$connect();
  logger.info('Database connected');

  if (process.env.EMAIL_SANDBOX !== 'false') {
    const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT || '1025', 10);
    await startSmtpServer(smtpPort).catch((err) => logger.warn('SMTP server not started', { error: err.message }));

    if (process.env.ETHEREAL_ENABLED === 'true') {
      await createEtherealAccount().catch((err) => logger.warn('Ethereal account not created', { error: err.message }));
    }
  }

  const campaignWorker = await createCampaignWorker(async (job) => {
    const { campaignId } = job.data;
    logger.info(`Executing campaign ${campaignId}`);

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { template: true },
    });
    if (!campaign || campaign.status === 'paused' || campaign.status === 'completed') return;

    if (campaign.status === 'scheduled') {
      await db.campaign.update({ where: { id: campaignId }, data: { status: 'running' } });
    }

    const settings = await db.settings.findUnique({ where: { id: 'global' } });
    const globalLimit = settings?.dailyGlobalLimit || 1000;
    const minDelayMs = campaign.minDelayMs || settings?.defaultMinDelayMs || 30000;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const sentToday = await db.message.count({
      where: { campaignId, createdAt: { gte: todayStart } },
    });

    const dailyLimit = Math.min(campaign.dailyLimit || globalLimit, globalLimit);
    const remaining = dailyLimit - sentToday;
    if (remaining <= 0) {
      logger.info(`Campaign ${campaignId} hit daily limit`);
      return;
    }

    const groupMembers = await db.groupMember.findMany({
      where: { groupId: { in: campaign.leadGroupIds } },
      include: { lead: true },
    });

    const existingSent = await db.message.findMany({
      where: { campaignId },
      select: { leadId: true },
    });
    const sentLeadIds = new Set(existingSent.map((m) => m.leadId));

    let queued = 0;
    for (const member of groupMembers) {
      if (queued >= remaining) break;
      if (sentLeadIds.has(member.leadId)) continue;

      const lead = member.lead;
      const rendered = await renderTemplate(campaign.templateId, {
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        title: lead.title || '',
      });

      const msg = await db.message.create({
        data: {
          campaignId,
          leadId: lead.id,
          channel: campaign.channel,
          direction: 'outbound',
          subject: rendered.subject,
          body: rendered.body,
          status: 'queued',
        },
      });

      const to = campaign.channel === 'email' ? lead.email! : lead.phone!;
      if (to) {
        await sendQueue.add('send-message', {
          messageId: msg.id,
          channel: campaign.channel,
          to,
          subject: rendered.subject,
          body: rendered.body,
        }, { delay: queued * minDelayMs });
        queued++;
      }
    }

    await db.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: queued } } });
    logger.info(`Campaign ${campaignId}: queued ${queued} messages`);
  });
  if (campaignWorker) workers.push(campaignWorker);

  const sendWorker = await createSendWorker(async (job) => {
    const { messageId, channel, to, subject, body } = job.data;
    if (channel === 'email') await sendEmail(to, subject || '', body, messageId);
    else if (channel === 'whatsapp') await sendWhatsApp(to, body, messageId);
  });
  if (sendWorker) workers.push(sendWorker);

  const aiWorker = await createAiWorker(async (job) => {
    const { name, data } = job;
    const { analyzeMessageIntent, generateReplyDraft, enrichLeadData, generateCampaignSequence } = await import('./services/ai/index.js');

    if (name === 'analyze-intent') {
      await analyzeMessageIntent(data.messageId);
    } else if (name === 'generate-draft') {
      await generateReplyDraft(data.messageId, data.tone);
    } else if (name === 'enrich-lead') {
      await enrichLeadData(data.leadId);
    } else if (name === 'generate-campaign') {
      await generateCampaignSequence(data.name, data.industry, data.product, data.channel, data.targetCount);
    }
  });
  if (aiWorker) workers.push(aiWorker);

  const automationWorker = await createAutomationWorker(async (job) => {
    const { processAutomationStep } = await import('./services/automation-engine.js');
    const { executionId, stepId, payload } = job.data;
    await processAutomationStep(executionId, stepId, payload);
  });
  if (automationWorker) workers.push(automationWorker);

  const eventWorker = await createEventWorker(async (job) => {
    const { executeAutomation } = await import('./services/automation-engine.js');
    const { type, payload } = job.data;
    const automations = await db.automation.findMany({
      where: { isActive: true, triggerType: type },
    });
    await Promise.all(
      automations.map((automation) => executeAutomation(automation.id, payload || {}))
    );

    // Dispatch to outbound webhook subscriptions
    const { createDelivery } = await import('./services/webhook-delivery.js');
    const webhooks = await db.webhookSubscription.findMany({
      where: { isActive: true },
    });
    await Promise.all(
      webhooks
        .filter((webhook) => {
          const events = webhook.events as string[];
          return events.includes(type);
        })
        .map((webhook) => createDelivery(webhook.id, type, payload || {}))
    );
  });
  if (eventWorker) workers.push(eventWorker);

  const webhookWorker = await createWebhookWorker(async (job) => {
    const { deliverWebhook } = await import('./services/webhook-delivery.js');
    const { deliveryId } = job.data;
    await deliverWebhook(deliveryId);
  });
  if (webhookWorker) workers.push(webhookWorker);

  const sequenceWorker = await createSequenceWorker(async (job) => {
    const { processSequenceStep } = await import('./services/sequence-engine.js');
    const { enrollmentId } = job.data;
    await processSequenceStep(enrollmentId);
  });
  if (sequenceWorker) workers.push(sequenceWorker);

  // Sequence ticker - runs every 60 seconds
  setInterval(async () => {
    try {
      const { tickSequences } = await import('./services/sequence-engine.js');
      await tickSequences();
    } catch (err) {
      logger.error('Sequence tick failed', { error: (err as Error).message });
    }
  }, 60_000);

  // Subscribe to events for real-time notifications
  subscribeToEvent('message.received', async (data) => {
    const msg = data.payload as Record<string, unknown>;
    if (msg.userId && typeof msg.userId === 'string') {
      await createNotification(msg.userId, 'lead.replied', 'New Reply', `You received a reply from a lead`, { entityId: data.entityId, entityType: data.entityType }).catch(() => {});
    }
  });

  subscribeToEvent('campaign.completed', async (data) => {
    const payload = data.payload as Record<string, unknown>;
    if (payload.userId && typeof payload.userId === 'string') {
      await createNotification(payload.userId, 'campaign.completed', 'Campaign Completed', `Campaign has finished sending`, { entityId: data.entityId, entityType: data.entityType }).catch(() => {});
    }
  });

  subscribeToEvent('sequence.completed', async (data) => {
    const payload = data.payload as Record<string, unknown>;
    if (payload.userId && typeof payload.userId === 'string') {
      await createNotification(payload.userId, 'sequence.completed', 'Sequence Completed', `A sequence has finished`, { entityId: data.entityId, entityType: data.entityType }).catch(() => {});
    }
  });

  subscribeToEvent('message.delivered', async (data) => {
    const payload = data.payload as Record<string, unknown>;
    if (payload.userId && typeof payload.userId === 'string') {
      await createNotification(payload.userId, 'message.delivered', 'Message Delivered', `Your message was delivered`, { entityId: data.entityId, entityType: data.entityType }).catch(() => {});
    }
  });

  server = app.listen(config.port, () => {
    logger.info(`API server running on port ${config.port}`);
  });

  initWebSocket(server);
  logger.info('WebSocket server initialized');
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
