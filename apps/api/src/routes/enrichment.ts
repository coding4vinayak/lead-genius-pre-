import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { enrichLeadRequestSchema, bulkEnrichRequestSchema, findEmailRequestSchema } from '@leadgenius/shared';
import { enrichLead, getEnrichmentHistory } from '../services/enrichment/index.js';
import { findEmail } from '../services/enrichment/email-finder.js';
import { enrichmentQueue } from '../queue/index.js';

const router = Router();

router.post('/leads/:id/enrich', validate(enrichLeadRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { providers } = req.body as { providers?: string[] };
    const results = await enrichLead(id, providers);
    res.json({ data: results });
  } catch (err) { next(err); }
});

router.post('/groups/:id/enrich', validate(bulkEnrichRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { providers } = req.body as { providers?: string[] };

    const group = await prisma.leadGroup.findUnique({ where: { id } });
    if (!group) throw AppError.notFound('LeadGroup');

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      select: { leadId: true },
    });

    const leadIds = members.map((m) => m.leadId);

    await enrichmentQueue.add('bulk-enrich', { leadIds, providers }, { jobId: `bulk-enrich-${id}-${Date.now()}` });

    res.json({ data: { queued: leadIds.length, groupId: id } });
  } catch (err) { next(err); }
});

router.get('/leads/:id/enrichment-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const history = await getEnrichmentHistory(id);
    res.json({ data: history });
  } catch (err) { next(err); }
});

router.post('/leads/find-email', validate(findEmailRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, domain } = req.body as { firstName: string; lastName: string; domain: string };
    const patterns = findEmail(firstName, lastName, domain);
    res.json({ data: patterns });
  } catch (err) { next(err); }
});

export default router;
