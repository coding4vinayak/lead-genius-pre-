import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';
import { templateSchema, spamCheckContentSchema, templatePreviewEnhancedSchema } from '@leadgenius/shared';
import Handlebars from 'handlebars';
import { calculateSpamScore } from '../services/spam-checker.js';
import { extractLinks, validateLinks } from '../services/link-validator.js';
import { generatePreview } from '../services/email-preview.js';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel, category } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;
    if (category) where.category = category;
    const data = await prisma.template.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.template.findUnique({ where: { id: (req.params.id as string) } });
    if (!data) return res.status(404).json({ error: { code: 404, message: 'Template not found' } });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(templateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.template.create({ data: req.body });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(templateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.template.update({ where: { id: (req.params.id as string) }, data: req.body });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.template.delete({ where: { id: (req.params.id as string) } });
    res.json({ data: { id: (req.params.id as string) } });
  } catch (err) { next(err); }
});

router.post('/spam-check-content', validate(spamCheckContentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subject, body } = req.body;
    const result = calculateSpamScore(subject || '', body);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/:id/preview', validate(templatePreviewEnhancedSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findUnique({ where: { id: (req.params.id as string) } });
    if (!template) return res.status(404).json({ error: { code: 404, message: 'Template not found' } });

    const variables = req.body.variables || {};
    const device = req.body.device || 'desktop';

    const compiled = Handlebars.compile(template.body);
    const subjectCompiled = template.subject ? Handlebars.compile(template.subject) : undefined;

    const renderedBody = compiled(variables);
    const renderedSubject = subjectCompiled ? subjectCompiled(variables) : undefined;

    const preview = generatePreview(renderedBody, {}, device);

    res.json({
      data: {
        body: renderedBody,
        subject: renderedSubject,
        html: preview.html,
        plainText: preview.plainText,
        estimatedSize: preview.estimatedSize,
        device,
      },
    });
  } catch (err) { next(err); }
});

router.post('/:id/spam-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findUnique({ where: { id: (req.params.id as string) } });
    if (!template) return res.status(404).json({ error: { code: 404, message: 'Template not found' } });

    const result = calculateSpamScore(template.subject || '', template.body);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/:id/link-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findUnique({ where: { id: (req.params.id as string) } });
    if (!template) return res.status(404).json({ error: { code: 404, message: 'Template not found' } });

    const links = extractLinks(template.body);
    const results = validateLinks(links);
    res.json({ data: results });
  } catch (err) { next(err); }
});

export default router;
