import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { scoreLead, scoreAllLeads, getLeadScoreFactors } = await import('./lead-scoring.js');

function buildLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead_1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    company: 'Acme Inc',
    title: 'CEO',
    source: 'manual',
    status: 'active',
    stage: 'new',
    tags: ['tech'],
    score: null,
    linkedinUrl: null,
    websiteUrl: null,
    warmupActive: false,
    warmupStep: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    timeline: [],
    _count: { messages: 0, timeline: 0 },
    ...overrides,
  };
}

describe('Lead Scoring Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scoreLead', () => {
    it('should return 0 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);
      const score = await scoreLead('nonexistent');
      expect(score).toBe(0);
    });

    it('should score a lead with basic profile info ~30', async () => {
      const lead = buildLead();
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.lead.update.mockResolvedValue(lead as any);

      const score = await scoreLead('lead_1');
      expect(score).toBeGreaterThanOrEqual(20);
      expect(score).toBeLessThanOrEqual(50);
    });

    it('should boost score for inbound replies', async () => {
      const lead = buildLead({
        messages: [
          { status: 'replied', direction: 'inbound' },
          { status: 'replied', direction: 'inbound' },
          { status: 'replied', direction: 'inbound' },
        ],
      });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.lead.update.mockResolvedValue(lead as any);

      const score = await scoreLead('lead_1');
      expect(score).toBeGreaterThan(30);
    });

    it('should increase score for advanced stages', async () => {
      const lead = buildLead({ stage: 'negotiation' });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.lead.update.mockResolvedValue(lead as any);

      const negotiationScore = await scoreLead('lead_1');

      const lead2 = buildLead({ stage: 'new' });
      mockPrisma.lead.findUnique.mockResolvedValue(lead2);

      const newScore = await scoreLead('lead_1');

      expect(negotiationScore).toBeGreaterThan(newScore);
    });

    it('should give high score for closed_won lead with full data', async () => {
      const lead = buildLead({
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        websiteUrl: 'https://acme.com',
        source: 'referral',
        stage: 'closed_won',
        warmupActive: true,
        messages: [
          { status: 'replied', direction: 'inbound' },
          { status: 'replied', direction: 'inbound' },
          { status: 'replied', direction: 'inbound' },
          { status: 'delivered', direction: 'outbound' },
          { status: 'delivered', direction: 'outbound' },
        ],
        timeline: [{ id: 't1' }, { id: 't2' }, { id: 't3' }, { id: 't4' }],
      });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.lead.update.mockResolvedValue(lead as any);

      const score = await scoreLead('lead_1');
      expect(score).toBeGreaterThanOrEqual(60);
    });

    it('should persist the score to the database', async () => {
      const lead = buildLead();
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.lead.update.mockResolvedValue(lead as any);

      await scoreLead('lead_1');

      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead_1' },
          data: expect.objectContaining({ score: expect.any(Number) }),
        }),
      );
    });
  });

  describe('scoreAllLeads', () => {
    it('should score all leads in batches', async () => {
      mockPrisma.lead.findMany
        .mockResolvedValueOnce([{ id: 'l1' }, { id: 'l2' }])
        .mockResolvedValueOnce([]);
      mockPrisma.lead.findUnique.mockResolvedValue(buildLead());
      mockPrisma.lead.update.mockResolvedValue({} as any);

      const total = await scoreAllLeads(2);

      expect(total).toBe(2);
      expect(mockPrisma.lead.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(2);
    });

    it('should handle empty database', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const total = await scoreAllLeads();

      expect(total).toBe(0);
    });
  });

  describe('getLeadScoreFactors', () => {
    it('should return null for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);
      const result = await getLeadScoreFactors('nonexistent');
      expect(result).toBeNull();
    });

    it('should return factors breakdown', async () => {
      const lead = buildLead({
        source: 'referral',
        messages: [{ status: 'replied', direction: 'inbound' }],
        timeline: [{ id: 't1' }],
      });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const result = await getLeadScoreFactors('lead_1');

      expect(result).not.toBeNull();
      expect(result!.factors).toHaveProperty('completeness');
      expect(result!.factors).toHaveProperty('engagement');
      expect(result!.factors).toHaveProperty('stage');
      expect(result!.factors).toHaveProperty('source');
      expect(result!.factors).toHaveProperty('recency');
      expect(result!.score).toBeGreaterThan(0);
    });
  });
});
