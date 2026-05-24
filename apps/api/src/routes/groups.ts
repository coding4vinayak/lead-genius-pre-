import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { validate } from '../middleware/validate.js';
import { groupSchema } from '@leadgenius/shared';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.leadGroup.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.leadGroup.findUnique({
      where: { id: (req.params.id as string) },
      include: { _count: { select: { members: true } } },
    });
    if (!data) return res.status(404).json({ error: { code: 404, message: 'Group not found' } });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', validate(groupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.leadGroup.create({ data: req.body });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/:id', validate(groupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.leadGroup.update({ where: { id: (req.params.id as string) }, data: req.body });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.leadGroup.delete({ where: { id: (req.params.id as string) } });
    res.json({ data: { id: (req.params.id as string) } });
  } catch (err) { next(err); }
});

router.get('/:id/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId: (req.params.id as string) },
      include: { lead: true },
    });
    res.json({ data: members.map((m) => (m as any).lead) });
  } catch (err) { next(err); }
});

router.post('/:id/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = req.body as { leadIds: string[] };
    await prisma.groupMember.createMany({
      data: leadIds.map((leadId) => ({ leadId, groupId: (req.params.id as string) })),
      skipDuplicates: true,
    });
    res.status(201).json({ data: { added: leadIds.length } });
  } catch (err) { next(err); }
});

router.delete('/:id/leads/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.groupMember.delete({
      where: { leadId_groupId: { leadId: req.params.leadId as string, groupId: (req.params.id as string) } },
    });
    res.json({ data: { removed: true } });
  } catch (err) { next(err); }
});

export default router;
