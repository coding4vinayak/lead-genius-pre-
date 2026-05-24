import { Worker, Queue, ConnectionOptions } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Handlebars from 'handlebars';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import winston from 'winston';
import dotenv from 'dotenv';
import { startAiWorker } from './ai-worker.js';

dotenv.config({ path: '../../.env' });

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

async function sendEmail(to: string, subject: string, body: string, messageId: string) {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  if (!settings) throw new Error('Settings not configured');

  let providerId: string;

  if (settings.sendgridApiKey) {
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(settings.sendgridApiKey);
    const msg = await sgMail.send({
      from: { email: settings.fromEmail || 'noreply@example.com', name: settings.fromName || 'LeadGenius' },
      to, subject,
      html: body,
      headers: { 'X-Message-Id': messageId },
      trackingSettings: { clickTracking: { enable: true }, openTracking: { enable: true } },
    });
    providerId = msg[0]?.headers?.['x-message-id'] || messageId;
  } else {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost || '',
      port: settings.smtpPort || 587,
      secure: (settings.smtpPort || 587) === 465,
      auth: { user: settings.smtpUser || '', pass: settings.smtpPass || '' },
    });
    const info = await transporter.sendMail({
      from: `"${settings.fromName || 'LeadGenius'}" <${settings.fromEmail || 'noreply@example.com'}>`,
      to, subject,
      html: body,
      headers: { 'X-Message-Id': messageId },
    });
    providerId = info.messageId;
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { providerId, status: 'sent', deliveredAt: new Date() },
  });
  logger.info(`Email sent to ${to}`, { messageId });
}

async function sendWhatsApp(to: string, body: string, messageId: string) {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  if (!settings) throw new Error('Settings not configured');
  const client = twilio(settings.twilioAccountSid || '', settings.twilioAuthToken || '');
  const from = `whatsapp:${settings.twilioFromNumber || ''}`;
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const msg = await client.messages.create({ from, to: toNumber, body });
  await prisma.message.update({
    where: { id: messageId },
    data: { providerId: msg.sid, status: 'sent', deliveredAt: new Date() },
  });
  logger.info(`WhatsApp sent to ${to}`, { messageId });
}

async function executeCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  });
  if (!campaign || campaign.status === 'paused' || campaign.status === 'completed') return;

  if (campaign.status === 'scheduled') {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'running' } });
  }

  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  const minDelayMs = campaign.minDelayMs || settings?.defaultMinDelayMs || 30000;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.message.count({ where: { campaignId, createdAt: { gte: todayStart } } });
  const dailyLimit = Math.min(campaign.dailyLimit || settings?.dailyGlobalLimit || 1000, settings?.dailyGlobalLimit || 1000);
  const remaining = dailyLimit - sentToday;
  if (remaining <= 0) { logger.info(`Campaign ${campaignId} hit daily limit`); return; }

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId: { in: campaign.leadGroupIds } },
    include: { lead: true },
  });
  const existingSent = await prisma.message.findMany({
    where: { campaignId },
    select: { leadId: true },
  });
  const sentLeadIds = new Set(existingSent.map((m) => m.leadId));

  let queued = 0;
  for (const member of groupMembers) {
    if (queued >= remaining) break;
    if (sentLeadIds.has(member.leadId)) continue;

    const lead = member.lead;
    const compiledBody = Handlebars.compile(campaign.template.body);
    const renderedBody = compiledBody({
      name: lead.name || '', email: lead.email || '', phone: lead.phone || '',
      company: lead.company || '', title: lead.title || '',
    });
    let renderedSubject: string | undefined;
    if (campaign.template.subject) {
      renderedSubject = Handlebars.compile(campaign.template.subject)({
        name: lead.name || '', email: lead.email || '',
      });
    }

    const msg = await prisma.message.create({
      data: {
        campaignId, leadId: lead.id, channel: campaign.channel,
        direction: 'outbound', subject: renderedSubject, body: renderedBody, status: 'queued',
      },
    });

    const to = campaign.channel === 'email' ? lead.email! : lead.phone!;
    if (to) {
      const { sendQueue } = await import('./send-queue.js');
      await sendQueue.add('send-message', {
        messageId: msg.id, channel: campaign.channel, to,
        subject: renderedSubject, body: renderedBody,
      }, { delay: queued * minDelayMs });
      queued++;
    }
  }
  await prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: queued } } });
  logger.info(`Campaign ${campaignId}: queued ${queued} messages`);
}

const campaignQueue = new Queue('campaign-queue', { connection });

async function checkScheduledCampaigns() {
  try {
    const now = new Date();
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now } },
    });
    for (const campaign of campaigns) {
      await campaignQueue.add('execute-campaign', { campaignId: campaign.id });
      logger.info(`Scheduled campaign ${campaign.id} queued for execution`);
    }
  } catch (err: any) {
    logger.error('Campaign scheduler check failed', { error: err.message });
  }
}

async function main() {
  await prisma.$connect();
  logger.info('Workers connected to database');

  setInterval(checkScheduledCampaigns, 60_000);
  checkScheduledCampaigns();

  new Worker('campaign-queue', async (job) => {
    logger.info(`Processing campaign job ${job.id}`, job.data);
    await executeCampaign(job.data.campaignId);
  }, { connection, concurrency: 5 });

  new Worker('send-queue', async (job) => {
    const { messageId, channel, to, subject, body } = job.data;
    if (channel === 'email') await sendEmail(to, subject || '', body, messageId);
    else if (channel === 'whatsapp') await sendWhatsApp(to, body, messageId);
  }, { connection, concurrency: 20 });

  startAiWorker();

  logger.info('Workers started. Waiting for jobs...');
}

main().catch((err) => {
  logger.error('Worker failed', { error: err.message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
