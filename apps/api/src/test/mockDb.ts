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
  groupBy: MockFn;
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
    groupBy: vi.fn(),
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
  sequence: MockModel;
  sequenceStep: MockModel;
  sequenceEnrollment: MockModel;
  sequenceStepExecution: MockModel;
  channelHealth: MockModel;
  whatsAppTemplate: MockModel;
  emailDomainAuth: MockModel;
  emailVerification: MockModel;
  suppressionEntry: MockModel;
  unsubscribeRecord: MockModel;
  gdprConsent: MockModel;
  warmupSchedule: MockModel;
  warmupLog: MockModel;
  emailAccount: MockModel;
  trackingDomain: MockModel;
  accountRotationConfig: MockModel;
  workspace: MockModel;
  workspaceMember: MockModel;
  workspaceInvite: MockModel;
  usageRecord: MockModel;
  billingEvent: MockModel;
  user: MockModel;
  crmSync: MockModel;
  calendarBooking: MockModel;
  slackNotification: MockModel;
  webhookTemplate: MockModel;
  recipe: MockModel;
  abTest: MockModel;
  abTestVariant: MockModel;
  sendTimePreference: MockModel;
  analyticsSnapshot: MockModel;
  performanceBenchmark: MockModel;
  notification: MockModel;
  notificationPreference: MockModel;
  enrichmentLog: MockModel;
  apiKey: MockModel;
  apiKeyUsage: MockModel;
  linkedInProfile: MockModel;
  linkedInMessage: MockModel;
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
    sequence: mockModel(),
    sequenceStep: mockModel(),
    sequenceEnrollment: mockModel(),
    sequenceStepExecution: mockModel(),
    channelHealth: mockModel(),
    whatsAppTemplate: mockModel(),
    emailDomainAuth: mockModel(),
    emailVerification: mockModel(),
    suppressionEntry: mockModel(),
    unsubscribeRecord: mockModel(),
    gdprConsent: mockModel(),
    warmupSchedule: mockModel(),
    warmupLog: mockModel(),
    emailAccount: mockModel(),
    trackingDomain: mockModel(),
    accountRotationConfig: mockModel(),
    workspace: mockModel(),
    workspaceMember: mockModel(),
    workspaceInvite: mockModel(),
    usageRecord: mockModel(),
    billingEvent: mockModel(),
    user: mockModel(),
    crmSync: mockModel(),
    calendarBooking: mockModel(),
    slackNotification: mockModel(),
    webhookTemplate: mockModel(),
    recipe: mockModel(),
    abTest: mockModel(),
    abTestVariant: mockModel(),
    sendTimePreference: mockModel(),
    analyticsSnapshot: mockModel(),
    performanceBenchmark: mockModel(),
    notification: mockModel(),
    notificationPreference: mockModel(),
    enrichmentLog: mockModel(),
    apiKey: mockModel(),
    apiKeyUsage: mockModel(),
    linkedInProfile: mockModel(),
    linkedInMessage: mockModel(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(createMockPrisma())),
  };
}
