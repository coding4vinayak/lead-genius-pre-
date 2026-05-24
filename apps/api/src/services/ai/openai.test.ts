import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../../test/mockDb.js';
import { buildAgentSettings } from '../../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../../db.js', () => ({ prisma: mockPrisma }));

let mockCreate: ReturnType<typeof vi.fn>;

vi.mock('openai', () => {
  mockCreate = vi.fn();
  return {
    default: vi.fn(function () {
      return { chat: { completions: { create: mockCreate } } };
    }),
  };
});

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn(() => '{"category":"interested"}') },
  readFileSync: vi.fn(() => '{"category":"interested"}'),
}));

const { analyzeIntent, generateDraft, enrichLead, generateCampaign } = await import('./openai.js');

describe('AI OpenAI service', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    vi.clearAllMocks();
    mockPrisma.agentSettings.findUnique.mockResolvedValue(buildAgentSettings());
    mockCreate.mockReset();
  });

  describe('analyzeIntent', () => {
    it('should return parsed JSON from AI response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"category":"interested","confidence":85}' } }],
      });

      const result = await analyzeIntent('John', 'Acme', 'Hello', 'Body');

      expect(result.category).toBe('interested');
      expect(result.confidence).toBe(85);
    });

    it('should return fallback on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API down'));

      const result = await analyzeIntent('John', null, null, 'Body');

      expect(result.category).toBe('other');
    });

    it('should handle empty input gracefully', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"category":"spam"}' } }],
      });

      const result = await analyzeIntent('', null, null, '');
      expect(result.category).toBe('spam');
    });
  });

  describe('generateDraft', () => {
    it('should generate draft reply from AI', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"subject":"Re: Hello","body":"Thanks!"}' } }],
      });

      const result = await generateDraft('John', 'Acme', 'Msg', 'interested', 'professional');

      expect(result.subject).toBe('Re: Hello');
      expect(result.body).toBe('Thanks!');
    });

    it('should return fallback draft on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API down'));

      const result = await generateDraft('John', null, 'Msg', 'interested');
      expect(result.body).toContain('Thank you');
    });
  });

  describe('enrichLead', () => {
    it('should enrich lead data from AI', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"companySize":"50-200"}' } }],
      });

      const result = await enrichLead('John', 'john@test.com', 'Acme', 'CEO', 'manual');
      expect(result.companySize).toBe('50-200');
    });

    it('should return empty object on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API down'));

      const result = await enrichLead('John', null, null, null, null);
      expect(result).toEqual({});
    });
  });

  describe('generateCampaign', () => {
    it('should generate campaign sequence from AI', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"steps":[{"subject":"Step 1"}]}' } }],
      });

      const result = await generateCampaign('Q1', 'Tech', 'SaaS', 'email', 100);
      expect(result.steps).toHaveLength(1);
    });

    it('should return empty steps on API error', async () => {
      mockCreate.mockRejectedValue(new Error('API down'));

      const result = await generateCampaign('X', null, null, 'email', 100);
      expect(result.steps).toEqual([]);
    });
  });
});
