import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/**
 * Send a connection request to a lead's LinkedIn profile.
 * Stub implementation - no actual LinkedIn API call.
 */
export async function sendConnectionRequest(leadId: string, note?: string, profileUrl?: string): Promise<unknown> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw AppError.notFound('Lead');

  const existing = await prisma.linkedInProfile.findUnique({ where: { leadId } });

  if (existing && existing.connectionStatus === 'connected') {
    throw AppError.validation('Already connected to this lead');
  }

  const profile = await prisma.linkedInProfile.upsert({
    where: { leadId },
    create: {
      leadId,
      profileUrl: profileUrl || `https://linkedin.com/in/${leadId}`,
      connectionStatus: 'pending',
      connectionRequestedAt: new Date(),
    },
    update: {
      connectionStatus: 'pending',
      connectionRequestedAt: new Date(),
      ...(profileUrl ? { profileUrl } : {}),
    },
  });

  logger.info('LinkedIn connection request sent', { leadId, note });
  return profile;
}

/**
 * Send a LinkedIn message to a lead. Requires connected status.
 * Stub implementation - no actual LinkedIn API call.
 */
export async function sendLinkedInMessage(leadId: string, body: string): Promise<unknown> {
  const profile = await prisma.linkedInProfile.findUnique({ where: { leadId } });
  if (!profile) throw AppError.notFound('LinkedIn profile');

  if (profile.connectionStatus !== 'connected') {
    throw AppError.validation('Cannot send message: not connected to this lead');
  }

  const message = await prisma.linkedInMessage.create({
    data: {
      leadId,
      profileId: profile.id,
      direction: 'outbound',
      body,
      status: 'sent',
      sentAt: new Date(),
    },
  });

  await prisma.linkedInProfile.update({
    where: { leadId },
    data: { lastMessagedAt: new Date() },
  });

  logger.info('LinkedIn message sent', { leadId, messageId: message.id });
  return message;
}

/**
 * View a lead's LinkedIn profile (log activity).
 * Stub implementation - no actual LinkedIn API call.
 */
export async function viewProfile(leadId: string): Promise<unknown> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw AppError.notFound('Lead');

  const profile = await prisma.linkedInProfile.upsert({
    where: { leadId },
    create: {
      leadId,
      profileUrl: `https://linkedin.com/in/${leadId}`,
      connectionStatus: 'not_connected',
    },
    update: {
      lastMessagedAt: new Date(),
    },
  });

  logger.info('LinkedIn profile viewed', { leadId });
  return profile;
}

/**
 * Get the LinkedIn profile for a lead.
 */
export async function getProfile(leadId: string): Promise<unknown> {
  const profile = await prisma.linkedInProfile.findUnique({
    where: { leadId },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  return profile;
}

/**
 * Update a lead's LinkedIn profile data.
 */
export async function updateProfile(leadId: string, data: { profileUrl?: string; connectionStatus?: string }): Promise<unknown> {
  const profile = await prisma.linkedInProfile.findUnique({ where: { leadId } });
  if (!profile) throw AppError.notFound('LinkedIn profile');

  const updateData: Record<string, unknown> = {};
  if (data.profileUrl) updateData.profileUrl = data.profileUrl;
  if (data.connectionStatus) {
    updateData.connectionStatus = data.connectionStatus;
    if (data.connectionStatus === 'connected') {
      updateData.connectedAt = new Date();
    }
  }

  const updated = await prisma.linkedInProfile.update({
    where: { leadId },
    data: updateData,
  });

  return updated;
}

/**
 * List LinkedIn connections with optional status filter and pagination.
 */
export async function listConnections(status?: string, page = 1, pageSize = 50): Promise<{ data: unknown[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }> {
  const where: Record<string, unknown> = {};
  if (status) where.connectionStatus = status;

  const [data, total] = await Promise.all([
    prisma.linkedInProfile.findMany({
      where,
      include: { lead: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.linkedInProfile.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
}

/**
 * Update connection status (for simulating webhook callbacks).
 */
export async function updateConnectionStatus(leadId: string, status: string): Promise<unknown> {
  const profile = await prisma.linkedInProfile.findUnique({ where: { leadId } });
  if (!profile) throw AppError.notFound('LinkedIn profile');

  const updateData: Record<string, unknown> = { connectionStatus: status };
  if (status === 'connected') {
    updateData.connectedAt = new Date();
  }

  const updated = await prisma.linkedInProfile.update({
    where: { leadId },
    data: updateData,
  });

  logger.info('LinkedIn connection status updated', { leadId, status });
  return updated;
}
