import { describe, it, expect, vi } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add: vi.fn(), close: vi.fn() })),
}));

const { sendQueue } = await import('./send-queue.js');

describe('send-queue', () => {
  it('should create a send queue instance', () => {
    expect(sendQueue).toBeDefined();
  });

  it('should have 3 retry attempts', async () => {
    const { Queue } = await import('bullmq');
    expect(Queue).toHaveBeenCalledWith('send-queue', expect.objectContaining({
      defaultJobOptions: expect.objectContaining({ attempts: 3 }),
    }));
  });
});
