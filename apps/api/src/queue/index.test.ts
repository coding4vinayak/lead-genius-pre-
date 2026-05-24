import { describe, it, expect, vi } from 'vitest';

const { mockQueue, mockWorker } = vi.hoisted(() => ({
  mockQueue: vi.fn(function() { return { add: vi.fn(), close: vi.fn() }; }),
  mockWorker: vi.fn(function() { return { on: vi.fn(), close: vi.fn() }; }),
}));

vi.mock('bullmq', () => ({
  Queue: mockQueue,
  Worker: mockWorker,
}));

vi.mock('../queue/index.js', async () => ({
  ...(await vi.importActual<typeof import('./index')>('./index')),
}));

const { campaignQueue, sendQueue, aiQueue, createCampaignWorker, createSendWorker, createAiWorker } = await import('./index.js');

describe('Queue setup', () => {
  it('should create campaign queue with 3 retries', () => {
    expect(mockQueue).toHaveBeenCalledWith('campaign-queue', expect.objectContaining({
      defaultJobOptions: expect.objectContaining({ attempts: 3 }),
    }));
  });

  it('should create send queue with 3 retries', () => {
    expect(mockQueue).toHaveBeenCalledWith('send-queue', expect.objectContaining({
      defaultJobOptions: expect.objectContaining({ attempts: 3 }),
    }));
  });

  it('should create AI queue with 2 retries', () => {
    expect(mockQueue).toHaveBeenCalledWith('ai-queue', expect.objectContaining({
      defaultJobOptions: expect.objectContaining({ attempts: 2 }),
    }));
  });

  it('should export queue instances', () => {
    expect(campaignQueue).toBeDefined();
    expect(sendQueue).toBeDefined();
    expect(aiQueue).toBeDefined();
  });

  it('createCampaignWorker should use concurrency 5', async () => {
    await createCampaignWorker(vi.fn());
    expect(mockWorker).toHaveBeenCalledWith('campaign-queue', expect.any(Function), expect.objectContaining({ concurrency: 5 }));
  });

  it('createSendWorker should use concurrency 20', async () => {
    await createSendWorker(vi.fn());
    expect(mockWorker).toHaveBeenCalledWith('send-queue', expect.any(Function), expect.objectContaining({ concurrency: 20 }));
  });

  it('createAiWorker should use concurrency 5', async () => {
    await createAiWorker(vi.fn());
    expect(mockWorker).toHaveBeenCalledWith('ai-queue', expect.any(Function), expect.objectContaining({ concurrency: 5 }));
  });
});
