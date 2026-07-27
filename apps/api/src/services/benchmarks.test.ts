import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildPerformanceBenchmark } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  calculateBenchmarks,
  generateSuggestions,
  getBenchmarks,
} = await import('./benchmarks.js');

describe('Benchmarks Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateBenchmarks', () => {
    it('should calculate benchmarks from message data', async () => {
      mockPrisma.message.count
        .mockResolvedValueOnce(1000)  // total sent
        .mockResolvedValueOnce(800)   // delivered
        .mockResolvedValueOnce(30)    // bounced
        .mockResolvedValueOnce(50);   // replied
      mockPrisma.performanceBenchmark.create.mockResolvedValue(buildPerformanceBenchmark());

      const result = await calculateBenchmarks();

      expect(result).toHaveLength(5);
      expect(result[0].metric).toBe('open_rate');
      expect(result[0].industryAverage).toBe(21.5);
      expect(mockPrisma.performanceBenchmark.create).toHaveBeenCalledTimes(5);
    });

    it('should handle zero sent messages', async () => {
      mockPrisma.message.count.mockResolvedValue(0);
      mockPrisma.performanceBenchmark.create.mockResolvedValue(buildPerformanceBenchmark());

      const result = await calculateBenchmarks();

      expect(result).toHaveLength(5);
      expect(result[0].userValue).toBe(0);
    });
  });

  describe('generateSuggestions', () => {
    it('should return suggestions from existing benchmarks', async () => {
      const benchmarks = [
        buildPerformanceBenchmark({ metric: 'open_rate', suggestions: ['Improve subject lines'] }),
        buildPerformanceBenchmark({ metric: 'reply_rate', suggestions: ['Add clearer CTAs'] }),
      ];
      mockPrisma.performanceBenchmark.findMany.mockResolvedValue(benchmarks);

      const result = await generateSuggestions();

      expect(result.suggestions).toContain('Improve subject lines');
      expect(result.suggestions).toContain('Add clearer CTAs');
      expect(result.benchmarks).toHaveLength(2);
    });

    it('should return default suggestions when no benchmarks exist', async () => {
      mockPrisma.performanceBenchmark.findMany.mockResolvedValue([]);

      const result = await generateSuggestions();

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.benchmarks).toHaveLength(0);
    });
  });

  describe('getBenchmarks', () => {
    it('should return existing benchmarks', async () => {
      const benchmarks = [buildPerformanceBenchmark(), buildPerformanceBenchmark()];
      mockPrisma.performanceBenchmark.findMany.mockResolvedValue(benchmarks);

      const result = await getBenchmarks();

      expect(result).toHaveLength(2);
    });

    it('should calculate fresh benchmarks when none exist', async () => {
      mockPrisma.performanceBenchmark.findMany.mockResolvedValue([]);
      mockPrisma.message.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(400)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(30);
      mockPrisma.performanceBenchmark.create.mockResolvedValue(buildPerformanceBenchmark());

      const result = await getBenchmarks();

      expect(result).toHaveLength(5);
    });
  });
});
