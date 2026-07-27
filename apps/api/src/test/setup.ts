import { vi } from 'vitest';

vi.mock('../queue/index.js', () => ({
  campaignQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  sendQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  aiQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  eventQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  automationQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  webhookQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  createCampaignWorker: vi.fn(),
  createSendWorker: vi.fn(),
  createAiWorker: vi.fn(),
  createEventWorker: vi.fn(),
  createAutomationWorker: vi.fn(),
  createWebhookWorker: vi.fn(),
}));

vi.mock('../queue/event-queue.js', () => ({
  eventQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  createEventWorker: vi.fn(),
}));

vi.mock('../queue/automation-queue.js', () => ({
  automationQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  createAutomationWorker: vi.fn(),
}));

vi.mock('../queue/webhook-queue.js', () => ({
  webhookQueue: { add: vi.fn().mockResolvedValue(undefined as never) },
  createWebhookWorker: vi.fn(),
}));


