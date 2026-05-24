import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { whatsAppTemplateSchema } from '@leadgenius/shared';

const router = Router();

// GET /api/whatsapp-templates - list WhatsApp templates
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.whatsAppTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/whatsapp-templates - create WhatsApp template
router.post('/', validate(whatsAppTemplateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.whatsAppTemplate.create({ data: req.body as never });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PUT /api/whatsapp-templates/:id - update WhatsApp template
router.put('/:id', validate(whatsAppTemplateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.whatsAppTemplate.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('WhatsApp template');

    const data = await prisma.whatsAppTemplate.update({
      where: { id },
      data: req.body as never,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/whatsapp-templates/:id - delete WhatsApp template
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.whatsAppTemplate.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('WhatsApp template');

    await prisma.whatsAppTemplate.delete({ where: { id } });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
});

export default router;
