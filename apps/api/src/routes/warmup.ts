import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { warmupStartSchema, warmupSettingsSchema } from '@leadgenius/shared';
import { warmupQueue } from '../queue/index.js';
import { dispatchWebhookEvent } from '../services/webhook-delivery.js';
import { scheduleNextWarmupStep, executeWarmupStep } from '../services/warmup.js';

const router = Router();

router.get('/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.warmupSettings.findUnique({ where: { id: 'global' } });
    if (!settings) {
      settings = await prisma.warmupSettings.create({ data: { id: 'global' } });
    }
    res.json({ data: settings });
  } catch (err) { next(err); }
});

router.put('/settings', validate(warmupSettingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.warmupSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...req.body },
      update: req.body,
    });
    await prisma.leadTimeline.create({
      data: { leadId: 'system', action: 'warmup_settings', detail: 'Warmup settings updated' },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/start', validate(warmupStartSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = req.body;
    const settings = await prisma.warmupSettings.findUnique({ where: { id: 'global' } });
    if (!settings || !settings.enabled) {
      throw AppError.validation('Warmup is not enabled. Enable it in warmup settings first.');
    }

    const activeCount = await prisma.lead.count({ where: { warmupActive: true } });
    if (activeCount + leadIds.length > settings.maxActiveWarmups) {
      throw AppError.validation(`Max ${settings.maxActiveWarmups} active warmups allowed. Currently ${activeCount} active.`);
    }

    const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } } });
    if (leads.length === 0) throw AppError.notFound('No leads found');

    const started: string[] = [];
    for (const lead of leads) {
      if (lead.warmupActive) continue;
      if (!lead.email && !lead.linkedinUrl) {
        continue;
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { warmupActive: true, warmupStep: 0, warmupStartedAt: new Date() },
      });

      await prisma.leadTimeline.create({
        data: { leadId: lead.id, action: 'warmup_started', detail: 'Lead warming sequence started' },
      });

      await scheduleNextWarmupStep(lead.id, 0, settings);
      started.push(lead.id);
      dispatchWebhookEvent('lead.updated', { leadId: lead.id, action: 'warmup_started' });
    }

    res.json({ data: { started: started.length, leadIds: started } });
  } catch (err) { next(err); }
});

router.post('/stop', validate(warmupStartSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = req.body;
    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { warmupActive: false, warmupStep: 0 },
    });

    for (const leadId of leadIds) {
      await prisma.leadTimeline.create({
        data: { leadId, action: 'warmup_stopped', detail: 'Warming sequence stopped' },
      });
    }

    res.json({ data: { stopped: leadIds.length } });
  } catch (err) { next(err); }
});

router.get('/active', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { warmupActive: true },
      orderBy: { warmupStartedAt: 'desc' },
      take: 100,
    });
    res.json({ data: leads });
  } catch (err) { next(err); }
});

router.get('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.query.leadId as string | undefined;
    const where = leadId ? { leadId } : {};
    const tasks = await prisma.warmupTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ data: tasks });
  } catch (err) { next(err); }
});

export default router;
