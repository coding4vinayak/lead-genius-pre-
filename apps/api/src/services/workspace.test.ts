import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWorkspace, buildWorkspaceMember, buildWorkspaceInvite } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  listWorkspaces,
  switchWorkspace,
  inviteMember,
  acceptInvite,
  removeMember,
  updateMemberRole,
  getMembers,
} = await import('./workspace.js');

describe('Workspace Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createWorkspace', () => {
    it('should create a workspace and add owner', async () => {
      const workspace = buildWorkspace();
      const member = buildWorkspaceMember({ role: 'owner' });
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue(workspace);
      mockPrisma.workspaceMember.create.mockResolvedValue(member);
      mockPrisma.user.update.mockResolvedValue({ id: 'user_1' });

      const result = await createWorkspace('user_1', { name: 'My Workspace', slug: 'my-workspace' });

      expect(result).toEqual(workspace);
      expect(mockPrisma.workspace.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'My Workspace', slug: 'my-workspace', plan: 'free' }),
      });
      expect(mockPrisma.workspaceMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: 'owner' }),
      });
    });

    it('should throw conflict if slug already exists', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(buildWorkspace());

      await expect(createWorkspace('user_1', { name: 'Test', slug: 'test-workspace' })).rejects.toThrow('already exists');
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace by id', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);

      const result = await getWorkspace(workspace.id);
      expect(result).toEqual(workspace);
    });

    it('should throw not found for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(getWorkspace('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace name', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspace.update.mockResolvedValue({ ...workspace, name: 'Updated' });

      const result = await updateWorkspace(workspace.id, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw not found for nonexistent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(updateWorkspace('nonexistent', { name: 'Test' })).rejects.toThrow('not found');
    });

    it('should throw conflict if slug is taken', async () => {
      const workspace = buildWorkspace({ slug: 'original' });
      mockPrisma.workspace.findUnique
        .mockResolvedValueOnce(workspace) // first call: find workspace by id
        .mockResolvedValueOnce(buildWorkspace({ slug: 'taken' })); // second call: find by slug

      await expect(updateWorkspace(workspace.id, { slug: 'taken' })).rejects.toThrow('already taken');
    });
  });

  describe('listWorkspaces', () => {
    it('should return workspaces for user', async () => {
      const workspace = buildWorkspace();
      const member = buildWorkspaceMember({ workspace, role: 'owner' });
      mockPrisma.workspaceMember.findMany.mockResolvedValue([member]);

      const result = await listWorkspaces('user_1');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('owner');
    });
  });

  describe('switchWorkspace', () => {
    it('should switch workspace for user', async () => {
      const member = buildWorkspaceMember();
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);
      mockPrisma.user.update.mockResolvedValue({ id: 'user_1' });

      const result = await switchWorkspace('user_1', 'ws_1');
      expect(result.workspaceId).toBe('ws_1');
    });

    it('should throw not found if not a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(switchWorkspace('user_1', 'ws_1')).rejects.toThrow('not found');
    });
  });

  describe('inviteMember', () => {
    it('should create an invite', async () => {
      const workspace = buildWorkspace();
      const invite = buildWorkspaceInvite();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspaceInvite.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.workspaceInvite.create.mockResolvedValue(invite);

      const result = await inviteMember(workspace.id, 'invited@example.com', 'member');
      expect(result).toEqual(invite);
    });

    it('should throw conflict if invite already exists', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspaceInvite.findFirst.mockResolvedValue(buildWorkspaceInvite());

      await expect(inviteMember(workspace.id, 'invited@example.com', 'member')).rejects.toThrow('already exists');
    });

    it('should throw not found if workspace does not exist', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);

      await expect(inviteMember('nonexistent', 'test@example.com', 'member')).rejects.toThrow('not found');
    });

    it('should throw conflict if user is already a member', async () => {
      const workspace = buildWorkspace();
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace);
      mockPrisma.workspaceInvite.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user_2', email: 'test@example.com' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(buildWorkspaceMember());

      await expect(inviteMember(workspace.id, 'test@example.com', 'member')).rejects.toThrow('already a member');
    });
  });

  describe('acceptInvite', () => {
    it('should accept invite and create membership', async () => {
      const invite = buildWorkspaceInvite({ expiresAt: new Date(Date.now() + 86400000) });
      const member = buildWorkspaceMember();
      mockPrisma.workspaceInvite.findUnique.mockResolvedValue(invite);
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
      mockPrisma.workspaceMember.create.mockResolvedValue(member);
      mockPrisma.workspaceInvite.delete.mockResolvedValue(invite);

      const result = await acceptInvite(invite.token, 'user_2');
      expect(result).toEqual(member);
    });

    it('should throw not found for invalid token', async () => {
      mockPrisma.workspaceInvite.findUnique.mockResolvedValue(null);

      await expect(acceptInvite('invalid_token', 'user_1')).rejects.toThrow('not found');
    });

    it('should throw if invite has expired', async () => {
      const invite = buildWorkspaceInvite({ expiresAt: new Date('2020-01-01') });
      mockPrisma.workspaceInvite.findUnique.mockResolvedValue(invite);

      await expect(acceptInvite(invite.token, 'user_1')).rejects.toThrow('expired');
    });

    it('should throw conflict if already a member', async () => {
      const invite = buildWorkspaceInvite({ expiresAt: new Date(Date.now() + 86400000) });
      mockPrisma.workspaceInvite.findUnique.mockResolvedValue(invite);
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(buildWorkspaceMember());

      await expect(acceptInvite(invite.token, 'user_1')).rejects.toThrow('Already a member');
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      const member = buildWorkspaceMember({ role: 'member' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);
      mockPrisma.workspaceMember.delete.mockResolvedValue(member);

      const result = await removeMember('ws_1', 'user_1');
      expect(result).toEqual(member);
    });

    it('should throw not found if not a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(removeMember('ws_1', 'user_1')).rejects.toThrow('not found');
    });

    it('should throw if trying to remove owner', async () => {
      const member = buildWorkspaceMember({ role: 'owner' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);

      await expect(removeMember('ws_1', 'user_1')).rejects.toThrow('Cannot remove workspace owner');
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const member = buildWorkspaceMember({ role: 'member' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);
      mockPrisma.workspaceMember.update.mockResolvedValue({ ...member, role: 'admin' });

      const result = await updateMemberRole('ws_1', 'user_1', 'admin');
      expect(result.role).toBe('admin');
    });

    it('should throw not found if not a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(updateMemberRole('ws_1', 'user_1', 'admin')).rejects.toThrow('not found');
    });

    it('should throw if trying to change owner role', async () => {
      const member = buildWorkspaceMember({ role: 'owner' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);

      await expect(updateMemberRole('ws_1', 'user_1', 'admin')).rejects.toThrow('Cannot change owner role');
    });
  });

  describe('getMembers', () => {
    it('should return workspace members', async () => {
      const members = [
        buildWorkspaceMember({ role: 'owner', user: { id: 'user_1', email: 'owner@test.com', name: 'Owner' } }),
        buildWorkspaceMember({ role: 'member', user: { id: 'user_2', email: 'member@test.com', name: 'Member' } }),
      ];
      mockPrisma.workspaceMember.findMany.mockResolvedValue(members);

      const result = await getMembers('ws_1');
      expect(result).toHaveLength(2);
    });
  });
});
