import { vi } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

export interface MockModel {
  findUnique: MockFn;
  findMany: MockFn;
  findFirst: MockFn;
  count: MockFn;
  create: MockFn;
  createMany: MockFn;
  update: MockFn;
  updateMany: MockFn;
  upsert: MockFn;
  delete: MockFn;
  deleteMany: MockFn;
}

function mockModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
}

export interface MockPrismaClient {
  lead: MockModel;
  leadGroup: MockModel;
  groupMember: MockModel;
  template: MockModel;
  campaign: MockModel;
  message: MockModel;
  settings: MockModel;
  agentSettings: MockModel;
  automation: MockModel;
  automationStep: MockModel;
  automationExecution: MockModel;
  automationExecutionStep: MockModel;
  event: MockModel;
  webhookSubscription: MockModel;
  webhookDelivery: MockModel;
  inboundWebhook: MockModel;
  integration: MockModel;
  task: MockModel;
  $connect: MockFn;
  $disconnect: MockFn;
  $transaction: MockFn;
}

export function createMockPrisma(): MockPrismaClient {
  return {
    lead: mockModel(),
    leadGroup: mockModel(),
    groupMember: mockModel(),
    template: mockModel(),
    campaign: mockModel(),
    message: mockModel(),
    settings: mockModel(),
    agentSettings: mockModel(),
    automation: mockModel(),
    automationStep: mockModel(),
    automationExecution: mockModel(),
    automationExecutionStep: mockModel(),
    event: mockModel(),
    webhookSubscription: mockModel(),
    webhookDelivery: mockModel(),
    inboundWebhook: mockModel(),
    integration: mockModel(),
    task: mockModel(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(createMockPrisma())),
  };
}
