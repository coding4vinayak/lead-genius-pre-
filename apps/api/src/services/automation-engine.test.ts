import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildAutomation, buildAutomationStep, buildAutomationExecution, buildLead, buildTask } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const mockAutomationQueue = { add: vi.fn().mockResolvedValue(undefined) };
const mockSendQueue = { add: vi.fn().mockResolvedValue(undefined) };
const mockWebhookQueue = { add: vi.fn().mockResolvedValue(undefined) };

vi.mock('../queue/index.js', () => ({
  automationQueue: mockAutomationQueue,
  sendQueue: mockSendQueue,
  webhookQueue: mockWebhookQueue,
  campaignQueue: { add: vi.fn() },
  eventQueue: { add: vi.fn() },
  aiQueue: { add: vi.fn() },
  createCampaignWorker: vi.fn(),
  createSendWorker: vi.fn(),
  createAiWorker: vi.fn(),
  createEventWorker: vi.fn(),
  createAutomationWorker: vi.fn(),
  createWebhookWorker: vi.fn(),
}));

const { executeAutomation, processAutomationStep } = await import('./automation-engine.js');

describe('Automation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeAutomation', () => {
    it('should create execution and queue first step', async () => {
      const steps = [buildAutomationStep({ id: 'step_1', position: 0 })];
      const automation = buildAutomation({ id: 'auto_1', isActive: true, steps });
      mockPrisma.automation.findUnique.mockResolvedValue(automation);
      const execution = buildAutomationExecution({ id: 'exec_1', automationId: 'auto_1' });
      mockPrisma.automationExecution.create.mockResolvedValue(execution);

      await executeAutomation('auto_1', { lead: { id: 'lead_1' } });

      expect(mockPrisma.automationExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ automationId: 'auto_1', status: 'running' }),
      });
      expect(mockAutomationQueue.add).toHaveBeenCalledWith('process-step', {
        executionId: 'exec_1',
        stepId: 'step_1',
        payload: { lead: { id: 'lead_1' } },
      });
    });

    it('should not execute if automation is inactive', async () => {
      const automation = buildAutomation({ id: 'auto_1', isActive: false });
      mockPrisma.automation.findUnique.mockResolvedValue(automation);

      await executeAutomation('auto_1', {});

      expect(mockPrisma.automationExecution.create).not.toHaveBeenCalled();
    });

    it('should not execute if automation not found', async () => {
      mockPrisma.automation.findUnique.mockResolvedValue(null);

      await executeAutomation('nonexistent', {});

      expect(mockPrisma.automationExecution.create).not.toHaveBeenCalled();
    });

    it('should complete immediately if no steps', async () => {
      const automation = buildAutomation({ id: 'auto_1', isActive: true, steps: [] });
      mockPrisma.automation.findUnique.mockResolvedValue(automation);
      const execution = buildAutomationExecution({ id: 'exec_1' });
      mockPrisma.automationExecution.create.mockResolvedValue(execution);
      mockPrisma.automationExecution.update.mockResolvedValue(execution);

      await executeAutomation('auto_1', {});

      expect(mockPrisma.automationExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec_1' },
        data: expect.objectContaining({ status: 'completed' }),
      });
    });
  });

  describe('processAutomationStep', () => {
    const executionStep = { id: 'exstep_1', executionId: 'exec_1', stepId: 'step_1', status: 'running', startedAt: new Date() };

    beforeEach(() => {
      mockPrisma.automationExecutionStep.create.mockResolvedValue(executionStep);
      mockPrisma.automationExecutionStep.update.mockResolvedValue(executionStep);
      mockPrisma.automationExecution.update.mockResolvedValue({});
    });

    it('should fail execution if step not found', async () => {
      mockPrisma.automationStep.findUnique.mockResolvedValue(null);

      await processAutomationStep('exec_1', 'missing_step', {});

      expect(mockPrisma.automationExecution.update).toHaveBeenCalledWith({
        where: { id: 'exec_1' },
        data: expect.objectContaining({ status: 'failed' }),
      });
    });

    describe('send_message step', () => {
      it('should add job to send queue', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'send_message', config: { templateId: 'tmpl_1', channel: 'email' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockSendQueue.add).toHaveBeenCalledWith('send-message', expect.objectContaining({
          templateId: 'tmpl_1',
          leadId: 'lead_1',
        }));
      });
    });

    describe('update_lead_field step', () => {
      it('should update the lead field', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'update_lead_field', config: { field: 'status', value: 'qualified' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.lead.update.mockResolvedValue({});

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
          where: { id: 'lead_1' },
          data: { status: 'qualified' },
        });
      });
    });

    describe('add_tag step', () => {
      it('should add tag to lead', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'add_tag', config: { tag: 'vip' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.lead.findUnique.mockResolvedValue(buildLead({ id: 'lead_1', tags: ['existing'] }));
        mockPrisma.lead.update.mockResolvedValue({});

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
          where: { id: 'lead_1' },
          data: { tags: ['existing', 'vip'] },
        });
      });

      it('should not duplicate existing tag', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'add_tag', config: { tag: 'existing' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.lead.findUnique.mockResolvedValue(buildLead({ id: 'lead_1', tags: ['existing'] }));
        mockPrisma.lead.update.mockResolvedValue({});

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockPrisma.lead.update).not.toHaveBeenCalled();
      });
    });

    describe('remove_tag step', () => {
      it('should remove tag from lead', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'remove_tag', config: { tag: 'vip' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.lead.findUnique.mockResolvedValue(buildLead({ id: 'lead_1', tags: ['vip', 'customer'] }));
        mockPrisma.lead.update.mockResolvedValue({});

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
          where: { id: 'lead_1' },
          data: { tags: ['customer'] },
        });
      });
    });

    describe('move_to_group step', () => {
      it('should create group membership', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'move_to_group', config: { groupId: 'group_1' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.groupMember.create.mockResolvedValue({});

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockPrisma.groupMember.create).toHaveBeenCalledWith({
          data: { leadId: 'lead_1', groupId: 'group_1' },
        });
      });
    });

    describe('remove_from_group step', () => {
      it('should delete group membership', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'remove_from_group', config: { groupId: 'group_1' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.groupMember.deleteMany.mockResolvedValue({ count: 1 });

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockPrisma.groupMember.deleteMany).toHaveBeenCalledWith({
          where: { leadId: 'lead_1', groupId: 'group_1' },
        });
      });
    });

    describe('pause_campaign step', () => {
      it('should update campaign status to paused', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'pause_campaign', config: { campaignId: 'camp_1' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.campaign.update.mockResolvedValue({});

        await processAutomationStep('exec_1', 'step_1', {});

        expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
          where: { id: 'camp_1' },
          data: { status: 'paused' },
        });
      });
    });

    describe('send_webhook step', () => {
      it('should add job to webhook queue', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'send_webhook', config: { url: 'https://example.com/hook' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);

        const payload = { lead: { id: 'lead_1' } };
        await processAutomationStep('exec_1', 'step_1', payload);

        expect(mockWebhookQueue.add).toHaveBeenCalledWith('send-webhook', {
          url: 'https://example.com/hook',
          payload,
        });
      });
    });

    describe('delay step', () => {
      it('should re-queue with delay and not dispatch next step directly', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'delay', config: { delayMs: 30000 }, nextStepId: 'step_2',
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockAutomationQueue.add).toHaveBeenCalledWith('process-step', {
          executionId: 'exec_1',
          stepId: 'step_2',
          payload: { lead: { id: 'lead_1' } },
        }, { delay: 30000 });

        expect(mockPrisma.automationExecutionStep.update).toHaveBeenCalledWith({
          where: { id: 'exstep_1' },
          data: expect.objectContaining({ status: 'completed', output: { delayed: true, delayMs: 30000 } }),
        });
      });
    });

    describe('condition step', () => {
      it('should route to true step when condition is met', async () => {
        const step = buildAutomationStep({
          id: 'step_1',
          type: 'condition',
          config: { condition: { field: 'lead.status', operator: 'equals', value: 'active' } },
          nextStepId: null,
          conditionTrueStepId: 'step_true',
          conditionFalseStepId: 'step_false',
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);

        await processAutomationStep('exec_1', 'step_1', { lead: { status: 'active' } });

        expect(mockAutomationQueue.add).toHaveBeenCalledWith('process-step', {
          executionId: 'exec_1',
          stepId: 'step_true',
          payload: { lead: { status: 'active' } },
        });
      });

      it('should route to false step when condition is not met', async () => {
        const step = buildAutomationStep({
          id: 'step_1',
          type: 'condition',
          config: { condition: { field: 'lead.status', operator: 'equals', value: 'active' } },
          nextStepId: null,
          conditionTrueStepId: 'step_true',
          conditionFalseStepId: 'step_false',
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);

        await processAutomationStep('exec_1', 'step_1', { lead: { status: 'inactive' } });

        expect(mockAutomationQueue.add).toHaveBeenCalledWith('process-step', {
          executionId: 'exec_1',
          stepId: 'step_false',
          payload: { lead: { status: 'inactive' } },
        });
      });
    });

    describe('create_task step', () => {
      it('should create a task record', async () => {
        const step = buildAutomationStep({
          id: 'step_1',
          type: 'create_task',
          automationId: 'auto_1',
          config: { title: 'Follow up', description: 'Call the lead', priority: 'high' },
          nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.task.create.mockResolvedValue(buildTask({ id: 'task_1' }));

        await processAutomationStep('exec_1', 'step_1', {});

        expect(mockPrisma.task.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            title: 'Follow up',
            description: 'Call the lead',
            priority: 'high',
            automationId: 'auto_1',
            automationExecutionId: 'exec_1',
          }),
        });
      });
    });

    describe('sequential step execution', () => {
      it('should queue next step after current step completes', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'update_lead_field', config: { field: 'status', value: 'qualified' }, nextStepId: 'step_2',
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.lead.update.mockResolvedValue({});

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockAutomationQueue.add).toHaveBeenCalledWith('process-step', {
          executionId: 'exec_1',
          stepId: 'step_2',
          payload: { lead: { id: 'lead_1' } },
        });
      });

      it('should complete execution when no next step', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'update_lead_field', config: { field: 'status', value: 'qualified' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.lead.update.mockResolvedValue({});

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockPrisma.automationExecution.update).toHaveBeenCalledWith({
          where: { id: 'exec_1' },
          data: expect.objectContaining({ status: 'completed' }),
        });
      });
    });

    describe('error handling', () => {
      it('should mark step and execution as failed on error', async () => {
        const step = buildAutomationStep({
          id: 'step_1', type: 'update_lead_field', config: { field: 'status', value: 'qualified' }, nextStepId: null,
        });
        mockPrisma.automationStep.findUnique.mockResolvedValue(step);
        mockPrisma.lead.update.mockRejectedValue(new Error('Database error'));

        await processAutomationStep('exec_1', 'step_1', { lead: { id: 'lead_1' } });

        expect(mockPrisma.automationExecutionStep.update).toHaveBeenCalledWith({
          where: { id: 'exstep_1' },
          data: expect.objectContaining({ status: 'failed', output: { error: 'Database error' } }),
        });
        expect(mockPrisma.automationExecution.update).toHaveBeenCalledWith({
          where: { id: 'exec_1' },
          data: expect.objectContaining({ status: 'failed', errorMessage: 'Database error' }),
        });
      });
    });
  });
});
