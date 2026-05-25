import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSequence, buildSequenceEnrollment, buildLead } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  getSequenceFunnel,
  getCohortAnalysis,
  getRevenueAttribution,
  exportAnalyticsCSV,
} = await import('./advanced-analytics.js');

describe('Advanced Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSequenceFunnel', () => {
    it('should return funnel data for a sequence', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.count
        .mockResolvedValueOnce(100) // enrolled
        .mockResolvedValueOnce(30)  // completed
        .mockResolvedValueOnce(10); // exited
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ leadId: 'lead_1' }),
        buildSequenceEnrollment({ leadId: 'lead_2' }),
      ]);
      mockPrisma.message.count
        .mockResolvedValueOnce(60)  // opened (delivered)
        .mockResolvedValueOnce(30)  // clicked (delivered)
        .mockResolvedValueOnce(15); // replied
      mockPrisma.sequenceEnrollment.count.mockResolvedValueOnce(30); // converted

      const result = await getSequenceFunnel(sequence.id);

      expect(result.sequenceId).toBe(sequence.id);
      expect(result.funnel.enrolled).toBe(100);
      expect(result.rates).toBeDefined();
    });

    it('should throw if sequence not found', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      await expect(getSequenceFunnel('nonexistent')).rejects.toThrow('not found');
    });

    it('should handle zero enrollments', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.message.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.sequenceEnrollment.count.mockResolvedValueOnce(0);

      const result = await getSequenceFunnel(sequence.id);

      expect(result.funnel.enrolled).toBe(0);
      expect(result.rates.openRate).toBe(0);
    });
  });

  describe('getCohortAnalysis', () => {
    it('should group enrollments by week', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ createdAt: new Date('2025-01-06T00:00:00Z'), status: 'completed' }),
        buildSequenceEnrollment({ createdAt: new Date('2025-01-07T00:00:00Z'), status: 'active' }),
        buildSequenceEnrollment({ createdAt: new Date('2025-01-13T00:00:00Z'), status: 'exited' }),
      ]);

      const result = await getCohortAnalysis(sequence.id, 'week');

      expect(result.sequenceId).toBe(sequence.id);
      expect(result.period).toBe('week');
      expect(result.cohorts.length).toBeGreaterThan(0);
    });

    it('should group enrollments by month', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ createdAt: new Date('2025-01-15T00:00:00Z'), status: 'completed' }),
        buildSequenceEnrollment({ createdAt: new Date('2025-02-15T00:00:00Z'), status: 'active' }),
      ]);

      const result = await getCohortAnalysis(sequence.id, 'month');

      expect(result.period).toBe('month');
      expect(result.cohorts.length).toBe(2);
    });

    it('should throw if sequence not found', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      await expect(getCohortAnalysis('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('getRevenueAttribution', () => {
    it('should calculate revenue from completed leads', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ leadId: 'lead_1' }),
        buildSequenceEnrollment({ leadId: 'lead_2' }),
      ]);
      mockPrisma.lead.findMany.mockResolvedValue([
        buildLead({ id: 'lead_1', enrichmentData: { dealValue: 5000 } }),
        buildLead({ id: 'lead_2', enrichmentData: { dealValue: 3000 } }),
      ]);

      const result = await getRevenueAttribution(sequence.id);

      expect(result.totalRevenue).toBe(8000);
      expect(result.attributedDeals).toBe(2);
      expect(result.averageDealValue).toBe(4000);
    });

    it('should handle leads without deal values', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ leadId: 'lead_1' }),
      ]);
      mockPrisma.lead.findMany.mockResolvedValue([
        buildLead({ id: 'lead_1', enrichmentData: null }),
      ]);

      const result = await getRevenueAttribution(sequence.id);

      expect(result.totalRevenue).toBe(0);
      expect(result.attributedDeals).toBe(0);
    });

    it('should throw if sequence not found', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      await expect(getRevenueAttribution('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('exportAnalyticsCSV', () => {
    it('should export funnel data as CSV', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.message.count
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(8);
      mockPrisma.sequenceEnrollment.count.mockResolvedValueOnce(20);

      const csv = await exportAnalyticsCSV('funnel', { sequenceId: sequence.id });

      expect(csv).toContain('Stage,Count,Rate (%)');
      expect(csv).toContain('Enrolled');
      expect(csv).toContain('Opened');
    });

    it('should export cohort data as CSV', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
        buildSequenceEnrollment({ createdAt: new Date('2025-01-06T00:00:00Z'), status: 'completed' }),
      ]);

      const csv = await exportAnalyticsCSV('cohort', { sequenceId: sequence.id });

      expect(csv).toContain('Period,Total,Completed,Exited,Active,Completion Rate (%)');
    });

    it('should export revenue data as CSV', async () => {
      const sequence = buildSequence();
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.lead.findMany.mockResolvedValue([]);

      const csv = await exportAnalyticsCSV('revenue', { sequenceId: sequence.id });

      expect(csv).toContain('Metric,Value');
      expect(csv).toContain('Total Revenue');
    });

    it('should throw on invalid type', async () => {
      await expect(exportAnalyticsCSV('invalid', {})).rejects.toThrow('Invalid export type');
    });
  });
});
