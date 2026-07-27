import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSequence, buildSequenceStep, buildSequenceEnrollment, buildLead, buildTemplate } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('../queue/index.js', () => ({
  sendQueue: { add: vi.fn() },
  sequenceQueue: { add: vi.fn() },
  campaignQueue: { add: vi.fn() },
  aiQueue: { add: vi.fn() },
  automationQueue: { add: vi.fn() },
  eventQueue: { add: vi.fn() },
}));
vi.mock('./event-bus.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

const { enrollLeadsInSequence, processSequenceStep, checkForReplies, tickSequences } = await import('./sequence-engine.js');
const { sendQueue } = await import('../queue/index.js');

describe('Sequence Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enrollLeadsInSequence', () => {
    it('should create enrollment records for new leads', async () => {
      const sequence = buildSequence({
        id: 'seq_1',
        steps: [buildSequenceStep({ id: 'step_1', position: 0 })],
      });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.sequenceEnrollment.createMany.mockResolvedValue({ count: 2 });

      const result = await enrollLeadsInSequence('seq_1', ['lead_1', 'lead_2']);

      expect(result).toBe(2);
      expect(mockPrisma.sequenceEnrollment.createMany).toHaveBeenCalled();
      const createData = mockPrisma.sequenceEnrollment.createMany.mock.calls[0][0].data;
      expect(createData).toHaveLength(2);
      expect(createData[0].currentStepId).toBe('step_1');
    });

    it('should skip already enrolled leads', async () => {
      const sequence = buildSequence({
        id: 'seq_1',
        steps: [buildSequenceStep({ id: 'step_1', position: 0 })],
      });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([{ leadId: 'lead_1' }]);
      mockPrisma.sequenceEnrollment.createMany.mockResolvedValue({ count: 1 });

      const result = await enrollLeadsInSequence('seq_1', ['lead_1', 'lead_2']);

      expect(result).toBe(1);
    });

    it('should return 0 if sequence has no steps', async () => {
      const sequence = buildSequence({ id: 'seq_1', steps: [] });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);

      const result = await enrollLeadsInSequence('seq_1', ['lead_1']);

      expect(result).toBe(0);
    });

    it('should return 0 if sequence not found', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      const result = await enrollLeadsInSequence('nonexistent', ['lead_1']);

      expect(result).toBe(0);
    });
  });

  describe('processSequenceStep', () => {
    it('should process send_email step and queue message', async () => {
      const lead = buildLead({ id: 'lead_1', email: 'test@example.com', stage: 'new' });
      const step = buildSequenceStep({ id: 'step_1', type: 'send_email', config: { templateId: 'tmpl_1' }, nextStepId: 'step_2' });
      const sequence = buildSequence({ id: 'seq_1', steps: [step], pauseOnReply: true });
      const enrollment = buildSequenceEnrollment({
        id: 'enroll_1',
        sequenceId: 'seq_1',
        leadId: 'lead_1',
        currentStepId: 'step_1',
        status: 'active',
      });

      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...enrollment,
        sequence,
        lead,
      });
      mockPrisma.message.findFirst.mockResolvedValue(null); // no reply
      mockPrisma.sequenceStepExecution.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({ id: 'tmpl_1', body: 'Hello {{name}}', subject: 'Hi {{name}}' }));
      mockPrisma.message.create.mockResolvedValue({ id: 'msg_1' });
      mockPrisma.sequenceStepExecution.create.mockResolvedValue({});
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      await processSequenceStep('enroll_1');

      expect(mockPrisma.message.create).toHaveBeenCalled();
      expect((sendQueue as unknown as { add: ReturnType<typeof vi.fn> }).add).toHaveBeenCalledWith(
        'send-message',
        expect.objectContaining({ channel: 'email', to: 'test@example.com' }),
      );
      expect(mockPrisma.sequenceEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentStepId: 'step_2' }) }),
      );
    });

    it('should complete enrollment when no next step', async () => {
      const lead = buildLead({ id: 'lead_1', email: 'test@example.com', stage: 'new' });
      const step = buildSequenceStep({ id: 'step_1', type: 'send_email', config: { templateId: 'tmpl_1' }, nextStepId: null });
      const sequence = buildSequence({ id: 'seq_1', steps: [step], pauseOnReply: false });
      const enrollment = buildSequenceEnrollment({
        id: 'enroll_1',
        currentStepId: 'step_1',
        status: 'active',
      });

      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...enrollment,
        sequence,
        lead,
      });
      mockPrisma.sequenceStepExecution.findFirst.mockResolvedValue(null);
      mockPrisma.template.findUnique.mockResolvedValue(buildTemplate({ id: 'tmpl_1' }));
      mockPrisma.message.create.mockResolvedValue({ id: 'msg_1' });
      mockPrisma.sequenceStepExecution.create.mockResolvedValue({});
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      await processSequenceStep('enroll_1');

      expect(mockPrisma.sequenceEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'completed', currentStepId: null }),
        }),
      );
    });

    it('should handle delay step by updating nextRunAt', async () => {
      const lead = buildLead({ id: 'lead_1', stage: 'new' });
      const step = buildSequenceStep({ id: 'step_1', type: 'delay', config: { delayHours: 48 }, nextStepId: 'step_2' });
      const sequence = buildSequence({ id: 'seq_1', steps: [step], pauseOnReply: false });
      const enrollment = buildSequenceEnrollment({
        id: 'enroll_1',
        currentStepId: 'step_1',
        status: 'active',
      });

      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...enrollment,
        sequence,
        lead,
      });
      mockPrisma.sequenceStepExecution.create.mockResolvedValue({});
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      await processSequenceStep('enroll_1');

      // Should update nextRunAt with delay
      const updateCalls = mockPrisma.sequenceEnrollment.update.mock.calls;
      const delayCall = updateCalls.find((call: unknown[]) => (call[0] as Record<string, unknown>).data && ((call[0] as Record<string, Record<string, unknown>>).data.nextRunAt));
      expect(delayCall).toBeDefined();
    });

    it('should handle condition step and branch to true step', async () => {
      const lead = buildLead({ id: 'lead_1', score: 60, stage: 'warm' });
      const step = buildSequenceStep({
        id: 'step_1',
        type: 'condition',
        config: { conditions: [{ field: 'lead.score', operator: 'greater_than', value: 50 }] },
        conditionTrueStepId: 'step_true',
        conditionFalseStepId: 'step_false',
        nextStepId: null,
      });
      const sequence = buildSequence({ id: 'seq_1', steps: [step], pauseOnReply: false });
      const enrollment = buildSequenceEnrollment({
        id: 'enroll_1',
        currentStepId: 'step_1',
        status: 'active',
      });

      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...enrollment,
        sequence,
        lead,
      });
      mockPrisma.sequenceStepExecution.create.mockResolvedValue({});
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      await processSequenceStep('enroll_1');

      expect(mockPrisma.sequenceEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentStepId: 'step_true' }),
        }),
      );
    });

    it('should handle condition step and branch to false step', async () => {
      const lead = buildLead({ id: 'lead_1', score: 30, stage: 'new' });
      const step = buildSequenceStep({
        id: 'step_1',
        type: 'condition',
        config: { conditions: [{ field: 'lead.score', operator: 'greater_than', value: 50 }] },
        conditionTrueStepId: 'step_true',
        conditionFalseStepId: 'step_false',
        nextStepId: null,
      });
      const sequence = buildSequence({ id: 'seq_1', steps: [step], pauseOnReply: false });
      const enrollment = buildSequenceEnrollment({
        id: 'enroll_1',
        currentStepId: 'step_1',
        status: 'active',
      });

      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...enrollment,
        sequence,
        lead,
      });
      mockPrisma.sequenceStepExecution.create.mockResolvedValue({});
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      await processSequenceStep('enroll_1');

      expect(mockPrisma.sequenceEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentStepId: 'step_false' }),
        }),
      );
    });

    it('should handle update_lead_stage step', async () => {
      const lead = buildLead({ id: 'lead_1', stage: 'new' });
      const step = buildSequenceStep({ id: 'step_1', type: 'update_lead_stage', config: { stage: 'contacted' }, nextStepId: null });
      const sequence = buildSequence({ id: 'seq_1', steps: [step], pauseOnReply: false });
      const enrollment = buildSequenceEnrollment({
        id: 'enroll_1',
        leadId: 'lead_1',
        currentStepId: 'step_1',
        status: 'active',
      });

      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...enrollment,
        sequence,
        lead,
      });
      mockPrisma.lead.update.mockResolvedValue({});
      mockPrisma.sequenceStepExecution.create.mockResolvedValue({});
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      await processSequenceStep('enroll_1');

      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead_1' },
          data: { stage: 'contacted' },
        }),
      );
    });

    it('should handle update_lead_score step', async () => {
      const lead = buildLead({ id: 'lead_1', score: 20, stage: 'new' });
      const step = buildSequenceStep({ id: 'step_1', type: 'update_lead_score', config: { delta: 15 }, nextStepId: null });
      const sequence = buildSequence({ id: 'seq_1', steps: [step], pauseOnReply: false });
      const enrollment = buildSequenceEnrollment({
        id: 'enroll_1',
        leadId: 'lead_1',
        currentStepId: 'step_1',
        status: 'active',
      });

      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...enrollment,
        sequence,
        lead,
      });
      mockPrisma.lead.update.mockResolvedValue({});
      mockPrisma.sequenceStepExecution.create.mockResolvedValue({});
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      await processSequenceStep('enroll_1');

      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead_1' },
          data: { score: 35 },
        }),
      );
    });

    it('should skip duplicate template sends (deduplication)', async () => {
      const lead = buildLead({ id: 'lead_1', email: 'test@example.com', stage: 'new' });
      const step = buildSequenceStep({ id: 'step_1', type: 'send_email', config: { templateId: 'tmpl_1' }, nextStepId: null });
      const sequence = buildSequence({ id: 'seq_1', steps: [step], pauseOnReply: false });
      const enrollment = buildSequenceEnrollment({
        id: 'enroll_1',
        currentStepId: 'step_1',
        status: 'active',
      });

      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...enrollment,
        sequence,
        lead,
      });
      // Duplicate found
      mockPrisma.sequenceStepExecution.findFirst.mockResolvedValue({ id: 'existing_exec' });
      mockPrisma.sequenceStepExecution.create.mockResolvedValue({});
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      await processSequenceStep('enroll_1');

      // Should NOT send a message
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
      // Should record as skipped
      expect(mockPrisma.sequenceStepExecution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'skipped' }),
        }),
      );
    });

    it('should not process inactive enrollment', async () => {
      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue({
        ...buildSequenceEnrollment({ status: 'completed' }),
        sequence: buildSequence(),
        lead: buildLead(),
      });

      await processSequenceStep('enroll_1');

      expect(mockPrisma.sequenceStepExecution.create).not.toHaveBeenCalled();
    });
  });

  describe('checkForReplies', () => {
    it('should pause enrollment when lead has replied', async () => {
      const enrollment = {
        ...buildSequenceEnrollment({ id: 'enroll_1', leadId: 'lead_1' }),
        sequence: buildSequence({ pauseOnReply: true }),
      };
      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue(enrollment);
      mockPrisma.message.findFirst.mockResolvedValue({ id: 'msg_reply', direction: 'inbound' });
      mockPrisma.sequenceEnrollment.update.mockResolvedValue({});

      const result = await checkForReplies('enroll_1');

      expect(result).toBe(true);
      expect(mockPrisma.sequenceEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'paused', exitReason: 'replied' }),
        }),
      );
    });

    it('should not pause when no reply found', async () => {
      const enrollment = {
        ...buildSequenceEnrollment({ id: 'enroll_1', leadId: 'lead_1' }),
        sequence: buildSequence({ pauseOnReply: true }),
      };
      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue(enrollment);
      mockPrisma.message.findFirst.mockResolvedValue(null);

      const result = await checkForReplies('enroll_1');

      expect(result).toBe(false);
      expect(mockPrisma.sequenceEnrollment.update).not.toHaveBeenCalled();
    });

    it('should not pause when pauseOnReply is false', async () => {
      const enrollment = {
        ...buildSequenceEnrollment({ id: 'enroll_1' }),
        sequence: buildSequence({ pauseOnReply: false }),
      };
      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue(enrollment);

      const result = await checkForReplies('enroll_1');

      expect(result).toBe(false);
    });
  });

  describe('tickSequences', () => {
    it('should find and process due enrollments', async () => {
      const enrollments = [
        buildSequenceEnrollment({ id: 'enroll_1' }),
        buildSequenceEnrollment({ id: 'enroll_2' }),
      ];
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue(enrollments);

      // Mock processSequenceStep results (enrollment lookups will return null -> skips processing)
      mockPrisma.sequenceEnrollment.findUnique.mockResolvedValue(null);

      const processed = await tickSequences();

      expect(mockPrisma.sequenceEnrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
      expect(processed).toBe(2);
    });

    it('should return 0 when no enrollments are due', async () => {
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

      const processed = await tickSequences();

      expect(processed).toBe(0);
    });
  });
});
