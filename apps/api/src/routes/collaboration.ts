import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { leadNoteSchema, leadAssignSchema, assignmentRuleSchema, paginationSchema } from '@leadgenius/shared';
import { createNote, getNotes, updateNote, deleteNote } from '../services/lead-notes.js';
import { getActivityFeed } from '../services/lead-activity.js';
import { assignLead, autoAssignLead } from '../services/lead-assignment.js';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

const router = Router();

// Notes
router.post('/leads/:id/notes', validate(leadNoteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.id as string;
    const authorId = req.user!.userId;
    const { body } = req.body;
    const note = await createNote(leadId, authorId, body);
    res.status(201).json({ data: note });
  } catch (err) { next(err); }
});

router.get('/leads/:id/notes', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.id as string;
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const result = await getNotes(leadId, page, pageSize);
    res.json(result);
  } catch (err) { next(err); }
});

router.put('/notes/:id', validate(leadNoteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const noteId = req.params.id as string;
    const authorId = req.user!.userId;
    const { body } = req.body;
    const note = await updateNote(noteId, authorId, body);
    res.json({ data: note });
  } catch (err) { next(err); }
});

router.delete('/notes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const noteId = req.params.id as string;
    const authorId = req.user!.userId;
    await deleteNote(noteId, authorId);
    res.json({ data: { id: noteId } });
  } catch (err) { next(err); }
});

// Activity Feed
router.get('/leads/:id/activity', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.id as string;
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const result = await getActivityFeed(leadId, page, pageSize);
    res.json(result);
  } catch (err) { next(err); }
});

// Assignment
router.post('/leads/:id/assign', validate(leadAssignSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.id as string;
    const { userId } = req.body;
    const lead = await assignLead(leadId, userId);
    res.json({ data: lead });
  } catch (err) { next(err); }
});

router.post('/leads/:id/auto-assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = req.params.id as string;
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const workspaceId = user?.currentWorkspaceId;
    if (!workspaceId) throw AppError.validation('No workspace selected');
    const lead = await autoAssignLead(leadId, workspaceId);
    if (!lead) throw AppError.validation('No assignment rule matched');
    res.json({ data: lead });
  } catch (err) { next(err); }
});

// Assignment Rules
router.get('/assignment-rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const workspaceId = user?.currentWorkspaceId;
    if (!workspaceId) throw AppError.validation('No workspace selected');
    const data = await prisma.assignmentRule.findMany({
      where: { workspaceId },
      orderBy: { priority: 'asc' },
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/assignment-rules', validate(assignmentRuleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const workspaceId = user?.currentWorkspaceId;
    if (!workspaceId) throw AppError.validation('No workspace selected');
    const data = await prisma.assignmentRule.create({
      data: { ...req.body, workspaceId },
    });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put('/assignment-rules/:id', validate(assignmentRuleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = await prisma.assignmentRule.update({
      where: { id },
      data: req.body,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete('/assignment-rules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.assignmentRule.delete({ where: { id } });
    res.json({ data: { id } });
  } catch (err) { next(err); }
});

export default router;
