import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildWorkspaceMember } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  checkPermission,
  getMemberRole,
  canAccessBilling,
  canModify,
  canDelete,
  canManageMembers,
} = await import('./rbac.js');

describe('RBAC Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkPermission', () => {
    it('should return true if user has sufficient role', async () => {
      const member = buildWorkspaceMember({ role: 'admin' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);

      const result = await checkPermission('user_1', 'ws_1', 'member');
      expect(result).toBe(true);
    });

    it('should return true if user has exact required role', async () => {
      const member = buildWorkspaceMember({ role: 'member' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);

      const result = await checkPermission('user_1', 'ws_1', 'member');
      expect(result).toBe(true);
    });

    it('should return false if user has insufficient role', async () => {
      const member = buildWorkspaceMember({ role: 'viewer' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);

      const result = await checkPermission('user_1', 'ws_1', 'admin');
      expect(result).toBe(false);
    });

    it('should return false if user is not a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      const result = await checkPermission('user_1', 'ws_1', 'viewer');
      expect(result).toBe(false);
    });

    it('should allow owner to access all roles', async () => {
      const member = buildWorkspaceMember({ role: 'owner' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);

      expect(await checkPermission('user_1', 'ws_1', 'owner')).toBe(true);
      expect(await checkPermission('user_1', 'ws_1', 'admin')).toBe(true);
      expect(await checkPermission('user_1', 'ws_1', 'member')).toBe(true);
      expect(await checkPermission('user_1', 'ws_1', 'viewer')).toBe(true);
    });

    it('should not allow viewer to access member role', async () => {
      const member = buildWorkspaceMember({ role: 'viewer' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);

      expect(await checkPermission('user_1', 'ws_1', 'member')).toBe(false);
    });
  });

  describe('getMemberRole', () => {
    it('should return role for member', async () => {
      const member = buildWorkspaceMember({ role: 'admin' });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(member);

      const result = await getMemberRole('user_1', 'ws_1');
      expect(result).toBe('admin');
    });

    it('should return null if not a member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      const result = await getMemberRole('user_1', 'ws_1');
      expect(result).toBeNull();
    });
  });

  describe('canAccessBilling', () => {
    it('should return true for owner', () => {
      expect(canAccessBilling('owner')).toBe(true);
    });

    it('should return false for admin', () => {
      expect(canAccessBilling('admin')).toBe(false);
    });

    it('should return false for member', () => {
      expect(canAccessBilling('member')).toBe(false);
    });

    it('should return false for viewer', () => {
      expect(canAccessBilling('viewer')).toBe(false);
    });
  });

  describe('canModify', () => {
    it('should return true for member and above', () => {
      expect(canModify('owner')).toBe(true);
      expect(canModify('admin')).toBe(true);
      expect(canModify('member')).toBe(true);
    });

    it('should return false for viewer', () => {
      expect(canModify('viewer')).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('should return true for admin and owner', () => {
      expect(canDelete('owner')).toBe(true);
      expect(canDelete('admin')).toBe(true);
    });

    it('should return false for member and viewer', () => {
      expect(canDelete('member')).toBe(false);
      expect(canDelete('viewer')).toBe(false);
    });
  });

  describe('canManageMembers', () => {
    it('should return true for admin and owner', () => {
      expect(canManageMembers('owner')).toBe(true);
      expect(canManageMembers('admin')).toBe(true);
    });

    it('should return false for member and viewer', () => {
      expect(canManageMembers('member')).toBe(false);
      expect(canManageMembers('viewer')).toBe(false);
    });
  });
});
