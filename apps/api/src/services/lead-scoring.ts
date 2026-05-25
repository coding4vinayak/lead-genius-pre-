import { prisma } from '../db.js';
import { publishEvent } from './event-bus.js';
import { logger } from '../lib/logger.js';

export type ScoringEvent = 'open' | 'click' | 'reply' | 'bounce';

const DEFAULT_DELTAS: Record<ScoringEvent, number> = {
  open: 5,
  click: 10,
  reply: 25,
  bounce: -10,
};

/**
 * Update lead score based on an event.
 * Returns the new score.
 */
export async function updateLeadScore(leadId: string, event: ScoringEvent, delta?: number): Promise<number> {
  const scoreDelta = delta ?? DEFAULT_DELTAS[event];

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { score: true } });
  const currentScore = lead?.score ?? 0;
  const newScore = Math.max(0, currentScore + scoreDelta);

  await prisma.lead.update({
    where: { id: leadId },
    data: { score: newScore },
  });

  logger.info('Lead score updated', { leadId, event, delta: scoreDelta, newScore });
  return newScore;
}

/**
 * Evaluate stage progression based on score thresholds.
 * Automatically advances the lead stage if score crosses thresholds.
 * Returns the new stage if changed, null otherwise.
 */
export async function evaluateStageProgression(leadId: string): Promise<string | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { score: true, stage: true },
  });

  if (!lead) return null;

  const score = lead.score ?? 0;
  let targetStage: string;

  if (score >= 80) {
    targetStage = 'hot';
  } else if (score >= 50) {
    targetStage = 'warm';
  } else if (score >= 30) {
    targetStage = 'engaged';
  } else if (score >= 10) {
    targetStage = 'contacted';
  } else {
    targetStage = 'new';
  }

  // Only advance stages (never go backward, unless score drops)
  // And only if the stage actually changed
  if (targetStage === lead.stage) return null;

  await prisma.lead.update({
    where: { id: leadId },
    data: { stage: targetStage as never },
  });

  publishEvent('lead.stage_changed', 'lead', leadId, {
    previousStage: lead.stage,
    newStage: targetStage,
    score,
  }).catch(() => {});

  logger.info('Lead stage progressed', { leadId, from: lead.stage, to: targetStage, score });
  return targetStage;
}

/**
 * Combined: update score and evaluate stage progression.
 * Call this from webhook handlers.
 */
export async function handleScoringEvent(leadId: string, event: ScoringEvent, delta?: number): Promise<{ score: number; stage: string | null }> {
  const score = await updateLeadScore(leadId, event, delta);
  const stage = await evaluateStageProgression(leadId);
  return { score, stage };
}
