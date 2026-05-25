import { prisma } from '../../db.js';
import { AppError } from '../../lib/errors.js';
import { domainLookup } from './domain-lookup.js';
import { inferRole } from './role-inference.js';
import type { Prisma } from '@prisma/client';

export interface EnrichmentResult {
  provider: string;
  data: Record<string, unknown>;
}

export interface EnrichmentProvider {
  name: string;
  enrich(lead: { email?: string | null; title?: string | null; name?: string | null }): Promise<EnrichmentResult>;
}

const domainProvider: EnrichmentProvider = {
  name: 'domain-lookup',
  async enrich(lead) {
    if (!lead.email) {
      return { provider: 'domain-lookup', data: {} };
    }
    const result = domainLookup(lead.email);
    return { provider: 'domain-lookup', data: result || {} };
  },
};

const roleProvider: EnrichmentProvider = {
  name: 'role-inference',
  async enrich(lead) {
    const result = inferRole(lead.title);
    return { provider: 'role-inference', data: result as unknown as Record<string, unknown> };
  },
};

const ALL_PROVIDERS: EnrichmentProvider[] = [domainProvider, roleProvider];

export async function enrichLead(leadId: string, providers?: string[]): Promise<EnrichmentResult[]> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw AppError.notFound('Lead');

  const activeProviders = providers
    ? ALL_PROVIDERS.filter((p) => providers.includes(p.name))
    : ALL_PROVIDERS;

  const results: EnrichmentResult[] = [];

  for (const provider of activeProviders) {
    const log = await prisma.enrichmentLog.create({
      data: {
        leadId,
        provider: provider.name,
        status: 'pending',
        requestData: { email: lead.email, title: lead.title, name: lead.name } as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      const result = await provider.enrich(lead);
      results.push(result);

      await prisma.enrichmentLog.update({
        where: { id: log.id },
        data: { status: 'completed', responseData: result.data as unknown as Prisma.InputJsonValue },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await prisma.enrichmentLog.update({
        where: { id: log.id },
        data: { status: 'failed', errorMessage },
      });
    }
  }

  const enrichmentData = ((lead.enrichmentData as Record<string, unknown>) || {}) as Record<string, unknown>;
  for (const result of results) {
    enrichmentData[result.provider] = result.data;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { enrichmentData: enrichmentData as unknown as Prisma.InputJsonValue },
  });

  return results;
}

export async function getEnrichmentHistory(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw AppError.notFound('Lead');

  return prisma.enrichmentLog.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
  });
}
