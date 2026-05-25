import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export async function checkPermission(userId: string, workspaceId: string, requiredRole: string): Promise<boolean> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!member) return false;

  const userLevel = ROLE_HIERARCHY[member.role] ?? -1;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 999;

  return userLevel >= requiredLevel;
}

export async function getMemberRole(userId: string, workspaceId: string): Promise<string | null> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  return member?.role ?? null;
}

export function requireRole(requiredRole: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
      return next(new AppError(401, 'Authentication required'));
    }

    const workspaceId = req.params.id || req.params.workspaceId || req.body?.workspaceId;
    if (!workspaceId) {
      return next(new AppError(400, 'Workspace ID is required'));
    }

    const hasPermission = await checkPermission(userId, workspaceId, requiredRole);
    if (!hasPermission) {
      return next(new AppError(403, 'Insufficient permissions'));
    }

    next();
  };
}

export function canAccessBilling(role: string): boolean {
  return role === 'owner';
}

export function canModify(role: string): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['member'];
}

export function canDelete(role: string): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['admin'];
}

export function canManageMembers(role: string): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['admin'];
}
