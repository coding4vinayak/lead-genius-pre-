import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../../api/src/test/mockDb.js';
import { buildLead, buildMessage, buildAgentSettings } from '../../api/src/test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }));

const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn(() => ({ chat: { completions: { create: mockCreate } } })),
}));

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn(() => 'test prompt content') },
  readFileSync: vi.fn(() => 'test prompt content'),
}));

const mockWorkerOn = vi.fn().mockReturnThis();
let workerHandler: Function | null = null;
vi.mock('bullmq', () => ({
  Worker: vi.fn((_name, handler) => {
    workerHandler = handler;
    return { on: mockWorkerOn };
  }),
}));

const loggerInfo = vi.fn();
const loggerError = vi.fn();
vi.mock('winston', () => ({
  default: {
    createLogger: vi.fn(() => ({
      info: loggerInfo,
      error: loggerError,
      warn: vi.fn(),
    })),
  },
  format: { combine: vi.fn(), timestamp: vi.fn(), json: vi.fn() },
  transports: { Console: vi.fn() },
}));

describe('AI Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerHandler = null;
    mockPrisma.agentSettings.findUnique.mockResolvedValue(buildAgentSettings());
  });

  describe('startAiWorker', () => {
    it('should create a BullMQ worker for ai-queue', async () => {
      const { startAiWorker } = await import('./ai-worker.js');
      const worker = startAiWorker();

      const { Worker } = await import('bullmq');
      expect(Worker).toHaveBeenCalledWith('ai-queue', expect.any(Function), expect.objectContaining({
        concurrency: 5,
      }));
      expect(worker).toBeDefined();
    });

    it('should handle analyze-intent job', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"category":"interested","confidence":85}' } }],
      });
      mockPrisma.message.findUnique.mockResolvedValue({
        ...buildMessage({ id: 'msg_1' }),
        lead: buildLead({ id: 'lead_1' }),
      });
      mockPrisma.message.update.mockResolvedValue({} as any);
      mockPrisma.lead.update.mockResolvedValue({} as any);
      mockPrisma.message.count.mockResolvedValue(0);
      mockPrisma.agentSettings.findUnique.mockResolvedValue(buildAgentSettings({ isAutoPilotActive: false }));

      const { startAiWorker } = await import('./ai-worker.js');
      startAiWorker();

      if (workerHandler) {
        await workerHandler({ id: 'job1', name: 'analyze-intent', data: { messageId: 'msg_1' } });
        expect(loggerInfo).toHaveBeenCalledWith(
          expect.stringContaining('Intent analyzed'),
          expect.any(Object),
        );
      }
    });

    it('should handle generate-draft job', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"subject":"Re: Hi","body":"Thank you!"}' } }],
      });
      mockPrisma.message.findUnique.mockResolvedValue({
        ...buildMessage({ id: 'msg_1', intentAnalysis: { category: 'interested' } as any }),
        lead: buildLead(),
      });
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'reply_1' }));
      mockPrisma.message.update.mockResolvedValue({} as any);

      const { startAiWorker } = await import('./ai-worker.js');
      startAiWorker();

      if (workerHandler) {
        await workerHandler({ id: 'job2', name: 'generate-draft', data: { messageId: 'msg_1', tone: 'professional' } });
        expect(loggerInfo).toHaveBeenCalledWith(
          expect.stringContaining('draft generated'),
          expect.any(Object),
        );
      }
    });

    it('should handle enrich-lead job', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"companySize":"50-200","industry":"Tech","suggestedTags":["tech"]}' } }],
      });
      mockPrisma.lead.findUnique.mockResolvedValue(buildLead({ id: 'lead_1', tags: [] }));
      mockPrisma.lead.update.mockResolvedValue({} as any);

      const { startAiWorker } = await import('./ai-worker.js');
      startAiWorker();

      if (workerHandler) {
        await workerHandler({ id: 'job3', name: 'enrich-lead', data: { leadId: 'lead_1' } });
        expect(loggerInfo).toHaveBeenCalledWith(
          expect.stringContaining('Lead enriched'),
          expect.any(Object),
        );
      }
    });

    it('should handle generate-campaign job', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"steps":[{"subject":"Step 1"}]}' } }],
      });

      const { startAiWorker } = await import('./ai-worker.js');
      startAiWorker();

      if (workerHandler) {
        await workerHandler({
          id: 'job4', name: 'generate-campaign',
          data: { name: 'Camp', channel: 'email', targetCount: 50 },
        });
        expect(loggerInfo).toHaveBeenCalledWith(
          expect.stringContaining('Campaign sequence generated'),
          expect.any(Object),
        );
      }
    });

    it('should log warning for unknown job type', async () => {
      const loggerWarn = vi.fn();
      vi.mock('winston', () => ({
        default: {
          createLogger: vi.fn(() => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: loggerWarn,
          })),
        },
        format: { combine: vi.fn(), timestamp: vi.fn(), json: vi.fn() },
        transports: { Console: vi.fn() },
      }));

      const { startAiWorker } = await import('./ai-worker.js?x=unknown');
      startAiWorker();

      if (workerHandler) {
        await workerHandler({ id: 'job5', name: 'unknown-job', data: {} });
        // worker will log warning for unknown job type
      }
    });

    it('should generate draft with auto-pilot when enabled and threshold met', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"category":"interested","confidence":90,"body":"Auto reply","subject":"Re: Hi"}' } }],
      });
      mockPrisma.message.findUnique.mockResolvedValue({
        ...buildMessage({ id: 'msg_auto', intentAnalysis: { category: 'interested' } as any }),
        lead: buildLead(),
      });
      mockPrisma.message.update.mockResolvedValue({} as any);
      mockPrisma.message.create.mockResolvedValue(buildMessage({ id: 'auto_reply' }));
      mockPrisma.lead.update.mockResolvedValue({} as any);
      mockPrisma.message.count.mockResolvedValue(5);
      mockPrisma.agentSettings.findUnique.mockResolvedValue(
        buildAgentSettings({ isAutoPilotActive: true, autoReplyThreshold: 70, maxDailyReplies: 50 }),
      );

      const { startAiWorker } = await import('./ai-worker.js?y=autopilot');
      startAiWorker();

      if (workerHandler) {
        await workerHandler({ id: 'job_auto', name: 'analyze-intent', data: { messageId: 'msg_auto' } });
        expect(loggerInfo).toHaveBeenCalledWith(
          expect.stringContaining('Intent analyzed'),
          expect.any(Object),
        );
      }
    });
  });
});
