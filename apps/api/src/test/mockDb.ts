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
  $connect: MockFn;
  $disconnect: MockFn;
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
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
}
