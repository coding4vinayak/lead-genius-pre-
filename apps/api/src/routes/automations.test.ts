import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildAutomation, buildAutomationStep, buildAutomationExecution } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: automationRoutes } = await import('./automations.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/automations', automationRoutes);
  app.use(errorHandler);
  return app;
}

describe('Automations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/automations', () => {
    it('should list automations with pagination', async () => {
      const automations = [buildAutomation(), buildAutomation()];
      mockPrisma.automation.findMany.mockResolvedValue(automations);
      mockPrisma.automation.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/automations?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(10);
    });

    it('should filter by status', async () => {
      mockPrisma.automation.findMany.mockResolvedValue([]);
      mockPrisma.automation.count.mockResolvedValue(0);

      await request(createApp()).get('/api/automations?status=active&page=1&pageSize=50');

      expect(mockPrisma.automation.findMany.mock.calls[0][0].where.status).toBe('active');
    });

    it('should filter by triggerType', async () => {
      mockPrisma.automation.findMany.mockResolvedValue([]);
      mockPrisma.automation.count.mockResolvedValue(0);

      await request(createApp()).get('/api/automations?triggerType=lead.created&page=1&pageSize=50');

      expect(mockPrisma.automation.findMany.mock.calls[0][0].where.triggerType).toBe('lead.created');
    });
  });

  describe('GET /api/automations/:id', () => {
    it('should return an automation with steps and executions', async () => {
      const automation = buildAutomation({ id: 'auto_1' });
      mockPrisma.automation.findUnique.mockResolvedValue(automation);

      const res = await request(createApp()).get('/api/automations/auto_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('auto_1');
      expect(mockPrisma.automation.findUnique.mock.calls[0][0].include).toHaveProperty('steps');
      expect(mockPrisma.automation.findUnique.mock.calls[0][0].include).toHaveProperty('executions');
    });

    it('should return 404 for non-existent automation', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/automations/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
    });
  });

  describe('POST /api/automations', () => {
    it('should create an automation with steps', async () => {
      const newAuto = buildAutomation({ id: 'auto_new', name: 'New Automation' });
      mockPrisma.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockPrisma);
      });
      mockPrisma.automation.create.mockResolvedValue(newAuto);
      mockPrisma.automationStep.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.automation.findUnique.mockResolvedValue({ ...newAuto, steps: [buildAutomationStep()] });

      const res = await request(createApp())
        .post('/api/automations')
        .send({
          automation: {
            name: 'New Automation',
            triggerType: 'lead.created',
            triggerConfig: {},
          },
          steps: [
            { type: 'send_message', config: { templateId: 'tmpl_1' }, position: 0 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Automation');
    });

    it('should create an automation without steps', async () => {
      const newAuto = buildAutomation({ id: 'auto_new', name: 'No Steps' });
      mockPrisma.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockPrisma);
      });
      mockPrisma.automation.create.mockResolvedValue(newAuto);
      mockPrisma.automation.findUnique.mockResolvedValue({ ...newAuto, steps: [] });

      const res = await request(createApp())
        .post('/api/automations')
        .send({
          automation: {
            name: 'No Steps',
            triggerType: 'lead.created',
          },
          steps: [],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('No Steps');
    });

    it('should reject missing required fields', async () => {
      const res = await request(createApp())
        .post('/api/automations')
        .send({ automation: { name: '' } });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/automations/:id', () => {
    it('should update an automation and replace steps', async () => {
      const updated = buildAutomation({ id: 'auto_1', name: 'Updated' });
      mockPrisma.$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockPrisma);
      });
      mockPrisma.automation.update.mockResolvedValue(updated);
      mockPrisma.automationStep.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.automationStep.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.automation.findUnique.mockResolvedValue({ ...updated, steps: [buildAutomationStep()] });

      const res = await request(createApp())
        .put('/api/automations/auto_1')
        .send({
          automation: {
            name: 'Updated',
            triggerType: 'lead.created',
            triggerConfig: {},
          },
          steps: [
            { type: 'send_message', config: {}, position: 0 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });
  });

  describe('DELETE /api/automations/:id', () => {
    it('should delete an automation with cascade', async () => {
      mockPrisma.automationExecutionStep.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.automationExecution.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.automationStep.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.automation.delete.mockResolvedValue(buildAutomation({ id: 'auto_1' }));

      const res = await request(createApp()).delete('/api/automations/auto_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('auto_1');
      expect(mockPrisma.automationExecutionStep.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.automationExecution.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.automationStep.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.automation.delete).toHaveBeenCalled();
    });
  });

  describe('POST /api/automations/:id/activate', () => {
    it('should activate an automation', async () => {
      const automation = buildAutomation({ id: 'auto_1', status: 'draft', isActive: false });
      mockPrisma.automation.findUnique.mockResolvedValue(automation);
      mockPrisma.automation.update.mockResolvedValue({ ...automation, status: 'active', isActive: true });

      const res = await request(createApp()).post('/api/automations/auto_1/activate');

      expect(res.status).toBe(200);
      expect(mockPrisma.automation.update.mock.calls[0][0].data).toEqual({ isActive: true, status: 'active' });
    });

    it('should return 404 for non-existent automation', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/automations/nonexistent/activate');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/automations/:id/deactivate', () => {
    it('should deactivate an automation', async () => {
      const automation = buildAutomation({ id: 'auto_1', status: 'active', isActive: true });
      mockPrisma.automation.findUnique.mockResolvedValue(automation);
      mockPrisma.automation.update.mockResolvedValue({ ...automation, status: 'inactive', isActive: false });

      const res = await request(createApp()).post('/api/automations/auto_1/deactivate');

      expect(res.status).toBe(200);
      expect(mockPrisma.automation.update.mock.calls[0][0].data).toEqual({ isActive: false, status: 'inactive' });
    });

    it('should return 404 for non-existent automation', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/automations/nonexistent/deactivate');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/automations/:id/executions', () => {
    it('should list executions with pagination', async () => {
      const executions = [buildAutomationExecution(), buildAutomationExecution()];
      mockPrisma.automationExecution.findMany.mockResolvedValue(executions);
      mockPrisma.automationExecution.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/automations/auto_1/executions?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/automations/:id/test', () => {
    it('should trigger a test execution', async () => {
      const automation = buildAutomation({ id: 'auto_1', steps: [buildAutomationStep({ id: 'step_1' })] });
      mockPrisma.automation.findUnique.mockResolvedValue(automation);
      const execution = buildAutomationExecution({ id: 'exec_test' });
      mockPrisma.automationExecution.create.mockResolvedValue(execution);

      const res = await request(createApp())
        .post('/api/automations/auto_1/test')
        .send({ payload: { lead: { id: 'test_1', name: 'Test' } } });

      expect(res.status).toBe(200);
      expect(res.body.data.executionId).toBe('exec_test');
      expect(res.body.data.message).toContain('Test execution started');
    });

    it('should return 404 for non-existent automation', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/automations/nonexistent/test')
        .send({});

      expect(res.status).toBe(404);
    });

    it('should use default payload when none provided', async () => {
      const automation = buildAutomation({ id: 'auto_1', steps: [buildAutomationStep({ id: 'step_1' })] });
      mockPrisma.automation.findUnique.mockResolvedValue(automation);
      const execution = buildAutomationExecution({ id: 'exec_test' });
      mockPrisma.automationExecution.create.mockResolvedValue(execution);

      const res = await request(createApp())
        .post('/api/automations/auto_1/test')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.executionId).toBe('exec_test');
    });
  });
});
