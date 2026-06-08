import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { linkedinImportSchema, websiteImportSchema } from '@leadgenius/shared';
import { warmupQueue } from '../queue/index.js';
import { dispatchWebhookEvent } from '../services/webhook-delivery.js';

const router = Router();

function extractLinkedInProfile(url: string): { name?: string; title?: string; company?: string } {
  const segments = url.replace(/\/$/, '').split('/');
  const username = segments[segments.length - 1] || '';
  return {
    name: username.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    title: 'Imported from LinkedIn',
  };
}

router.post('/linkedin', validate(linkedinImportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchUrl, keywords, location, title, company, maxLeads, groupId } = req.body;

    const leads: Array<{
      name: string; email: string; phone: string; company: string; title: string;
      source: string; linkedinUrl: string; tags: string[];
    }> = [];

    if (searchUrl && searchUrl.includes('linkedin.com/in/')) {
      const profile = extractLinkedInProfile(searchUrl);
      leads.push({
        name: profile.name || searchUrl.split('/').pop() || 'Imported Lead',
        email: '',
        phone: '',
        company: company || profile.company || '',
        title: title || profile.title || '',
        source: 'linkedin',
        linkedinUrl: searchUrl,
        tags: ['linkedin-import'],
      });
    } else {
      for (let i = 0; i < maxLeads; i++) {
        leads.push({
          name: '',
          email: '',
          phone: '',
          company: company || '',
          title: title || '',
          source: 'linkedin',
          linkedinUrl: '',
          tags: ['linkedin-import'],
        });
      }
    }

    const created = await Promise.all(
      leads.map((lead) =>
        prisma.lead.create({
          data: {
            name: lead.name,
            email: lead.email || undefined,
            phone: lead.phone || undefined,
            company: lead.company || undefined,
            title: lead.title || undefined,
            source: lead.source,
            linkedinUrl: lead.linkedinUrl || undefined,
            tags: lead.tags,
          },
        }),
      ),
    );

    if (groupId) {
      await prisma.groupMember.createMany({
        data: created.map((l) => ({ leadId: l.id, groupId })),
        skipDuplicates: true,
      });
    }

    for (const lead of created) {
      await prisma.leadTimeline.create({
        data: { leadId: lead.id, action: 'imported', detail: `Imported from LinkedIn${keywords ? ` (keywords: ${keywords})` : ''}` },
      });
      dispatchWebhookEvent('lead.created', { leadId: lead.id, lead });
    }

    res.status(201).json({
      data: { count: created.length, leads: created },
      meta: { note: 'Placeholder — connect real LinkedIn API for full enrichment' },
    });
  } catch (err) { next(err); }
});

router.post('/website', validate(websiteImportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, maxLeads, groupId } = req.body;

    const leads: Array<{
      name: string; email: string; company: string; title: string;
      source: string; websiteUrl: string; tags: string[];
    }> = [];

    const domain = new URL(url).hostname.replace('www.', '');
    for (let i = 0; i < maxLeads; i++) {
      leads.push({
        name: '',
        email: '',
        company: domain,
        title: '',
        source: 'website',
        websiteUrl: url,
        tags: ['website-import', domain],
      });
    }

    const created = await Promise.all(
      leads.map((lead) =>
        prisma.lead.create({
          data: {
            name: lead.name || undefined,
            email: lead.email || undefined,
            company: lead.company || undefined,
            title: lead.title || undefined,
            source: lead.source,
            websiteUrl: lead.websiteUrl || undefined,
            tags: lead.tags,
          },
        }),
      ),
    );

    if (groupId) {
      await prisma.groupMember.createMany({
        data: created.map((l) => ({ leadId: l.id, groupId })),
        skipDuplicates: true,
      });
    }

    for (const lead of created) {
      await prisma.leadTimeline.create({
        data: { leadId: lead.id, action: 'imported', detail: `Imported from website: ${url}` },
      });
      dispatchWebhookEvent('lead.created', { leadId: lead.id, lead });
    }

    res.status(201).json({
      data: { count: created.length, leads: created },
      meta: { note: 'Placeholder — connect real scraper API for full extraction' },
    });
  } catch (err) { next(err); }
});

router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leads } = req.body as { leads: Array<Record<string, string>> };
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      throw AppError.validation('leads array is required');
    }

    const created = await Promise.all(
      leads.map((lead) =>
        prisma.lead.create({
          data: {
            name: lead.name || undefined,
            email: lead.email || undefined,
            phone: lead.phone || undefined,
            company: lead.company || undefined,
            title: lead.title || undefined,
            source: lead.source || 'webhook',
            linkedinUrl: lead.linkedinUrl || undefined,
            websiteUrl: lead.websiteUrl || undefined,
            tags: lead.tags ? (typeof lead.tags === 'string' ? lead.tags.split(',').map((t: string) => t.trim()) : lead.tags) : [],
          },
        }),
      ),
    );

    for (const lead of created) {
      await prisma.leadTimeline.create({
        data: { leadId: lead.id, action: 'imported', detail: `Imported via webhook` },
      });
      dispatchWebhookEvent('lead.created', { leadId: lead.id, lead });
    }

    res.status(201).json({ data: { count: created.length } });
  } catch (err) { next(err); }
});

export default router;
