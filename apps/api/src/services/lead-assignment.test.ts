import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildWorkspaceMember, buildAssignmentRule } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('./notification.js', () => ({ createNotification: vi.fn().mockResolvedValue({}) }));
vi.mock('./websocket.js', () => ({ broadcastToUser: vi.fn() }));

const { assignLead, autoAssignLead, roundRobinAssign, territoryAssign, loadBalancedAssign } = await import('./lead-assignment.js');

describe('Lead Assignment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assignLead', () => {
    it('should assign a lead to a user', async () => {
      const lead = buildLead({ assignedToId: 'user_1' });
      mockPrisma.lead.update.mockResolvedValue(lead);
      mockPrisma.leadActivity.create.mockResolvedValue({});

      const result = await assignLead('lead_1', 'user_1');

      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead_1' },
        data: { assignedToId: 'user_1' },
      });
      expect(result).toEqual(lead);
    });
  });

  describe('roundRobinAssign', () => {
    it('should cycle through members', async () => {
      const members = [
        buildWorkspaceMember({ userId: 'user_a' }),
        buildWorkspaceMember({ userId: 'user_b' }),
        buildWorkspaceMember({ userId: 'user_c' }),
      ];
      mockPrisma.workspaceMember.findMany.mockResolvedValue(members);
      mockPrisma.assignmentRule.update.mockResolvedValue({});

      const result1 = await roundRobinAssign('ws_1', 'rule_1', { lastIndex: -1 });
      expect(result1).toBe('user_a');

      const result2 = await roundRobinAssign('ws_1', 'rule_1', { lastIndex: 0 });
      expect(result2).toBe('user_b');

      const result3 = await roundRobinAssign('ws_1', 'rule_1', { lastIndex: 2 });
      expect(result3).toBe('user_a');
    });

    it('should return null for empty workspace', async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([]);

      const result = await roundRobinAssign('ws_1');
      expect(result).toBeNull();
    });
  });

  describe('territoryAssign', () => {
    it('should match by country', async () => {
      const lead = buildLead({ customFields: { country: 'US' } });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const config = {
        territories: [
          { country: 'US', userId: 'user_us' },
          { country: 'UK', userId: 'user_uk' },
        ],
      };

      const result = await territoryAssign('lead_1', 'ws_1', config);
      expect(result).toBe('user_us');
    });

    it('should match by company', async () => {
      const lead = buildLead({ company: 'Acme Corp', customFields: {} });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const config = {
        territories: [
          { company: 'Acme', userId: 'user_acme' },
        ],
      };

      const result = await territoryAssign('lead_1', 'ws_1', config);
      expect(result).toBe('user_acme');
    });

    it('should return null when no territory matches', async () => {
      const lead = buildLead({ company: 'Other Inc', customFields: {} });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const config = {
        territories: [
          { country: 'UK', userId: 'user_uk' },
        ],
      };

      const result = await territoryAssign('lead_1', 'ws_1', config);
      expect(result).toBeNull();
    });
  });

  describe('loadBalancedAssign', () => {
    it('should assign to member with fewest active leads', async () => {
      const members = [
        buildWorkspaceMember({ userId: 'user_a' }),
        buildWorkspaceMember({ userId: 'user_b' }),
      ];
      mockPrisma.workspaceMember.findMany.mockResolvedValue(members);
      mockPrisma.lead.count
        .mockResolvedValueOnce(5) // user_a has 5
        .mockResolvedValueOnce(2); // user_b has 2

      const result = await loadBalancedAssign('ws_1');
      expect(result).toBe('user_b');
    });

    it('should return null for empty workspace', async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([]);

      const result = await loadBalancedAssign('ws_1');
      expect(result).toBeNull();
    });
  });

  describe('autoAssignLead', () => {
    it('should use first matching rule', async () => {
      const rule = buildAssignmentRule({ type: 'round_robin', config: { lastIndex: -1 } });
      mockPrisma.assignmentRule.findMany.mockResolvedValue([rule]);

      const members = [buildWorkspaceMember({ userId: 'user_x' })];
      mockPrisma.workspaceMember.findMany.mockResolvedValue(members);
      mockPrisma.assignmentRule.update.mockResolvedValue({});

      const lead = buildLead({ assignedToId: 'user_x' });
      mockPrisma.lead.update.mockResolvedValue(lead);
      mockPrisma.leadActivity.create.mockResolvedValue({});

      const result = await autoAssignLead('lead_1', 'ws_1');
      expect(result).toEqual(lead);
    });

    it('should return null when no rules exist', async () => {
      mockPrisma.assignmentRule.findMany.mockResolvedValue([]);

      const result = await autoAssignLead('lead_1', 'ws_1');
      expect(result).toBeNull();
    });
  });
});
