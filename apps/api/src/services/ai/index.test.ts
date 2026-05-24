import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../../test/mockDb.js';
import { buildLead, buildMessage } from '../../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../../db.js', () => ({ prisma: mockPrisma }));

const mockAnalyzeIntent = vi.fn();
const mockGenerateDraft = vi.fn();
const mockEnrichLead = vi.fn();
const mockGenerateCampaign = vi.fn();
vi.mock('./openai.js', () => ({
  analyzeIntent: mockAnalyzeIntent,
  generateDraft: mockGenerateDraft,
  enrichLead: mockEnrichLead,
  generateCampaign: mockGenerateCampaign,
}));

const { analyzeMessageIntent, generateReplyDraft, enrichLeadData, generateCampaignSequence } = await import('./index.js');

describe('AI Service Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeMessageIntent', () => {
    it('should analyze a message and update lead + message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        ...buildMessage({ id: 'msg_1' }),
        lead: buildLead({ id: 'lead_1' }),
      });
      mockAnalyzeIntent.mockResolvedValue({ category: 'interested', confidence: 90 });

      const result = await analyzeMessageIntent('msg_1');

      expect(result.category).toBe('interested');
      expect(mockPrisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg_1' },
          data: expect.objectContaining({ intentAnalysis: expect.any(Object) }),
        }),
      );
      expect(mockPrisma.lead.update).toHaveBeenCalled();
    });

    it('should throw when message not found', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(analyzeMessageIntent('nonexistent')).rejects.toThrow('Message not found');
    });

    it('should skip lead update if lead data missing', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        ...buildMessage({ id: 'msg_2' }),
        lead: null,
      });
      mockAnalyzeIntent.mockResolvedValue({ category: 'spam' });

      const result = await analyzeMessageIntent('msg_2');

      expect(result.category).toBe('spam');
    });
  });

  describe('generateReplyDraft', () => {
    it('should generate draft from message with intent analysis', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        ...buildMessage({ id: 'msg_1', intentAnalysis: { category: 'interested' } as any }),
        lead: buildLead(),
      });
      mockGenerateDraft.mockResolvedValue({ subject: 'Re: Hi', body: 'Thanks!' });

      const result = await generateReplyDraft('msg_1', 'professional');

      expect(result.subject).toBe('Re: Hi');
      expect(mockPrisma.message.update).toHaveBeenCalled();
    });

    it('should use "other" intent category when none exists', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        ...buildMessage(),
        lead: buildLead(),
      });
      mockGenerateDraft.mockResolvedValue({ subject: 'Re:', body: 'OK' });

      await generateReplyDraft('msg_1');

      expect(mockGenerateDraft.mock.calls[0][3]).toBe('other');
    });
  });

  describe('enrichLeadData', () => {
    it('should enrich a lead and add suggested tags', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(buildLead({ id: 'lead_1', tags: ['existing'] }));
      mockEnrichLead.mockResolvedValue({ companySize: '50', industry: 'Tech', suggestedTags: ['tech', 'saas'] });

      const result = await enrichLeadData('lead_1');

      expect(result.companySize).toBe('50');
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(2);
    });

    it('should handle enrichment without suggested tags', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(buildLead({ id: 'lead_1', tags: [] }));
      mockEnrichLead.mockResolvedValue({ companySize: '10' });

      const result = await enrichLeadData('lead_1');

      expect(result.companySize).toBe('10');
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(enrichLeadData('nonexistent')).rejects.toThrow('Lead not found');
    });
  });

  describe('generateCampaignSequence', () => {
    it('should delegate to generateCampaign', async () => {
      mockGenerateCampaign.mockResolvedValue({ steps: [{ subject: 'Step 1' }] });

      const result = await generateCampaignSequence('Camp', 'Tech', 'Product', 'email', 200);

      expect(result.steps).toHaveLength(1);
      expect(mockGenerateCampaign).toHaveBeenCalledWith('Camp', 'Tech', 'Product', 'email', 200);
    });
  });
});
