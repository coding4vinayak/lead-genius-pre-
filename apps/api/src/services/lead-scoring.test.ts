import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('./event-bus.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../queue/index.js', () => ({
  eventQueue: { add: vi.fn() },
}));

const { updateLeadScore, evaluateStageProgression, handleScoringEvent } = await import('./lead-scoring.js');
const { publishEvent } = await import('./event-bus.js');

describe('Lead Scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateLeadScore', () => {
    it('should update score with default open delta (+5)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 10 });
      mockPrisma.lead.update.mockResolvedValue({ score: 15 });

      const result = await updateLeadScore('lead_1', 'open');

      expect(result).toBe(15);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead_1' },
        data: { score: 15 },
      });
    });

    it('should update score with default click delta (+10)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 20 });
      mockPrisma.lead.update.mockResolvedValue({ score: 30 });

      const result = await updateLeadScore('lead_1', 'click');

      expect(result).toBe(30);
    });

    it('should update score with default reply delta (+25)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 30 });
      mockPrisma.lead.update.mockResolvedValue({ score: 55 });

      const result = await updateLeadScore('lead_1', 'reply');

      expect(result).toBe(55);
    });

    it('should update score with default bounce delta (-10)', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 20 });
      mockPrisma.lead.update.mockResolvedValue({ score: 10 });

      const result = await updateLeadScore('lead_1', 'bounce');

      expect(result).toBe(10);
    });

    it('should use custom delta when provided', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 10 });
      mockPrisma.lead.update.mockResolvedValue({ score: 30 });

      const result = await updateLeadScore('lead_1', 'open', 20);

      expect(result).toBe(30);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead_1' },
        data: { score: 30 },
      });
    });

    it('should not go below 0', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 5 });
      mockPrisma.lead.update.mockResolvedValue({ score: 0 });

      const result = await updateLeadScore('lead_1', 'bounce');

      expect(result).toBe(0);
      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead_1' },
        data: { score: 0 },
      });
    });

    it('should treat null score as 0', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: null });
      mockPrisma.lead.update.mockResolvedValue({ score: 5 });

      const result = await updateLeadScore('lead_1', 'open');

      expect(result).toBe(5);
    });
  });

  describe('evaluateStageProgression', () => {
    it('should advance to contacted at score >= 10', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 10, stage: 'new' });
      mockPrisma.lead.update.mockResolvedValue({});

      const result = await evaluateStageProgression('lead_1');

      expect(result).toBe('contacted');
      expect(mockPrisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead_1' },
        data: { stage: 'contacted' },
      });
      expect(publishEvent).toHaveBeenCalledWith(
        'lead.stage_changed', 'lead', 'lead_1',
        expect.objectContaining({ previousStage: 'new', newStage: 'contacted' }),
      );
    });

    it('should advance to engaged at score >= 30', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 35, stage: 'contacted' });
      mockPrisma.lead.update.mockResolvedValue({});

      const result = await evaluateStageProgression('lead_1');

      expect(result).toBe('engaged');
    });

    it('should advance to warm at score >= 50', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 55, stage: 'engaged' });
      mockPrisma.lead.update.mockResolvedValue({});

      const result = await evaluateStageProgression('lead_1');

      expect(result).toBe('warm');
    });

    it('should advance to hot at score >= 80', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 85, stage: 'warm' });
      mockPrisma.lead.update.mockResolvedValue({});

      const result = await evaluateStageProgression('lead_1');

      expect(result).toBe('hot');
    });

    it('should return null if stage has not changed', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 55, stage: 'warm' });

      const result = await evaluateStageProgression('lead_1');

      expect(result).toBeNull();
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it('should return null if lead not found', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const result = await evaluateStageProgression('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle stage regression when score drops', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({ score: 5, stage: 'contacted' });
      mockPrisma.lead.update.mockResolvedValue({});

      const result = await evaluateStageProgression('lead_1');

      expect(result).toBe('new');
    });
  });

  describe('handleScoringEvent', () => {
    it('should update score and evaluate stage progression', async () => {
      // updateLeadScore
      mockPrisma.lead.findUnique
        .mockResolvedValueOnce({ score: 25 }) // for updateLeadScore
        .mockResolvedValueOnce({ score: 30, stage: 'contacted' }); // for evaluateStageProgression
      mockPrisma.lead.update.mockResolvedValue({});

      const result = await handleScoringEvent('lead_1', 'open');

      expect(result.score).toBe(30);
      expect(result.stage).toBe('engaged');
    });

    it('should return null stage when no progression', async () => {
      mockPrisma.lead.findUnique
        .mockResolvedValueOnce({ score: 0 }) // for updateLeadScore
        .mockResolvedValueOnce({ score: 5, stage: 'new' }); // for evaluateStageProgression
      mockPrisma.lead.update.mockResolvedValue({});

      const result = await handleScoringEvent('lead_1', 'open');

      expect(result.score).toBe(5);
      expect(result.stage).toBeNull();
    });
  });
});
