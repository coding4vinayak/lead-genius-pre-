import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

/**
 * Middleware that verifies the authenticated user is a member of the workspace
 * specified in the x-workspace-id header. Must be used after requireAuth.
 */
export async function requireWorkspaceMembership(req: Request, _res: Response, next: NextFunction) {
  const userId = req.user?.userId;
  if (!userId) {
    return next(new AppError(401, 'Authentication required'));
  }

  const workspaceId = req.headers['x-workspace-id'] as string || req.body?.workspaceId || req.params.id;
  if (!workspaceId) {
    return next(new AppError(400, 'Workspace ID is required'));
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!member) {
    return next(new AppError(403, 'Not a member of this workspace'));
  }

  next();
}
