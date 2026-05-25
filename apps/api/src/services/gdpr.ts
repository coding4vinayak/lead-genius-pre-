import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

export type GdprConsentType = 'marketing_email' | 'marketing_sms' | 'data_processing' | 'third_party_sharing';

export async function recordConsent(leadId: string, consentType: GdprConsentType, source?: string) {
  const consent = await prisma.gdprConsent.upsert({
    where: { leadId_consentType: { leadId, consentType } },
    create: { leadId, consentType, source, givenAt: new Date() },
    update: { source, givenAt: new Date(), revokedAt: null },
  });
  logger.info(`Recorded consent for lead ${leadId}`, { consentType, source });
  return consent;
}

export async function revokeConsent(leadId: string, consentType: GdprConsentType) {
  const consent = await prisma.gdprConsent.update({
    where: { leadId_consentType: { leadId, consentType } },
    data: { revokedAt: new Date() },
  });
  logger.info(`Revoked consent for lead ${leadId}`, { consentType });
  return consent;
}

export async function checkConsent(leadId: string) {
  const consents = await prisma.gdprConsent.findMany({
    where: { leadId },
  });
  return consents.map((c) => ({
    consentType: c.consentType,
    isActive: c.revokedAt === null,
    givenAt: c.givenAt,
    revokedAt: c.revokedAt,
  }));
}

export async function exportLeadData(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      messages: true,
      groupMembers: { include: { group: true } },
      sequenceEnrollments: true,
      emailVerifications: true,
      unsubscribeRecords: true,
      gdprConsents: true,
    },
  });

  if (!lead) return null;

  return {
    personalData: {
      id: lead.id,
      email: lead.email,
      phone: lead.phone,
      name: lead.name,
      company: lead.company,
      title: lead.title,
      source: lead.source,
      status: lead.status,
      tags: lead.tags,
      customFields: lead.customFields,
      score: lead.score,
      stage: lead.stage,
      createdAt: lead.createdAt,
    },
    messages: lead.messages,
    groups: lead.groupMembers.map((gm) => gm.group),
    sequenceEnrollments: lead.sequenceEnrollments,
    emailVerifications: lead.emailVerifications,
    unsubscribeRecords: lead.unsubscribeRecords,
    consents: lead.gdprConsents,
    exportedAt: new Date(),
  };
}

export async function deleteLeadData(leadId: string) {
  // Delete related records first (cascading should handle most, but be explicit)
  await prisma.calendarBooking.deleteMany({ where: { leadId } });
  await prisma.sendTimePreference.deleteMany({ where: { leadId } });
  await prisma.gdprConsent.deleteMany({ where: { leadId } });
  await prisma.unsubscribeRecord.deleteMany({ where: { leadId } });
  await prisma.emailVerification.deleteMany({ where: { leadId } });
  await prisma.message.deleteMany({ where: { leadId } });
  await prisma.groupMember.deleteMany({ where: { leadId } });
  await prisma.sequenceEnrollment.deleteMany({ where: { leadId } });
  await prisma.lead.delete({ where: { id: leadId } });

  logger.info(`Deleted all data for lead ${leadId} (GDPR right-to-be-forgotten)`);
  return { deleted: true, leadId };
}
