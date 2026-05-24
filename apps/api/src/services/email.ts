import nodemailer from 'nodemailer';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';
import { captureEmail } from './email-sandbox.js';
import { getEtherealSmtpConfig, getMailtrapConfig } from './external-email-test.js';

export async function sendEmail(to: string, subject: string, body: string, messageId: string) {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  if (!settings) throw new Error('Settings not configured');

  const sandboxMode = process.env.EMAIL_SANDBOX !== 'false';
  let providerId: string;
  let provider: 'smtp' | 'sendgrid' | 'ethereal' | 'mailtrap' = 'smtp';

  if (process.env.MAILTRAP_API_KEY) {
    const mailtrapCfg = getMailtrapConfig(process.env.MAILTRAP_API_KEY, process.env.MAILTRAP_INBOX_ID ? parseInt(process.env.MAILTRAP_INBOX_ID) : undefined);
    const transporter = nodemailer.createTransport({
      host: mailtrapCfg.host,
      port: mailtrapCfg.port,
      auth: mailtrapCfg.auth,
    });
    const info = await transporter.sendMail({
      from: `"${settings.fromName || 'LeadGenius'}" <${settings.fromEmail || 'noreply@example.com'}>`,
      to, subject,
      html: body,
      headers: { 'X-Message-Id': messageId },
    });
    providerId = info.messageId;
    provider = 'mailtrap';
  } else if (sandboxMode && process.env.ETHEREAL_ENABLED === 'true') {
    const etherealCfg = getEtherealSmtpConfig();
    if (etherealCfg) {
      const transporter = nodemailer.createTransport(etherealCfg);
      const info = await transporter.sendMail({
        from: `"${settings.fromName || 'LeadGenius'}" <${settings.fromEmail || 'noreply@example.com'}>`,
        to, subject,
        html: body,
        headers: { 'X-Message-Id': messageId },
      });
      providerId = info.messageId;
      provider = 'ethereal';
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
  } else if (sandboxMode || process.env.NODE_ENV === 'test') {
    if (settings.sendgridApiKey && !sandboxMode) {
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
      provider = 'sendgrid';
    } else {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost || 'localhost',
        port: settings.smtpPort || parseInt(process.env.EMAIL_SMTP_PORT || '1025', 10),
        secure: false,
        auth: { user: settings.smtpUser || '', pass: settings.smtpPass || '' },
        ignoreTLS: true,
      });
      const info = await transporter.sendMail({
        from: `"${settings.fromName || 'LeadGenius'}" <${settings.fromEmail || 'noreply@example.com'}>`,
        to, subject,
        html: body,
        headers: { 'X-Message-Id': messageId },
      });
      providerId = info.messageId;
    }
  } else {
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
      provider = 'sendgrid';
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
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { providerId, status: 'sent', deliveredAt: new Date() },
  });

  if (sandboxMode || process.env.EMAIL_SANDBOX !== 'false') {
    captureEmail({
      to, from: settings.fromEmail || 'noreply@example.com',
      fromName: settings.fromName || 'LeadGenius',
      subject, html: body, provider,
      tags: sandboxMode ? ['sandbox-captured'] : [],
    });
  }

  logger.info(`Email sent to ${to}`, { messageId, providerId, provider, sandbox: sandboxMode });
}
