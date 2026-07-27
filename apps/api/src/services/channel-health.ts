import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';
import net from 'net';

export type ChannelMetricEvent = 'sent' | 'bounced' | 'complaint' | 'delivered';

/**
 * Get channel health record for a specific channel.
 * If no record exists, creates a default one.
 */
export async function getChannelHealth(channel: 'email' | 'whatsapp') {
  const provider = channel === 'email' ? 'smtp' : 'twilio';
  const record = await prisma.channelHealth.findFirst({ where: { channel } });
  if (record) return record;

  // Create default record if none exists
  return prisma.channelHealth.create({
    data: {
      channel,
      provider,
      status: 'healthy',
      lastCheckedAt: new Date(),
    },
  });
}

/**
 * Get health for all channels.
 */
export async function getAllChannelHealth() {
  return prisma.channelHealth.findMany({
    orderBy: { channel: 'asc' },
  });
}

/**
 * Update channel metrics when a message event occurs.
 * Recalculates delivery and bounce rates.
 */
export async function updateChannelMetrics(channel: 'email' | 'whatsapp', event: ChannelMetricEvent) {
  const provider = channel === 'email' ? 'smtp' : 'twilio';

  // Upsert to ensure the record exists
  const existing = await prisma.channelHealth.findUnique({
    where: { channel_provider: { channel, provider } },
  });

  if (!existing) {
    await prisma.channelHealth.create({
      data: {
        channel,
        provider,
        status: 'healthy',
        lastCheckedAt: new Date(),
      },
    });
  }

  const incrementData: Record<string, unknown> = {};
  if (event === 'sent' || event === 'delivered') {
    incrementData.dailySent = { increment: 1 };
    incrementData.quotaUsed = { increment: 1 };
  } else if (event === 'bounced') {
    incrementData.dailyBounced = { increment: 1 };
  } else if (event === 'complaint') {
    incrementData.dailyComplaints = { increment: 1 };
  }

  const updated = await prisma.channelHealth.update({
    where: { channel_provider: { channel, provider } },
    data: incrementData as never,
  });

  // Recalculate rates
  const totalSent = updated.dailySent || 1; // avoid division by zero
  const bounceRate = totalSent > 0 ? (updated.dailyBounced / totalSent) * 100 : 0;
  const deliveryRate = totalSent > 0 ? Math.max(0, 100 - bounceRate) : 100;

  // Determine health status based on rates
  let status = 'healthy';
  if (bounceRate > 10) {
    status = 'degraded';
  }
  if (bounceRate > 25) {
    status = 'down';
  }

  const result = await prisma.channelHealth.update({
    where: { channel_provider: { channel, provider } },
    data: {
      bounceRate,
      deliveryRate,
      status,
      lastCheckedAt: new Date(),
    },
  });

  return result;
}

/**
 * Check channel status by pinging the provider.
 * For SMTP: attempts a TCP connection. For Twilio: checks account status.
 * In this implementation, we update the status based on connectivity.
 */
export async function checkChannelStatus(): Promise<Array<{ channel: string; status: string }>> {
  const results: Array<{ channel: string; status: string }> = [];
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });

  // Check email (SMTP)
  const emailProvider = 'smtp';
  let emailStatus = 'healthy';
  let emailError: string | undefined;

  if (settings?.smtpHost && settings?.smtpPort) {
    try {
      await checkSmtpConnection(settings.smtpHost, settings.smtpPort);
    } catch (err) {
      emailStatus = 'down';
      emailError = (err as Error).message;
    }
  }

  await prisma.channelHealth.upsert({
    where: { channel_provider: { channel: 'email', provider: emailProvider } },
    create: {
      channel: 'email',
      provider: emailProvider,
      status: emailStatus,
      lastCheckedAt: new Date(),
      lastErrorMessage: emailError || null,
    },
    update: {
      status: emailStatus,
      lastCheckedAt: new Date(),
      lastErrorMessage: emailError || null,
    },
  });
  results.push({ channel: 'email', status: emailStatus });

  // Check WhatsApp (Twilio)
  const waProvider = 'twilio';
  let waStatus = 'healthy';
  let waError: string | undefined;

  if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
    waStatus = 'down';
    waError = 'Twilio credentials not configured';
  }

  await prisma.channelHealth.upsert({
    where: { channel_provider: { channel: 'whatsapp', provider: waProvider } },
    create: {
      channel: 'whatsapp',
      provider: waProvider,
      status: waStatus,
      lastCheckedAt: new Date(),
      lastErrorMessage: waError || null,
    },
    update: {
      status: waStatus,
      lastCheckedAt: new Date(),
      lastErrorMessage: waError || null,
    },
  });
  results.push({ channel: 'whatsapp', status: waStatus });

  logger.info('Channel health check completed', { results });
  return results;
}

/**
 * Reset daily counters - called by daily cron.
 */
export async function resetDailyCounters() {
  await prisma.channelHealth.updateMany({
    data: {
      dailySent: 0,
      dailyBounced: 0,
      dailyComplaints: 0,
    },
  });
  logger.info('Daily channel health counters reset');
}

/**
 * Get email domain auth status.
 */
export async function getDomainAuthStatus(domain: string) {
  return prisma.emailDomainAuth.findUnique({ where: { domain } });
}

/**
 * List all email domain auth records.
 */
export async function listDomainAuth() {
  return prisma.emailDomainAuth.findMany({ orderBy: { domain: 'asc' } });
}

/**
 * Add a domain to track authentication status.
 */
export async function addDomainAuth(domain: string) {
  return prisma.emailDomainAuth.create({
    data: {
      domain,
      spfStatus: 'pending',
      dkimStatus: 'pending',
      dmarcStatus: 'pending',
    },
  });
}

/**
 * Helper: Check SMTP connection by attempting a TCP connection.
 */
function checkSmtpConnection(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 5000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve();
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`SMTP connection timed out to ${host}:${port}`));
    });
    socket.on('error', (err) => {
      reject(new Error(`SMTP connection failed: ${err.message}`));
    });
  });
}
