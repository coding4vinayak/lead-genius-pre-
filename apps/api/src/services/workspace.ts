import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import crypto from 'crypto';

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  plan?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
  physicalAddress?: string;
}

export async function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  const existing = await prisma.workspace.findUnique({ where: { slug: input.slug } });
  if (existing) throw AppError.conflict('Workspace with this slug already exists');

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      slug: input.slug,
      plan: (input.plan as 'free' | 'pro' | 'enterprise') ?? 'free',
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId,
      role: 'owner',
      joinedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { currentWorkspaceId: workspace.id },
  });

  return workspace;
}

export async function getWorkspace(id: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) throw AppError.notFound('Workspace');
  return workspace;
}

export async function updateWorkspace(id: string, input: UpdateWorkspaceInput) {
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) throw AppError.notFound('Workspace');

  if (input.slug && input.slug !== workspace.slug) {
    const slugTaken = await prisma.workspace.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw AppError.conflict('Workspace slug already taken');
  }

  return prisma.workspace.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.physicalAddress !== undefined && { physicalAddress: input.physicalAddress }),
    },
  });
}

export async function listWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

export async function switchWorkspace(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) throw AppError.notFound('WorkspaceMember');

  await prisma.user.update({
    where: { id: userId },
    data: { currentWorkspaceId: workspaceId },
  });

  return { workspaceId };
}

export async function inviteMember(workspaceId: string, email: string, role: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace');

  const existingInvite = await prisma.workspaceInvite.findFirst({
    where: { workspaceId, email },
  });
  if (existingInvite) throw AppError.conflict('Invite already exists for this email');

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    });
    if (existingMember) throw AppError.conflict('User is already a member of this workspace');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return prisma.workspaceInvite.create({
    data: {
      workspaceId,
      email,
      role: role as 'owner' | 'admin' | 'member' | 'viewer',
      token,
      expiresAt,
    },
  });
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await prisma.workspaceInvite.findUnique({ where: { token } });
  if (!invite) throw AppError.notFound('WorkspaceInvite');

  if (new Date() > invite.expiresAt) {
    throw AppError.validation('Invite has expired');
  }

  const existingMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
  });
  if (existingMember) throw AppError.conflict('Already a member of this workspace');

  const member = await prisma.workspaceMember.create({
    data: {
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      joinedAt: new Date(),
    },
  });

  await prisma.workspaceInvite.delete({ where: { id: invite.id } });

  return member;
}

export async function removeMember(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) throw AppError.notFound('WorkspaceMember');
  if (member.role === 'owner') throw AppError.validation('Cannot remove workspace owner');

  return prisma.workspaceMember.delete({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function updateMemberRole(workspaceId: string, userId: string, role: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) throw AppError.notFound('WorkspaceMember');
  if (member.role === 'owner') throw AppError.validation('Cannot change owner role');

  return prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role: role as 'owner' | 'admin' | 'member' | 'viewer' },
  });
}

export async function getMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
}
