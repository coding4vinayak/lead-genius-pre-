import { prisma } from '../db.js';
import { warmupQueue, aiQueue } from '../queue/index.js';
import { logger } from '../lib/logger.js';

const WARMUP_STEP_LABELS: Record<string, string> = {
  linkedin_connect: 'Connect on LinkedIn',
  linkedin_like: 'Like their recent post',
  linkedin_comment: 'Comment on their post',
  linkedin_share: 'Share their content',
  website_visit: 'Visit their website',
  content_share: 'Share relevant article',
  email_intro: 'Send intro email',
  email_value: 'Send value-add email',
  email_case_study: 'Share case study',
  email_meeting: 'Propose meeting',
};

function generateStepContent(step: string, lead: { name?: string; company?: string; title?: string }): { subject?: string; body: string } {
  const name = lead.name || 'there';
  const company = lead.company || 'your company';

  switch (step) {
    case 'email_intro':
      return {
        subject: `Quick question, ${name.split(' ')[0]}`,
        body: `Hi ${name},\n\nI've been following ${company} and really impressed with what you're building. Quick question — do you handle [specific problem] in-house or work with partners?\n\nBest,\n[Your Name]`,
      };
    case 'email_value':
      return {
        subject: `Thought this might help ${company}`,
        body: `Hi ${name},\n\nCame across an interesting piece about [topic relevant to ${company}] and thought of you. Would love to get your take on it.\n\nBest,\n[Your Name]`,
      };
    case 'email_case_study':
      return {
        subject: `How we helped a similar company`,
        body: `Hi ${name},\n\nWe recently helped [Similar Company] achieve [Result] using [Your Solution]. Thought this might be relevant to what ${company} is working on.\n\nWould you be open to a quick 10-min chat next week?\n\nBest,\n[Your Name]`,
      };
    case 'email_meeting':
      return {
        subject: `Quick call this week?`,
        body: `Hi ${name},\n\nBased on our conversation, I think we could help ${company} achieve [Specific Result]. Would you have 15 minutes this Thursday or Friday for a quick call?\n\nBest,\n[Your Name]`,
      };
    default:
      return { body: '' };
  }
}

export async function scheduleNextWarmupStep(leadId: string, currentStepIndex: number, settings: any): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.warmupActive) return;

  const steps = settings.steps as string[];
  if (currentStepIndex >= steps.length) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { warmupActive: false },
    });
    await prisma.leadTimeline.create({
      data: { leadId, action: 'warmup_completed', detail: 'Full warming sequence completed' },
    });
    return;
  }

  const step = steps[currentStepIndex];
  const minMs = settings.minDelayHours * 60 * 60 * 1000;
  const maxMs = settings.maxDelayHours * 60 * 60 * 1000;
  const delay = minMs + Math.floor(Math.random() * (maxMs - minMs));

  const channel = step.startsWith('email') ? 'email' : 'email';

  const content = generateStepContent(step, { name: lead.name || undefined, company: lead.company || undefined, title: lead.title || undefined });
  const task = await prisma.warmupTask.create({
    data: {
      leadId,
      step: step as any,
      stepIndex: currentStepIndex,
      channel,
      subject: content.subject,
      body: content.body || WARMUP_STEP_LABELS[step] || step,
      status: 'queued',
      scheduledAt: new Date(Date.now() + delay),
    },
  });

  await warmupQueue.add('execute-warmup-step', {
    taskId: task.id,
    leadId,
    step,
    channel,
    subject: content.subject,
    body: content.body,
  }, { delay });

  logger.info(`Scheduled warmup step ${step} for lead ${leadId} in ${Math.round(delay / 3600000)}h`);
}

export async function executeWarmupStep(taskId: string, leadId: string, step: string, channel: string, subject?: string, body?: string): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || !lead.warmupActive) return;

    await prisma.warmupTask.update({
      where: { id: taskId },
      data: { status: 'sent', completedAt: new Date() },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { warmupStep: { increment: 1 }, lastContactedAt: new Date() },
    });

    if (body) {
      await prisma.message.create({
        data: {
          leadId,
          channel: channel as any,
          direction: 'outbound',
          subject: subject || '',
          body,
          status: 'sent',
          isAiGenerated: true,
        },
      });
    }

    await prisma.leadTimeline.create({
      data: {
        leadId,
        action: 'warmup_step',
        detail: `Warmup: ${WARMUP_STEP_LABELS[step] || step}`,
        metadata: { step, taskId },
      },
    });

    const settings = await prisma.warmupSettings.findUnique({ where: { id: 'global' } });
    if (settings) {
      await scheduleNextWarmupStep(leadId, lead.warmupStep + 1, settings);
    }
  } catch (err: any) {
    logger.error(`Warmup step failed for lead ${leadId}`, { error: err.message });
    await prisma.warmupTask.update({
      where: { id: taskId },
      data: { status: 'failed', errorMessage: err.message },
    });
  }
}
