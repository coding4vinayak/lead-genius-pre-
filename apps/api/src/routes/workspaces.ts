import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { workspaceSchema, workspaceUpdateSchema, workspaceInviteSchema, switchWorkspaceSchema } from '@leadgenius/shared';
import {
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  listWorkspaces,
  switchWorkspace,
  inviteMember,
  getMembers,
  removeMember,
} from '../services/workspace.js';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const workspaces = await listWorkspaces(userId);
    res.json({ data: workspaces });
  } catch (err) { next(err); }
});

router.post('/', validate(workspaceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const workspace = await createWorkspace(userId, req.body);
    res.status(201).json({ data: workspace });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const workspace = await getWorkspace(id);
    res.json({ data: workspace });
  } catch (err) { next(err); }
});

router.put('/:id', validate(workspaceUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const workspace = await updateWorkspace(id, req.body);
    res.json({ data: workspace });
  } catch (err) { next(err); }
});

router.post('/:id/invite', validate(workspaceInviteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { email, role } = req.body as { email: string; role: string };
    const invite = await inviteMember(id, email, role);
    res.status(201).json({ data: invite });
  } catch (err) { next(err); }
});

router.get('/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const members = await getMembers(id);
    res.json({ data: members });
  } catch (err) { next(err); }
});

router.delete('/:id/members/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    await removeMember(id, userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/switch', validate(switchWorkspaceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { workspaceId } = req.body as { workspaceId: string };
    const result = await switchWorkspace(userId, workspaceId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
