import { vi } from 'vitest';

vi.mock('../queue/index.js', () => ({
  campaignQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  sendQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  aiQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  createCampaignWorker: vi.fn(),
  createSendWorker: vi.fn(),
  createAiWorker: vi.fn(),
}));


