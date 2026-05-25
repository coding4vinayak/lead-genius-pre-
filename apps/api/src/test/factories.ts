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
    autoReplyEnabled: false,
    reviewQueueEnabled: true,
    excludedIntents: [],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildAutomation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'auto_' + Math.random().toString(36).slice(2, 9),
    name: 'Test Automation',
    description: 'A test automation',
    triggerType: 'lead.created',
    triggerConfig: {},
    status: 'draft',
    isActive: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildAutomationStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step_' + Math.random().toString(36).slice(2, 9),
    automationId: 'auto_1',
    type: 'send_message',
    config: {},
    position: 0,
    nextStepId: null,
    conditionTrueStepId: null,
    conditionFalseStepId: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildAutomationExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exec_' + Math.random().toString(36).slice(2, 9),
    automationId: 'auto_1',
    triggerEvent: 'lead.created',
    triggerPayload: null,
    status: 'running',
    startedAt: new Date('2025-01-01T00:00:00Z'),
    completedAt: null,
    errorMessage: null,
    ...overrides,
  };
}

export function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_' + Math.random().toString(36).slice(2, 9),
    type: 'lead.created',
    entityType: 'lead',
    entityId: 'lead_1',
    payload: {},
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildWebhookSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wh_' + Math.random().toString(36).slice(2, 9),
    name: 'Test Webhook',
    url: 'https://example.com/webhook',
    events: ['lead.created'],
    secret: null,
    headers: null,
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildWebhookDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'whd_' + Math.random().toString(36).slice(2, 9),
    webhookId: 'wh_1',
    event: 'lead.created',
    payload: {},
    responseStatus: null,
    responseBody: null,
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: null,
    lastAttemptAt: null,
    status: 'pending',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildInboundWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: 'iwh_' + Math.random().toString(36).slice(2, 9),
    name: 'Test Inbound Webhook',
    description: null,
    token: 'tok_' + Math.random().toString(36).slice(2, 18),
    automationId: null,
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'int_' + Math.random().toString(36).slice(2, 9),
    type: 'slack',
    name: 'Test Integration',
    config: {},
    credentials: null,
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task_' + Math.random().toString(36).slice(2, 9),
    title: 'Test Task',
    description: null,
    assigneeId: null,
    status: 'pending',
    priority: 'medium',
    dueDate: null,
    automationId: null,
    automationExecutionId: null,
    metadata: null,
    completedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildSequence(overrides: Record<string, unknown> = {}) {
  return {
    id: 'seq_' + Math.random().toString(36).slice(2, 9),
    name: 'Test Sequence',
    description: 'A test drip sequence',
    status: 'draft',
    leadGroupIds: ['group_1'],
    triggerType: 'manual',
    triggerConfig: {},
    pauseOnReply: true,
    sendingWindowStart: null,
    sendingWindowEnd: null,
    dailyLimit: null,
    timezone: 'UTC',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildSequenceStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'seqstep_' + Math.random().toString(36).slice(2, 9),
    sequenceId: 'seq_1',
    position: 0,
    type: 'send_email',
    config: { templateId: 'tmpl_1' },
    nextStepId: null,
    conditionTrueStepId: null,
    conditionFalseStepId: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildSequenceEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enroll_' + Math.random().toString(36).slice(2, 9),
    sequenceId: 'seq_1',
    leadId: 'lead_1',
    status: 'active',
    currentStepId: 'seqstep_1',
    nextRunAt: new Date('2025-01-01T00:00:00Z'),
    startedAt: new Date('2025-01-01T00:00:00Z'),
    completedAt: null,
    exitReason: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildSequenceStepExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: 'seqexec_' + Math.random().toString(36).slice(2, 9),
    enrollmentId: 'enroll_1',
    stepId: 'seqstep_1',
    status: 'completed',
    executedAt: new Date('2025-01-01T00:00:00Z'),
    result: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildChannelHealth(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ch_' + Math.random().toString(36).slice(2, 9),
    channel: 'email',
    provider: 'smtp',
    status: 'healthy',
    dailySent: 100,
    dailyBounced: 2,
    dailyComplaints: 0,
    deliveryRate: 98,
    bounceRate: 2,
    lastCheckedAt: new Date('2025-01-01T00:00:00Z'),
    lastErrorMessage: null,
    quotaUsed: 100,
    quotaLimit: 10000,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildWhatsAppTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wat_' + Math.random().toString(36).slice(2, 9),
    name: 'Welcome Template',
    language: 'en',
    category: 'marketing',
    status: 'approved',
    body: 'Hello {{name}}, welcome to our service!',
    headerType: null,
    headerContent: null,
    footerText: null,
    buttons: null,
    twilioTemplateSid: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildEmailDomainAuth(overrides: Record<string, unknown> = {}) {
  return {
    id: 'eda_' + Math.random().toString(36).slice(2, 9),
    domain: 'example.com',
    spfStatus: 'verified',
    dkimStatus: 'verified',
    dmarcStatus: 'pending',
    lastVerifiedAt: new Date('2025-01-01T00:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildEmailVerification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_' + Math.random().toString(36).slice(2, 9),
    leadId: 'lead_1',
    email: 'test@example.com',
    status: 'valid',
    mxValid: true,
    smtpValid: true,
    verifiedAt: new Date('2025-01-01T00:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildSuppressionEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sup_' + Math.random().toString(36).slice(2, 9),
    email: 'suppressed@example.com',
    reason: 'bounce',
    source: 'system',
    campaignId: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildUnsubscribeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unsub_' + Math.random().toString(36).slice(2, 9),
    leadId: 'lead_1',
    email: 'user@example.com',
    reason: 'user_request',
    unsubscribedAt: new Date('2025-01-01T00:00:00Z'),
    ipAddress: '127.0.0.1',
    token: 'tok_' + Math.random().toString(36).slice(2, 18),
    messageId: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildGdprConsent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gdpr_' + Math.random().toString(36).slice(2, 9),
    leadId: 'lead_1',
    consentType: 'marketing_email',
    source: 'signup_form',
    givenAt: new Date('2025-01-01T00:00:00Z'),
    revokedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildWarmupSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ws_' + Math.random().toString(36).slice(2, 9),
    accountEmail: 'sender@example.com',
    status: 'warming',
    startDate: new Date('2025-01-01T00:00:00Z'),
    currentDay: 1,
    currentDailyLimit: 5,
    maxDailyLimit: 50,
    rampPercentage: 20,
    sentToday: 0,
    bouncedToday: 0,
    bounceThreshold: 5,
    pausedReason: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildWarmupLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wl_' + Math.random().toString(36).slice(2, 9),
    scheduleId: 'ws_1',
    day: 1,
    sent: 5,
    bounced: 0,
    delivered: 5,
    date: new Date('2025-01-01T00:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildEmailAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ea_' + Math.random().toString(36).slice(2, 9),
    email: 'sender@example.com',
    name: 'Main Sender',
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUser: 'user',
    smtpPass: 'pass',
    sendgridApiKey: null,
    dailyLimit: 100,
    sentToday: 0,
    warmupStatus: 'completed',
    isActive: true,
    reputationScore: 95,
    bounceRate: 2,
    lastResetAt: new Date('2025-01-01T00:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildTrackingDomain(overrides: Record<string, unknown> = {}) {
  return {
    id: 'td_' + Math.random().toString(36).slice(2, 9),
    domain: 'track.example.com',
    cnameTarget: 'tracking.leadgenius.io',
    cnameVerified: false,
    status: 'pending',
    verifiedAt: null,
    isDefault: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildAccountRotationConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'arc_' + Math.random().toString(36).slice(2, 9),
    strategy: 'round_robin',
    weights: null,
    skipOnDailyLimit: true,
    skipOnHighBounce: true,
    bounceThreshold: 10,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ws_' + Math.random().toString(36).slice(2, 9),
    name: 'Test Workspace',
    slug: 'test-workspace',
    plan: 'free',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    physicalAddress: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildWorkspaceMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wm_' + Math.random().toString(36).slice(2, 9),
    workspaceId: 'ws_1',
    userId: 'user_1',
    role: 'member',
    invitedAt: new Date('2025-01-01T00:00:00Z'),
    joinedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildWorkspaceInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wi_' + Math.random().toString(36).slice(2, 9),
    workspaceId: 'ws_1',
    email: 'invited@example.com',
    role: 'member',
    token: 'tok_' + Math.random().toString(36).slice(2, 18),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildUsageRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ur_' + Math.random().toString(36).slice(2, 9),
    workspaceId: 'ws_1',
    metric: 'emails_sent',
    value: 50,
    period: 'monthly',
    periodStart: new Date('2025-01-01T00:00:00Z'),
    periodEnd: new Date('2025-01-31T23:59:59Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildBillingEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'be_' + Math.random().toString(36).slice(2, 9),
    workspaceId: 'ws_1',
    stripeEventId: 'evt_' + Math.random().toString(36).slice(2, 18),
    type: 'invoice.paid',
    data: { amount: 4900 },
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}
