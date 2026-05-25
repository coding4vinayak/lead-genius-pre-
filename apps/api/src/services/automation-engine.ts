import { prisma } from '../db.js';
import { automationQueue, sendQueue, webhookQueue } from '../queue/index.js';
import { logger } from '../lib/logger.js';
import { evaluateCondition } from './condition-evaluator.js';

const MAX_STEPS_PER_EXECUTION = 100;

export async function executeAutomation(
  automationId: string,
  triggerPayload: Record<string, unknown>,
): Promise<void> {
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: { steps: { orderBy: { position: 'asc' } } },
  });

  if (!automation || !automation.isActive) return;

  const execution = await prisma.automationExecution.create({
    data: {
      automationId,
      triggerEvent: automation.triggerType,
      triggerPayload: JSON.parse(JSON.stringify(triggerPayload)),
      status: 'running',
      startedAt: new Date(),
    },
  });

  const firstStep = automation.steps[0];
  if (!firstStep) {
    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    return;
  }

  await automationQueue.add('process-step', {
    executionId: execution.id,
    stepId: firstStep.id,
    payload: triggerPayload,
  });
}

export async function processAutomationStep(
  executionId: string,
  stepId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Guard against runaway executions (cycles or misconfigured chains)
  const completedStepCount = await prisma.automationExecutionStep.count({
    where: { executionId },
  });
  if (completedStepCount >= MAX_STEPS_PER_EXECUTION) {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: 'failed',
        errorMessage: `Execution exceeded maximum step count (${MAX_STEPS_PER_EXECUTION})`,
        completedAt: new Date(),
      },
    });
    return;
  }

  const step = await prisma.automationStep.findUnique({ where: { id: stepId } });
  if (!step) {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { status: 'failed', errorMessage: `Step ${stepId} not found`, completedAt: new Date() },
    });
    return;
  }

  const executionStep = await prisma.automationExecutionStep.create({
    data: {
      executionId,
      stepId,
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    const config = (step.config || {}) as Record<string, unknown>;
    let output: Record<string, unknown> = {};
    let nextStepId: string | null = step.nextStepId;

    switch (step.type) {
      case 'send_message': {
        const templateId = config.templateId as string;
        const leadId = (payload.lead as Record<string, unknown>)?.id as string || config.leadId as string;
        await sendQueue.add('send-message', {
          templateId,
          leadId,
          channel: config.channel || 'email',
          payload,
        });
        output = { queued: true, templateId, leadId };
        break;
      }

      case 'update_lead_field': {
        const leadId = (payload.lead as Record<string, unknown>)?.id as string || config.leadId as string;
        const field = config.field as string;
        const value = config.value;

        const ALLOWED_FIELDS = ['name', 'company', 'title', 'source', 'status', 'stage', 'score', 'tags', 'customFields'];
        if (!ALLOWED_FIELDS.includes(field)) {
          throw new Error(`Field '${field}' is not allowed for update_lead_field. Allowed: ${ALLOWED_FIELDS.join(', ')}`);
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { [field]: value },
        });
        output = { leadId, field, value };
        break;
      }

      case 'add_tag': {
        const leadId = (payload.lead as Record<string, unknown>)?.id as string || config.leadId as string;
        const tag = config.tag as string;
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (lead) {
          const tags = Array.isArray(lead.tags) ? [...lead.tags] : [];
          if (!tags.includes(tag)) {
            tags.push(tag);
            await prisma.lead.update({ where: { id: leadId }, data: { tags } });
          }
        }
        output = { leadId, tag, action: 'added' };
        break;
      }

      case 'remove_tag': {
        const leadId = (payload.lead as Record<string, unknown>)?.id as string || config.leadId as string;
        const tag = config.tag as string;
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (lead) {
          const tags = Array.isArray(lead.tags) ? lead.tags.filter((t: string) => t !== tag) : [];
          await prisma.lead.update({ where: { id: leadId }, data: { tags } });
        }
        output = { leadId, tag, action: 'removed' };
        break;
      }

      case 'move_to_group': {
        const leadId = (payload.lead as Record<string, unknown>)?.id as string || config.leadId as string;
        const groupId = config.groupId as string;
        await prisma.groupMember.create({ data: { leadId, groupId } });
        output = { leadId, groupId, action: 'added_to_group' };
        break;
      }

      case 'remove_from_group': {
        const leadId = (payload.lead as Record<string, unknown>)?.id as string || config.leadId as string;
        const groupId = config.groupId as string;
        await prisma.groupMember.deleteMany({ where: { leadId, groupId } });
        output = { leadId, groupId, action: 'removed_from_group' };
        break;
      }

      case 'pause_campaign': {
        const campaignId = config.campaignId as string;
        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'paused' } });
        output = { campaignId, action: 'paused' };
        break;
      }

      case 'send_webhook': {
        const url = config.url as string;
        const webhookPayload = config.payload || payload;
        await webhookQueue.add('send-webhook', { url, payload: webhookPayload });
        output = { url, queued: true };
        break;
      }

      case 'delay': {
        const delayMs = (config.delayMs as number) || 60000;

        if (!nextStepId) {
          // No next step after delay - complete the execution
          await prisma.automationExecutionStep.update({
            where: { id: executionStep.id },
            data: { status: 'completed', output: { delayed: true, delayMs } as never, completedAt: new Date() },
          });
          await prisma.automationExecution.update({
            where: { id: executionId },
            data: { status: 'completed', completedAt: new Date() },
          });
          return;
        }

        await automationQueue.add('process-step', {
          executionId,
          stepId: nextStepId,
          payload,
        }, { delay: delayMs });

        await prisma.automationExecutionStep.update({
          where: { id: executionStep.id },
          data: { status: 'completed', output: { delayed: true, delayMs } as never, completedAt: new Date() },
        });
        return;
      }

      case 'condition': {
        const condition = config.condition as { field: string; operator: string; value?: unknown };
        const result = evaluateCondition(condition, payload);
        if (result) {
          nextStepId = step.conditionTrueStepId;
        } else {
          nextStepId = step.conditionFalseStepId;
        }
        output = { condition, result, nextStepId };
        break;
      }

      case 'create_task': {
        const task = await prisma.task.create({
          data: {
            title: (config.title as string) || 'Automation Task',
            description: (config.description as string) || null,
            status: 'pending',
            priority: ((config.priority as string) || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
            automationId: step.automationId,
            automationExecutionId: executionId,
          },
        });
        output = { taskId: task.id };
        break;
      }

      default:
        output = { error: `Unknown step type: ${step.type}` };
    }

    await prisma.automationExecutionStep.update({
      where: { id: executionStep.id },
      data: { status: 'completed', output: output as never, completedAt: new Date() },
    });

    if (nextStepId) {
      await automationQueue.add('process-step', {
        executionId,
        stepId: nextStepId,
        payload,
      });
    } else {
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: 'completed', completedAt: new Date() },
      });
    }
  } catch (err) {
    const errorMessage = (err as Error).message;
    logger.error('Automation step failed', { executionId, stepId, error: errorMessage });

    await prisma.automationExecutionStep.update({
      where: { id: executionStep.id },
      data: { status: 'failed', output: { error: errorMessage } as never, completedAt: new Date() },
    });

    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { status: 'failed', errorMessage, completedAt: new Date() },
    });
  }
}
