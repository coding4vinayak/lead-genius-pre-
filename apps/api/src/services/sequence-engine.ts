import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';
import { evaluateCondition, Condition } from './condition-evaluator.js';
import { publishEvent } from './event-bus.js';
import { sendQueue } from '../queue/index.js';

/**
 * Enroll leads in a sequence - creates SequenceEnrollment records
 */
export async function enrollLeadsInSequence(sequenceId: string, leadIds: string[]): Promise<number> {
  const sequence = await prisma.sequence.findUnique({
    where: { id: sequenceId },
    include: { steps: { orderBy: { position: 'asc' } } },
  });

  if (!sequence || sequence.steps.length === 0) {
    return 0;
  }

  const firstStep = sequence.steps[0];

  // Check for existing active enrollments
  const existing = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId, leadId: { in: leadIds }, status: 'active' },
    select: { leadId: true },
  });
  const existingSet = new Set(existing.map((e) => e.leadId));
  const newLeadIds = leadIds.filter((id) => !existingSet.has(id));

  if (newLeadIds.length === 0) return 0;

  await prisma.sequenceEnrollment.createMany({
    data: newLeadIds.map((leadId) => ({
      sequenceId,
      leadId,
      status: 'active' as const,
      currentStepId: firstStep.id,
      nextRunAt: new Date(),
    })),
  });

  return newLeadIds.length;
}

/**
 * Check if current time is within the sending window for a sequence.
 * NOTE: Timezone-aware comparison requires a library like luxon or date-fns-tz.
 * For now, we use the server's local time as a reasonable default.
 * Full timezone support (using sequence.timezone) is a future enhancement.
 */
function isInSendingWindow(sequence: { sendingWindowStart: string | null; sendingWindowEnd: string | null; timezone: string }): boolean {
  if (!sequence.sendingWindowStart || !sequence.sendingWindowEnd) return true;

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return currentTime >= sequence.sendingWindowStart && currentTime <= sequence.sendingWindowEnd;
}

/**
 * Check if lead has replied since enrollment started (for pauseOnReply)
 */
export async function checkForReplies(enrollmentId: string): Promise<boolean> {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { sequence: true },
  });

  if (!enrollment || !enrollment.sequence.pauseOnReply) return false;

  const inboundMessage = await prisma.message.findFirst({
    where: {
      leadId: enrollment.leadId,
      direction: 'inbound',
      createdAt: { gte: enrollment.startedAt },
    },
  });

  if (inboundMessage) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'paused', exitReason: 'replied' },
    });
    return true;
  }

  return false;
}

/**
 * Process a single sequence step for an enrollment
 */
export async function processSequenceStep(enrollmentId: string): Promise<void> {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      sequence: { include: { steps: { orderBy: { position: 'asc' } } } },
      lead: true,
    },
  });

  if (!enrollment || enrollment.status !== 'active') return;

  const sequence = enrollment.sequence;
  const step = sequence.steps.find((s) => s.id === enrollment.currentStepId);

  if (!step) {
    // No current step - mark as completed
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'completed', completedAt: new Date() },
    });
    return;
  }

  // Check sending window
  if (!isInSendingWindow(sequence)) {
    // Reschedule for 5 minutes later
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { nextRunAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    return;
  }

  // Check for replies (pause on reply)
  const hasReplied = await checkForReplies(enrollmentId);
  if (hasReplied) return;

  const config = step.config as Record<string, unknown>;
  let executionStatus: 'completed' | 'failed' | 'skipped' = 'completed';
  let result: Record<string, unknown> = {};
  let nextStepId: string | null = step.nextStepId;

  try {
    switch (step.type) {
      case 'send_email': {
        // Deduplication: check if same template was already sent to this lead in this sequence
        const templateId = config.templateId as string;
        if (templateId) {
          const alreadySent = await prisma.sequenceStepExecution.findFirst({
            where: {
              enrollmentId,
              step: { config: { path: ['templateId'], equals: templateId } },
              status: 'completed',
            },
          });
          if (alreadySent) {
            executionStatus = 'skipped';
            result = { reason: 'duplicate_template' };
            break;
          }
        }

        const lead = enrollment.lead;
        const template = templateId ? await prisma.template.findUnique({ where: { id: templateId } }) : null;

        if (template && lead.email) {
          const body = renderSimpleTemplate(template.body, lead);
          const subject = template.subject ? renderSimpleTemplate(template.subject, lead) : '';

          const msg = await prisma.message.create({
            data: {
              leadId: lead.id,
              channel: 'email',
              direction: 'outbound',
              subject,
              body,
              status: 'queued',
            },
          });

          await sendQueue.add('send-message', {
            messageId: msg.id,
            channel: 'email',
            to: lead.email,
            subject,
            body,
          });

          result = { messageId: msg.id, templateId };
        } else {
          executionStatus = 'skipped';
          result = { reason: !lead.email ? 'no_email' : 'no_template' };
        }
        break;
      }

      case 'send_whatsapp': {
        const templateId = config.templateId as string;
        if (templateId) {
          const alreadySent = await prisma.sequenceStepExecution.findFirst({
            where: {
              enrollmentId,
              step: { config: { path: ['templateId'], equals: templateId } },
              status: 'completed',
            },
          });
          if (alreadySent) {
            executionStatus = 'skipped';
            result = { reason: 'duplicate_template' };
            break;
          }
        }

        const lead = enrollment.lead;
        const template = templateId ? await prisma.template.findUnique({ where: { id: templateId } }) : null;

        if (template && lead.phone) {
          const body = renderSimpleTemplate(template.body, lead);

          const msg = await prisma.message.create({
            data: {
              leadId: lead.id,
              channel: 'whatsapp',
              direction: 'outbound',
              body,
              status: 'queued',
            },
          });

          await sendQueue.add('send-message', {
            messageId: msg.id,
            channel: 'whatsapp',
            to: lead.phone,
            subject: '',
            body,
          });

          result = { messageId: msg.id, templateId };
        } else {
          executionStatus = 'skipped';
          result = { reason: !lead.phone ? 'no_phone' : 'no_template' };
        }
        break;
      }

      case 'delay': {
        const delayHours = (config.delayHours as number) || 24;
        await prisma.sequenceEnrollment.update({
          where: { id: enrollmentId },
          data: { nextRunAt: new Date(Date.now() + delayHours * 60 * 60 * 1000) },
        });

        // Record execution and advance to next step after delay
        await prisma.sequenceStepExecution.create({
          data: {
            enrollmentId,
            stepId: step.id,
            status: 'completed',
            executedAt: new Date(),
            result: { delayHours },
          },
        });

        // Advance currentStepId to next step (will be processed after delay)
        if (nextStepId) {
          await prisma.sequenceEnrollment.update({
            where: { id: enrollmentId },
            data: { currentStepId: nextStepId },
          });
        } else {
          await prisma.sequenceEnrollment.update({
            where: { id: enrollmentId },
            data: { status: 'completed', completedAt: new Date(), currentStepId: null },
          });
        }
        return; // Early return - delay handling is special
      }

      case 'condition': {
        const conditions = config.conditions as Condition[] | undefined;
        const lead = enrollment.lead;
        const payload: Record<string, unknown> = {
          lead: {
            id: lead.id,
            email: lead.email,
            name: lead.name,
            score: lead.score,
            stage: lead.stage,
            tags: lead.tags,
            status: lead.status,
          },
        };

        let conditionMet = true;
        if (conditions && conditions.length > 0) {
          conditionMet = conditions.every((cond) => evaluateCondition(cond, payload));
        }

        nextStepId = conditionMet
          ? (step.conditionTrueStepId || step.nextStepId)
          : (step.conditionFalseStepId || step.nextStepId);

        result = { conditionMet, evaluatedConditions: conditions };
        break;
      }

      case 'update_lead_stage': {
        const targetStage = config.stage as string;
        if (targetStage) {
          await prisma.lead.update({
            where: { id: enrollment.leadId },
            data: { stage: targetStage as never },
          });
          publishEvent('lead.updated', 'lead', enrollment.leadId, { field: 'stage', value: targetStage }).catch(() => {});
          result = { previousStage: enrollment.lead.stage, newStage: targetStage };
        }
        break;
      }

      case 'update_lead_score': {
        const delta = (config.delta as number) || 0;
        const currentScore = enrollment.lead.score || 0;
        const newScore = currentScore + delta;
        await prisma.lead.update({
          where: { id: enrollment.leadId },
          data: { score: newScore },
        });
        publishEvent('lead.updated', 'lead', enrollment.leadId, { field: 'score', value: newScore, delta }).catch(() => {});
        result = { previousScore: currentScore, newScore, delta };
        break;
      }

      default:
        executionStatus = 'skipped';
        result = { reason: 'unknown_step_type' };
    }
  } catch (err) {
    executionStatus = 'failed';
    result = { error: (err as Error).message };
    logger.error('Sequence step execution failed', { enrollmentId, stepId: step.id, error: (err as Error).message });
  }

  // Record step execution
  await prisma.sequenceStepExecution.create({
    data: {
      enrollmentId,
      stepId: step.id,
      status: executionStatus,
      executedAt: new Date(),
      result: result as never,
    },
  });

  // Advance to next step or complete
  if (nextStepId) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { currentStepId: nextStepId, nextRunAt: new Date() },
    });
  } else {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'completed', completedAt: new Date(), currentStepId: null },
    });
  }
}

/**
 * In-process mutex to prevent overlapping tick executions.
 * TODO: This in-process mutex does not prevent concurrent ticks across multiple pods.
 * For multi-instance deployments, replace with a database advisory lock or a BullMQ
 * repeatable job to ensure only one pod processes enrollments at a time.
 */
let isTickRunning = false;

/**
 * Tick sequences - called by cron every minute.
 * Finds enrollments that are due to be processed and processes them.
 * Uses a simple in-process mutex to prevent overlapping ticks.
 */
export async function tickSequences(): Promise<number> {
  if (isTickRunning) {
    logger.warn('Sequence tick skipped: previous tick still running');
    return 0;
  }

  isTickRunning = true;
  try {
    const now = new Date();

    const dueEnrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        status: 'active',
        nextRunAt: { lte: now },
        sequence: { status: 'active' },
      },
      take: 100, // Process in batches
    });

    let processed = 0;
    for (const enrollment of dueEnrollments) {
      try {
        await processSequenceStep(enrollment.id);
        processed++;
      } catch (err) {
        logger.error('Failed to process sequence enrollment', { enrollmentId: enrollment.id, error: (err as Error).message });
      }
    }

    return processed;
  } finally {
    isTickRunning = false;
  }
}

/**
 * Simple template renderer using Handlebars-like syntax {{variable}}
 */
function renderSimpleTemplate(template: string, lead: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return String(lead[key] || '');
  });
}
