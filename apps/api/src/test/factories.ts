export function buildLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead_' + Math.random().toString(36).slice(2, 9),
    email: 'test@example.com',
    phone: '+1234567890',
    name: 'John Doe',
    company: 'Acme Inc',
    title: 'CEO',
    source: 'manual',
    status: 'active',
    tags: ['tech'],
    customFields: null,
    score: null,
    enrichmentData: null,
    intentAnalysis: null,
    currentStep: null,
    nextActionAt: null,
    lastContactedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group_' + Math.random().toString(36).slice(2, 9),
    name: 'Test Group',
    description: 'A test group',
    filterRules: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    _count: { members: 3 },
    ...overrides,
  };
}

export function buildTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tmpl_' + Math.random().toString(36).slice(2, 9),
    name: 'Welcome Email',
    channel: 'email',
    subject: 'Hello {{name}}',
    body: '<p>Hi {{name}}, welcome!</p>',
    variables: ['name'],
    category: 'onboarding',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'camp_' + Math.random().toString(36).slice(2, 9),
    name: 'Q1 Outreach',
    description: 'Q1 campaign',
    status: 'draft',
    channel: 'email',
    templateId: 'tmpl_1',
    leadGroupIds: ['group_1'],
    productFilter: null,
    scheduleType: 'immediate',
    scheduledAt: null,
    recurringRule: null,
    sendStrategy: 'sequential',
    dailyLimit: 100,
    minDelayMs: 1000,
    sentCount: 0,
    failedCount: 0,
    replyCount: 0,
    openedCount: 0,
    clickedCount: 0,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_' + Math.random().toString(36).slice(2, 9),
    campaignId: null,
    leadId: 'lead_1',
    channel: 'email',
    direction: 'outbound',
    subject: 'Hello',
    body: 'Test message body',
    status: 'queued',
    providerId: null,
    errorMessage: null,
    isAiGenerated: false,
    intentAnalysis: null,
    draftReply: null,
    deliveredAt: null,
    readAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global',
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUser: 'user',
    smtpPass: 'pass',
    sendgridApiKey: null,
    twilioAccountSid: 'sid',
    twilioAuthToken: 'token',
    twilioFromNumber: '+1234567890',
    fromEmail: 'noreply@example.com',
    fromName: 'LeadGenius',
    dailyGlobalLimit: 1000,
    defaultMinDelayMs: 30000,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildAgentSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global',
    aiProvider: 'openai',
    aiModel: 'gpt-4o-mini',
    aiApiKey: null,
    aiBaseUrl: null,
    tone: 'professional',
    autoReplyThreshold: 70,
    isAutoPilotActive: false,
    maxDailyReplies: 50,
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    humanHandoffRules: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}
