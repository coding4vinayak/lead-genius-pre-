import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildAbTest, buildAbTestVariant } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  createTest,
  startTest,
  assignVariant,
  recordResult,
  checkSignificance,
  selectWinner,
  getTestResults,
  listTests,
  getTest,
} = await import('./ab-testing.js');

describe('A/B Testing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTest', () => {
    it('should create a test with variants', async () => {
      const test = buildAbTest();
      const variants = [
        buildAbTestVariant({ name: 'Variant A' }),
        buildAbTestVariant({ name: 'Variant B' }),
      ];
      mockPrisma.abTest.create.mockResolvedValue({ ...test, variants });

      const result = await createTest('seqstep_1', 'Subject Line Test', [
        { name: 'Variant A', subject: 'Hello' },
        { name: 'Variant B', subject: 'Hi there' },
      ]);

      expect(mockPrisma.abTest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sequenceStepId: 'seqstep_1',
          name: 'Subject Line Test',
          status: 'draft',
        }),
        include: { variants: true },
      });
      expect(result.variants).toHaveLength(2);
    });

    it('should reject less than 2 variants', async () => {
      await expect(createTest('seqstep_1', 'Test', [{ name: 'Only One' }]))
        .rejects.toThrow('At least two variants are required');
    });
  });

  describe('startTest', () => {
    it('should start a draft test', async () => {
      const test = buildAbTest({ status: 'draft' });
      const variants = [buildAbTestVariant(), buildAbTestVariant()];
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants });
      mockPrisma.abTest.update.mockResolvedValue({ ...test, status: 'running', startedAt: new Date() });

      const result = await startTest(test.id);

      expect(mockPrisma.abTest.update).toHaveBeenCalledWith({
        where: { id: test.id },
        data: expect.objectContaining({ status: 'running' }),
        include: { variants: true },
      });
      expect(result.status).toBe('running');
    });

    it('should throw if test is not in draft', async () => {
      const test = buildAbTest({ status: 'running' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [] });

      await expect(startTest(test.id)).rejects.toThrow('Test can only be started from draft status');
    });

    it('should throw if test not found', async () => {
      mockPrisma.abTest.findUnique.mockResolvedValue(null);

      await expect(startTest('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('assignVariant', () => {
    it('should assign a variant based on weight', async () => {
      const variantA = buildAbTestVariant({ id: 'va', weight: 70 });
      const variantB = buildAbTestVariant({ id: 'vb', weight: 30 });
      const test = buildAbTest({ status: 'running' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [variantA, variantB] });
      mockPrisma.abTestVariant.update.mockResolvedValue(variantA);

      const result = await assignVariant(test.id, 'lead_1');

      expect(result).toBeDefined();
      expect(mockPrisma.abTestVariant.update).toHaveBeenCalled();
    });

    it('should throw if test is not running', async () => {
      const test = buildAbTest({ status: 'draft' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [] });

      await expect(assignVariant(test.id, 'lead_1')).rejects.toThrow('Test is not running');
    });
  });

  describe('recordResult', () => {
    it('should record an open event', async () => {
      const variant = buildAbTestVariant();
      mockPrisma.abTestVariant.update.mockResolvedValue({ ...variant, openCount: 1 });

      const result = await recordResult(variant.id, 'open');

      expect(mockPrisma.abTestVariant.update).toHaveBeenCalledWith({
        where: { id: variant.id },
        data: { openCount: { increment: 1 } },
      });
      expect(result.openCount).toBe(1);
    });

    it('should record a click event', async () => {
      const variant = buildAbTestVariant();
      mockPrisma.abTestVariant.update.mockResolvedValue({ ...variant, clickCount: 1 });

      await recordResult(variant.id, 'click');

      expect(mockPrisma.abTestVariant.update).toHaveBeenCalledWith({
        where: { id: variant.id },
        data: { clickCount: { increment: 1 } },
      });
    });

    it('should record a reply event', async () => {
      const variant = buildAbTestVariant();
      mockPrisma.abTestVariant.update.mockResolvedValue({ ...variant, replyCount: 1 });

      await recordResult(variant.id, 'reply');

      expect(mockPrisma.abTestVariant.update).toHaveBeenCalledWith({
        where: { id: variant.id },
        data: { replyCount: { increment: 1 } },
      });
    });

    it('should reject invalid metric', async () => {
      await expect(recordResult('v1', 'invalid' as 'open')).rejects.toThrow('Invalid metric');
    });
  });

  describe('checkSignificance', () => {
    it('should report not significant with insufficient data', async () => {
      const variants = [
        buildAbTestVariant({ sentCount: 10, openCount: 5 }),
        buildAbTestVariant({ sentCount: 10, openCount: 3 }),
      ];
      const test = buildAbTest({ status: 'running' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants });

      const result = await checkSignificance(test.id);

      expect(result.significant).toBe(false);
      expect(result.reason).toContain('Insufficient sample size');
    });

    it('should check significance with sufficient data', async () => {
      const variants = [
        buildAbTestVariant({ sentCount: 100, openCount: 50 }),
        buildAbTestVariant({ sentCount: 100, openCount: 20 }),
      ];
      const test = buildAbTest({ status: 'running' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants });

      const result = await checkSignificance(test.id);

      expect(result.significant).toBe(true);
      expect(result.winner).toBeDefined();
    });

    it('should return not significant when no variants have data', async () => {
      const test = buildAbTest({ status: 'running' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [buildAbTestVariant({ sentCount: 0 })] });

      const result = await checkSignificance(test.id);

      expect(result.significant).toBe(false);
    });
  });

  describe('selectWinner', () => {
    it('should select the variant with highest open rate', async () => {
      const variantA = buildAbTestVariant({ id: 'va', sentCount: 100, openCount: 40 });
      const variantB = buildAbTestVariant({ id: 'vb', sentCount: 100, openCount: 60 });
      const test = buildAbTest({ status: 'running' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [variantA, variantB] });
      mockPrisma.abTest.update.mockResolvedValue({ ...test, status: 'completed', winnerVariantId: 'vb' });

      const result = await selectWinner(test.id);

      expect(mockPrisma.abTest.update).toHaveBeenCalledWith({
        where: { id: test.id },
        data: expect.objectContaining({
          status: 'completed',
          winnerVariantId: 'vb',
        }),
        include: { variants: true },
      });
      expect(result.winnerVariantId).toBe('vb');
    });

    it('should throw if test is not running', async () => {
      const test = buildAbTest({ status: 'draft' });
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [] });

      await expect(selectWinner(test.id)).rejects.toThrow('Test must be running to select a winner');
    });
  });

  describe('getTestResults', () => {
    it('should return test with computed rates', async () => {
      const variants = [
        buildAbTestVariant({ sentCount: 100, openCount: 40, clickCount: 10, replyCount: 5 }),
        buildAbTestVariant({ sentCount: 100, openCount: 60, clickCount: 20, replyCount: 8 }),
      ];
      const test = buildAbTest();
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants });

      const result = await getTestResults(test.id);

      expect(result.variants[0].openRate).toBe(40);
      expect(result.variants[1].openRate).toBe(60);
      expect(result.variants[0].clickRate).toBe(10);
      expect(result.variants[1].replyRate).toBe(8);
    });

    it('should throw if test not found', async () => {
      mockPrisma.abTest.findUnique.mockResolvedValue(null);

      await expect(getTestResults('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('listTests', () => {
    it('should list tests with pagination', async () => {
      const tests = [buildAbTest(), buildAbTest()];
      mockPrisma.abTest.findMany.mockResolvedValue(tests);
      mockPrisma.abTest.count.mockResolvedValue(2);

      const result = await listTests(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('getTest', () => {
    it('should return a test by id', async () => {
      const test = buildAbTest();
      mockPrisma.abTest.findUnique.mockResolvedValue({ ...test, variants: [] });

      const result = await getTest(test.id);

      expect(result.id).toBe(test.id);
    });

    it('should throw if not found', async () => {
      mockPrisma.abTest.findUnique.mockResolvedValue(null);

      await expect(getTest('nonexistent')).rejects.toThrow('not found');
    });
  });
});
