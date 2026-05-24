import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';
import { templateSchema } from '@leadgenius/shared';
import Handlebars from 'handlebars';

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

router.post('/:id/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findUnique({ where: { id: (req.params.id as string) } });
    if (!template) return res.status(404).json({ error: { code: 404, message: 'Template not found' } });
    const compiled = Handlebars.compile(template.body);
    const subject = template.subject ? Handlebars.compile(template.subject) : undefined;
    res.json({
      data: {
        body: compiled(req.body.variables || {}),
        subject: subject ? subject(req.body.variables || {}) : undefined,
      },
    });
  } catch (err) { next(err); }
});

export default router;
