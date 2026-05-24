import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSequence, buildSequenceStep, buildSequenceEnrollment } from '../test/factories.js';

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

const { default: sequenceRoutes } = await import('./sequences.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sequences', sequenceRoutes);
  app.use(errorHandler);
  return app;
}

describe('Sequences API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/sequences', () => {
    it('should list sequences with pagination', async () => {
      const sequences = [buildSequence(), buildSequence()];
      mockPrisma.sequence.findMany.mockResolvedValue(sequences);
      mockPrisma.sequence.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/sequences?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(10);
    });

    it('should filter by status', async () => {
      mockPrisma.sequence.findMany.mockResolvedValue([]);
      mockPrisma.sequence.count.mockResolvedValue(0);

      await request(createApp()).get('/api/sequences?status=active&page=1&pageSize=50');

      expect(mockPrisma.sequence.findMany.mock.calls[0][0].where.status).toBe('active');
    });
  });

  describe('GET /api/sequences/:id', () => {
    it('should return a sequence with steps and enrollment stats', async () => {
      const sequence = buildSequence({ id: 'seq_1' });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.groupBy.mockResolvedValue([
        { status: 'active', _count: 5 },
        { status: 'completed', _count: 3 },
      ]);

      const res = await request(createApp()).get('/api/sequences/seq_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('seq_1');
      expect(res.body.data.enrollmentStats).toBeDefined();
    });

    it('should return 404 for non-existent sequence', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/sequences/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
    });
  });

  describe('POST /api/sequences', () => {
    it('should create a sequence with steps', async () => {
      const newSeq = buildSequence({ id: 'seq_new', name: 'New Sequence' });
      mockPrisma.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockPrisma);
      });
      mockPrisma.sequence.create.mockResolvedValue(newSeq);
      mockPrisma.sequenceStep.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.sequence.findUnique.mockResolvedValue({ ...newSeq, steps: [buildSequenceStep()] });

      const res = await request(createApp())
        .post('/api/sequences')
        .send({
          sequence: {
            name: 'New Sequence',
            triggerType: 'manual',
          },
          steps: [
            { type: 'send_email', config: { templateId: 'tmpl_1' }, position: 0 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Sequence');
    });

    it('should create a sequence without steps', async () => {
      const newSeq = buildSequence({ id: 'seq_new', name: 'No Steps' });
      mockPrisma.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockPrisma);
      });
      mockPrisma.sequence.create.mockResolvedValue(newSeq);
      mockPrisma.sequence.findUnique.mockResolvedValue({ ...newSeq, steps: [] });

      const res = await request(createApp())
        .post('/api/sequences')
        .send({
          sequence: {
            name: 'No Steps',
            triggerType: 'manual',
          },
          steps: [],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('No Steps');
    });

    it('should reject missing required fields', async () => {
      const res = await request(createApp())
        .post('/api/sequences')
        .send({ sequence: { name: '' } });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/sequences/:id', () => {
    it('should update a sequence and replace steps', async () => {
      const updated = buildSequence({ id: 'seq_1', name: 'Updated' });
      mockPrisma.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockPrisma);
      });
      mockPrisma.sequence.update.mockResolvedValue(updated);
      mockPrisma.sequenceStep.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.sequenceStep.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.sequence.findUnique.mockResolvedValue({ ...updated, steps: [buildSequenceStep()] });

      const res = await request(createApp())
        .put('/api/sequences/seq_1')
        .send({
          sequence: {
            name: 'Updated',
            triggerType: 'manual',
          },
          steps: [
            { type: 'send_email', config: { templateId: 'tmpl_1' }, position: 0 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/sequences/:id', () => {
    it('should delete a sequence', async () => {
      mockPrisma.sequence.delete.mockResolvedValue(buildSequence({ id: 'seq_1' }));

      const res = await request(createApp()).delete('/api/sequences/seq_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('seq_1');
      expect(mockPrisma.sequence.delete).toHaveBeenCalledWith({ where: { id: 'seq_1' } });
    });
  });

  describe('POST /api/sequences/:id/activate', () => {
    it('should activate a sequence and enroll leads from groups', async () => {
      const sequence = buildSequence({ id: 'seq_1', leadGroupIds: ['group_1'], steps: [buildSequenceStep({ id: 'step_1' })] });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequence.update.mockResolvedValue({ ...sequence, status: 'active' });
      mockPrisma.groupMember.findMany.mockResolvedValue([
        { leadId: 'lead_1' }, { leadId: 'lead_2' },
      ]);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.sequenceEnrollment.createMany.mockResolvedValue({ count: 2 });

      const res = await request(createApp()).post('/api/sequences/seq_1/activate');

      expect(res.status).toBe(200);
      expect(mockPrisma.sequence.update.mock.calls[0][0].data.status).toBe('active');
      expect(mockPrisma.sequenceEnrollment.createMany).toHaveBeenCalled();
    });

    it('should return 404 for non-existent sequence', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/sequences/nonexistent/activate');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/sequences/:id/pause', () => {
    it('should pause a sequence', async () => {
      const sequence = buildSequence({ id: 'seq_1', status: 'active' });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequence.update.mockResolvedValue({ ...sequence, status: 'paused' });

      const res = await request(createApp()).post('/api/sequences/seq_1/pause');

      expect(res.status).toBe(200);
      expect(mockPrisma.sequence.update.mock.calls[0][0].data.status).toBe('paused');
    });

    it('should return 404 for non-existent sequence', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/sequences/nonexistent/pause');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/sequences/:id/resume', () => {
    it('should resume a paused sequence', async () => {
      const sequence = buildSequence({ id: 'seq_1', status: 'paused' });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequence.update.mockResolvedValue({ ...sequence, status: 'active' });

      const res = await request(createApp()).post('/api/sequences/seq_1/resume');

      expect(res.status).toBe(200);
      expect(mockPrisma.sequence.update.mock.calls[0][0].data.status).toBe('active');
    });
  });

  describe('GET /api/sequences/:id/enrollments', () => {
    it('should list enrollments with pagination', async () => {
      const enrollments = [buildSequenceEnrollment(), buildSequenceEnrollment()];
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue(enrollments);
      mockPrisma.sequenceEnrollment.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/sequences/seq_1/enrollments?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/sequences/:id/enroll', () => {
    it('should enroll leads in a sequence', async () => {
      const sequence = buildSequence({ id: 'seq_1', steps: [buildSequenceStep({ id: 'step_1' })] });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);
      mockPrisma.sequenceEnrollment.createMany.mockResolvedValue({ count: 2 });

      const res = await request(createApp())
        .post('/api/sequences/seq_1/enroll')
        .send({ leadIds: ['lead_1', 'lead_2'] });

      expect(res.status).toBe(200);
      expect(res.body.data.enrolled).toBe(2);
      expect(res.body.data.skipped).toBe(0);
    });

    it('should skip already enrolled leads', async () => {
      const sequence = buildSequence({ id: 'seq_1', steps: [buildSequenceStep({ id: 'step_1' })] });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([{ leadId: 'lead_1' }]);
      mockPrisma.sequenceEnrollment.createMany.mockResolvedValue({ count: 1 });

      const res = await request(createApp())
        .post('/api/sequences/seq_1/enroll')
        .send({ leadIds: ['lead_1', 'lead_2'] });

      expect(res.status).toBe(200);
      expect(res.body.data.enrolled).toBe(1);
      expect(res.body.data.skipped).toBe(1);
    });

    it('should return 404 for non-existent sequence', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/sequences/nonexistent/enroll')
        .send({ leadIds: ['lead_1'] });

      expect(res.status).toBe(404);
    });

    it('should reject sequences with no steps', async () => {
      const sequence = buildSequence({ id: 'seq_1', steps: [] });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);

      const res = await request(createApp())
        .post('/api/sequences/seq_1/enroll')
        .send({ leadIds: ['lead_1'] });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/sequences/:id/unenroll', () => {
    it('should unenroll leads from a sequence', async () => {
      mockPrisma.sequenceEnrollment.updateMany.mockResolvedValue({ count: 2 });

      const res = await request(createApp())
        .post('/api/sequences/seq_1/unenroll')
        .send({ leadIds: ['lead_1', 'lead_2'] });

      expect(res.status).toBe(200);
      expect(res.body.data.unenrolled).toBe(2);
    });
  });

  describe('GET /api/sequences/:id/analytics', () => {
    it('should return per-step metrics', async () => {
      const sequence = buildSequence({
        id: 'seq_1',
        steps: [
          buildSequenceStep({ id: 'step_1', position: 0 }),
          buildSequenceStep({ id: 'step_2', position: 1, type: 'delay' }),
        ],
      });
      mockPrisma.sequence.findUnique.mockResolvedValue(sequence);
      mockPrisma.sequenceStepExecution.findMany.mockResolvedValue([
        { stepId: 'step_1', status: 'completed' },
        { stepId: 'step_1', status: 'completed' },
        { stepId: 'step_1', status: 'failed' },
        { stepId: 'step_2', status: 'completed' },
      ]);
      mockPrisma.sequenceEnrollment.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5) // completed
        .mockResolvedValueOnce(3); // active

      const res = await request(createApp()).get('/api/sequences/seq_1/analytics');

      expect(res.status).toBe(200);
      expect(res.body.data.sequenceId).toBe('seq_1');
      expect(res.body.data.totalEnrollments).toBe(10);
      expect(res.body.data.stepMetrics).toHaveLength(2);
      expect(res.body.data.stepMetrics[0].completed).toBe(2);
      expect(res.body.data.stepMetrics[0].failed).toBe(1);
    });

    it('should return 404 for non-existent sequence', async () => {
      mockPrisma.sequence.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/sequences/nonexistent/analytics');

      expect(res.status).toBe(404);
    });
  });
});
