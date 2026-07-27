import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export async function connectSlack(code: string) {
  // In production, exchange code for access token via Slack OAuth API
  const credentials = {
    accessToken: `slack_token_${code}`,
    teamId: `T${code.slice(0, 8)}`,
    teamName: 'Connected Workspace',
    botUserId: `U${code.slice(0, 8)}`,
  };

  const integration = await prisma.integration.create({
    data: {
      type: 'slack',
      name: 'Slack Integration',
      config: { teamId: credentials.teamId, teamName: credentials.teamName },
      credentials,
      isActive: true,
    },
  });

  return integration;
}

export async function sendNotification(integrationId: string, event: string, data: Record<string, unknown>) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw AppError.notFound('Integration');
  if (integration.type !== 'slack') throw AppError.validation('Integration is not a Slack integration');

  const notifications = await prisma.slackNotification.findMany({
    where: { integrationId, isActive: true },
  });

  const matching = notifications.filter((n) => {
    const eventTypes = n.eventTypes as string[];
    return eventTypes.includes(event);
  });

  if (matching.length === 0) {
    return { sent: false, reason: 'No matching notification config' };
  }

  // In production, would send messages via Slack API
  const results = matching.map((n) => ({
    channel: n.channel,
    event,
    sent: true,
  }));

  return { sent: true, notifications: results };
}

export async function configureNotifications(integrationId: string, config: { channel: string; eventTypes: string[]; isActive?: boolean }) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw AppError.notFound('Integration');
  if (integration.type !== 'slack') throw AppError.validation('Integration is not a Slack integration');

  const existing = await prisma.slackNotification.findFirst({
    where: { integrationId, channel: config.channel },
  });

  if (existing) {
    return prisma.slackNotification.update({
      where: { id: existing.id },
      data: {
        eventTypes: config.eventTypes,
        isActive: config.isActive ?? true,
      },
    });
  }

  return prisma.slackNotification.create({
    data: {
      integrationId,
      channel: config.channel,
      eventTypes: config.eventTypes,
      isActive: config.isActive ?? true,
    },
  });
}

export async function sendDailyDigest(integrationId: string) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw AppError.notFound('Integration');

  const notifications = await prisma.slackNotification.findMany({
    where: { integrationId, isActive: true },
  });

  const digestConfigs = notifications.filter((n) => {
    const eventTypes = n.eventTypes as string[];
    return eventTypes.includes('daily_digest');
  });

  if (digestConfigs.length === 0) {
    return { sent: false, reason: 'No daily digest configured' };
  }

  // In production, would compile metrics and send a Slack message
  const results = digestConfigs.map((n) => ({
    channel: n.channel,
    sent: true,
  }));

  return { sent: true, channels: results };
}

export async function listChannels(integrationId: string) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw AppError.notFound('Integration');
  if (integration.type !== 'slack') throw AppError.validation('Integration is not a Slack integration');

  // In production, would fetch channels from Slack API
  return [
    { id: 'C001', name: 'general' },
    { id: 'C002', name: 'sales' },
    { id: 'C003', name: 'leads' },
  ];
}

export async function testNotification(integrationId: string) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw AppError.notFound('Integration');
  if (integration.type !== 'slack') throw AppError.validation('Integration is not a Slack integration');

  // In production, would send a test message via Slack API
  return { success: true, message: 'Test notification sent successfully' };
}
