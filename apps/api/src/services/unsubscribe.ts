import crypto from 'crypto';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';
import { addToSuppression } from './suppression-list.js';

export async function processUnsubscribe(email: string, leadId: string | null, reason?: string, ipAddress?: string, token?: string) {
  // Create unsubscribe record
  const record = await prisma.unsubscribeRecord.create({
    data: {
      email,
      leadId,
      reason: reason || 'user_request',
      ipAddress,
      token,
    },
  });

  // Add to suppression list
  await addToSuppression(email, 'unsubscribe', 'unsubscribe_link');

  // Update lead status if linked
  if (leadId) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'unsubscribed' },
    });
  }

  logger.info(`Processed unsubscribe for ${email}`, { leadId, reason });
  return record;
}

export function generateUnsubscribeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function generateUnsubscribeLink(leadId: string, messageId?: string): Promise<string> {
  const token = generateUnsubscribeToken();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.email) {
    throw new Error('Lead not found or has no email');
  }

  await prisma.unsubscribeRecord.create({
    data: {
      email: lead.email,
      leadId,
      token,
      messageId: messageId || null,
      reason: null,
      unsubscribedAt: new Date(0), // placeholder until actually unsubscribed
    },
  });

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/compliance/unsubscribe/${token}`;
}

export function injectUnsubscribeHeaders(unsubscribeUrl: string, headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export async function getUnsubscribeLandingPage(token: string) {
  const record = await prisma.unsubscribeRecord.findUnique({ where: { token } });
  if (!record) return null;
  return {
    email: record.email,
    alreadyUnsubscribed: record.reason !== null && record.unsubscribedAt.getTime() > 0,
  };
}

export async function processUnsubscribeByToken(token: string, reason?: string, ipAddress?: string) {
  const record = await prisma.unsubscribeRecord.findUnique({ where: { token } });
  if (!record) return null;

  // If already processed, return existing record
  if (record.reason !== null && record.unsubscribedAt.getTime() > 0) {
    return record;
  }

  // Update the record
  const updated = await prisma.unsubscribeRecord.update({
    where: { id: record.id },
    data: {
      reason: reason || 'one_click',
      unsubscribedAt: new Date(),
      ipAddress,
    },
  });

  // Add to suppression
  await addToSuppression(record.email, 'unsubscribe', 'unsubscribe_link');

  // Update lead status
  if (record.leadId) {
    await prisma.lead.update({
      where: { id: record.leadId },
      data: { status: 'unsubscribed' },
    });
  }

  logger.info(`Processed unsubscribe by token for ${record.email}`);
  return updated;
}
