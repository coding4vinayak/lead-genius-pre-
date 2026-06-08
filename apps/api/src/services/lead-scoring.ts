import { prisma } from '../db.js';

interface ScoreFactors {
  completeness: number;
  engagement: number;
  stage: number;
  source: number;
  recency: number;
}

const SOURCE_SCORES: Record<string, number> = {
  referral: 100,
  linkedin: 80,
  manual: 60,
  website: 50,
  api: 40,
  webhook: 30,
  csv: 20,
};

const STAGE_SCORES: Record<string, number> = {
  new: 0,
  contacted: 15,
  qualified: 35,
  demo: 55,
  proposal: 70,
  negotiation: 85,
  closed_won: 100,
  closed_lost: 0,
};

function normalize(value: number, max: number): number {
  return max === 0 ? 0 : Math.min(Math.round((value / max) * 100), 100);
}

export async function scoreLead(leadId: string): Promise<number> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      messages: { select: { status: true, direction: true } },
      timeline: { select: { id: true } },
    },
  });

  if (!lead) return 0;

  const factors = calculateFactors(lead);
  const total = Math.round(
    factors.completeness * 0.20 +
    factors.engagement * 0.30 +
    factors.stage * 0.25 +
    factors.source * 0.15 +
    factors.recency * 0.10,
  );

  const score = Math.max(0, Math.min(100, total));

  await prisma.lead.update({
    where: { id: leadId },
    data: { score },
  });

  return score;
}

function calculateFactors(lead: any): ScoreFactors {
  const profiles: string[] = [];
  if (lead.name) profiles.push('name');
  if (lead.email) profiles.push('email');
  if (lead.phone) profiles.push('phone');
  if (lead.company) profiles.push('company');
  if (lead.title) profiles.push('title');
  if (lead.linkedinUrl) profiles.push('linkedinUrl');
  if (lead.websiteUrl) profiles.push('websiteUrl');
  const completeness = normalize(profiles.length, 7);

  let engagement = 0;
  if (lead.messages) {
    const replies = lead.messages.filter((m: any) => m.direction === 'inbound').length;
    engagement += normalize(replies, 5) * 0.5;

    const positiveDeliveries = lead.messages.filter((m: any) =>
      m.status === 'replied' || m.status === 'delivered',
    ).length;
    engagement += normalize(positiveDeliveries, 20) * 0.3;
  }
  if (lead.timeline) {
    engagement += normalize(lead.timeline.length, 10) * 0.1;
  }
  if (lead.warmupActive) engagement += 10;
  engagement = Math.min(engagement, 100);

  const stage = STAGE_SCORES[lead.stage as string] ?? 0;

  const source = SOURCE_SCORES[lead.source as string] ?? 0;

  const createdAt = new Date(lead.createdAt);
  const daysOld = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  let recency = 0;
  if (daysOld <= 7) recency = 100;
  else if (daysOld <= 30) recency = 80;
  else if (daysOld <= 90) recency = 50;
  else if (daysOld <= 180) recency = 25;
  else recency = 10;

  return { completeness, engagement, stage, source, recency };
}

export async function scoreAllLeads(batchSize = 50): Promise<number> {
  let total = 0;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const leads = await prisma.lead.findMany({
      select: { id: true },
      skip,
      take: batchSize,
    });

    if (leads.length === 0) {
      hasMore = false;
      break;
    }

    for (const lead of leads) {
      try {
        await scoreLead(lead.id);
        total++;
      } catch {
        continue;
      }
    }

    skip += batchSize;
  }

  return total;
}

export async function getLeadScoreFactors(leadId: string): Promise<{ score: number; factors: ScoreFactors } | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      messages: { select: { status: true, direction: true } },
      timeline: { select: { id: true } },
    },
  });

  if (!lead) return null;

  const factors = calculateFactors(lead);
  const total = Math.round(
    factors.completeness * 0.20 +
    factors.engagement * 0.30 +
    factors.stage * 0.25 +
    factors.source * 0.15 +
    factors.recency * 0.10,
  );

  return { score: Math.max(0, Math.min(100, total)), factors };
}
