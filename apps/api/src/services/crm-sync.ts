import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import type { IntegrationType } from '@prisma/client';

const OAUTH_URLS: Record<string, string> = {
  hubspot: 'https://app.hubspot.com/oauth/authorize',
  salesforce: 'https://login.salesforce.com/services/oauth2/authorize',
};

export function getOAuthUrl(provider: string): string {
  const baseUrl = OAUTH_URLS[provider];
  if (!baseUrl) throw AppError.validation(`Unsupported CRM provider: ${provider}`);

  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`] || 'client_id';
  const redirectUri = process.env[`${provider.toUpperCase()}_REDIRECT_URI`] || `http://localhost:3000/api/crm/oauth/callback`;

  return `${baseUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=contacts&response_type=code`;
}

export async function handleOAuthCallback(provider: string, code: string) {
  if (!OAUTH_URLS[provider]) throw AppError.validation(`Unsupported CRM provider: ${provider}`);

  // In production, exchange code for access token via provider API
  const credentials = {
    accessToken: `${provider}_token_${code}`,
    refreshToken: `${provider}_refresh_${code}`,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  };

  const integration = await prisma.integration.create({
    data: {
      type: provider as IntegrationType,
      name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} CRM`,
      config: { provider },
      credentials,
      isActive: true,
    },
  });

  return integration;
}

export async function connectCrm(integrationId: string, authCode: string) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw AppError.notFound('Integration');

  const provider = (integration.config as Record<string, string>).provider || integration.type;

  const credentials = {
    accessToken: `${provider}_token_${authCode}`,
    refreshToken: `${provider}_refresh_${authCode}`,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  };

  const updated = await prisma.integration.update({
    where: { id: integrationId },
    data: { credentials, isActive: true },
  });

  const crmSync = await prisma.crmSync.create({
    data: {
      integrationId,
      provider,
      direction: 'bidirectional',
      syncStatus: 'idle',
      fieldMapping: {},
    },
  });

  return { integration: updated, crmSync };
}

export async function syncContacts(integrationId: string, direction: string) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw AppError.notFound('Integration');

  const crmSync = await prisma.crmSync.findFirst({ where: { integrationId } });
  if (!crmSync) throw AppError.notFound('CrmSync');

  await prisma.crmSync.update({
    where: { id: crmSync.id },
    data: { syncStatus: 'syncing' },
  });

  // In production, would call the CRM API to sync contacts
  const effectiveDirection = direction || crmSync.direction;

  await prisma.crmSync.update({
    where: { id: crmSync.id },
    data: {
      syncStatus: 'completed',
      lastSyncAt: new Date(),
      direction: effectiveDirection,
    },
  });

  return { syncId: crmSync.id, direction: effectiveDirection, status: 'completed' };
}

export async function pushLeadStage(leadId: string, stage: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw AppError.notFound('Lead');

  // Find active CRM integrations
  const crmSyncs = await prisma.crmSync.findMany({
    where: { syncStatus: { not: 'failed' } },
  });

  if (crmSyncs.length === 0) {
    throw AppError.validation('No active CRM sync configured');
  }

  // In production, would push the lead stage to the CRM provider
  return { leadId, stage, pushed: true, syncCount: crmSyncs.length };
}

export async function pullNewContacts(integrationId: string) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw AppError.notFound('Integration');

  const crmSync = await prisma.crmSync.findFirst({ where: { integrationId } });
  if (!crmSync) throw AppError.notFound('CrmSync');

  // In production, would fetch new contacts from CRM and create leads
  await prisma.crmSync.update({
    where: { id: crmSync.id },
    data: { lastSyncAt: new Date() },
  });

  return { integrationId, contactsPulled: 0 };
}

export function mapFields(lead: Record<string, unknown>, fieldMapping: Record<string, string>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [crmField, leadField] of Object.entries(fieldMapping)) {
    mapped[crmField] = lead[leadField];
  }
  return mapped;
}

export async function getSyncStatus(integrationId: string) {
  const crmSync = await prisma.crmSync.findFirst({ where: { integrationId } });
  if (!crmSync) throw AppError.notFound('CrmSync');
  return crmSync;
}

export async function getFieldMapping(integrationId: string) {
  const crmSync = await prisma.crmSync.findFirst({ where: { integrationId } });
  if (!crmSync) throw AppError.notFound('CrmSync');
  return crmSync.fieldMapping;
}

export async function updateFieldMapping(integrationId: string, fieldMapping: Record<string, string>) {
  const crmSync = await prisma.crmSync.findFirst({ where: { integrationId } });
  if (!crmSync) throw AppError.notFound('CrmSync');

  return prisma.crmSync.update({
    where: { id: crmSync.id },
    data: { fieldMapping },
  });
}
