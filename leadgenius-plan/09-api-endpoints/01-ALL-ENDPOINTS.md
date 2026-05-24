# API ENDPOINTS - LeadGenius
## Full RESTful API Design with Zod Schemas

================================================================================
## BASE CONFIGURATION
================================================================================

Base URL: https://api.leadgenius.com/v1
Content-Type: application/json
Auth: Bearer <JWT> (dashboard) | X-API-Key <key> (B2B)
Rate Limit: 1000 req/min (dashboard), 100 req/min (API key)

================================================================================
## AUTH ENDPOINTS
================================================================================

### POST /v1/auth/signup
  Body:    { email, password, fullName, workspaceName }
  Returns: { user, session, workspace }
  Errors:  400 (validation), 409 (email exists)

### POST /v1/auth/login
  Body:    { email, password }
  Returns: { user, session }
  Errors:  401 (invalid credentials)

### POST /v1/auth/logout
  Headers: Authorization: Bearer <token>
  Returns: { success: true }

### GET /v1/auth/session
  Headers: Authorization: Bearer <token>
  Returns: { user, workspace, permissions }

### POST /v1/auth/forgot-password
  Body:    { email }
  Returns: { message: "Check your email" }

### POST /v1/auth/reset-password
  Body:    { token, password }
  Returns: { success: true }

================================================================================
## WORKSPACE ENDPOINTS
================================================================================

### GET /v1/workspace
  Returns: { workspace, usage, billing }

### PUT /v1/workspace
  Body:    { name, settings, timezone, ... }
  Returns: { workspace }

### GET /v1/workspace/members
  Returns: { members: [{ id, email, name, role, status }] }

### POST /v1/workspace/members
  Body:    { email, role }
  Returns: { member, invitation }
  Errors:  400 (already member), 404 (user not found)

### DELETE /v1/workspace/members/:id
  Returns: { success: true }

### PATCH /v1/workspace/members/:id
  Body:    { role }
  Returns: { member }

================================================================================
## LEAD ENDPOINTS
================================================================================

### GET /v1/leads
  Query:   ?status=new&source=manual&search=john&sort=-created_at&page=1&pageSize=25
  Returns: { leads: Lead[], total: number, page: number, pageSize: number }
  Filters: status, source, campaignId, search (name/email/company), tags
  Sort:    created_at, name, status, score, last_contacted_at (prefix - for desc)

### GET /v1/leads/:id
  Returns: { lead: Lead, messages: Message[], campaign: Campaign }

### POST /v1/leads
  Body:    { name, email?, phone?, company?, title?, source?, tags?, customFields? }
  Returns: { lead }
  Zod Schema:
    name: z.string().min(1).max(255),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional().or(z.literal('')),
    company: z.string().max(255).optional(),
    title: z.string().max(255).optional(),
    source: z.enum(['apollo','google_maps','csv','manual','api','webhook']).default('manual'),
    tags: z.array(z.string()).default([])
  At least one of email or phone is required.

### PUT /v1/leads/:id
  Body:    Partial<Lead>
  Returns: { lead }

### DELETE /v1/leads/:id
  Returns: { success: true }

### POST /v1/leads/bulk-delete
  Body:    { ids: string[] }
  Returns: { deleted: number }

### POST /v1/leads/bulk-status
  Body:    { ids: string[], status: LeadStatus }
  Returns: { updated: number }

### POST /v1/leads/import
  Content-Type: multipart/form-data
  Body:    file (CSV), columnMapping (JSON)
  Returns: { inserted: number, errors: ImportError[], enriched: number }
  Max file size: 10MB

### POST /v1/leads/:id/enrich
  Returns: { lead }
  Action:  Queues AI enrichment worker

### POST /v1/leads/bulk-enrich
  Body:    { ids: string[] }
  Returns: { queued: number }

================================================================================
## CAMPAIGN ENDPOINTS
================================================================================

### GET /v1/campaigns
  Query:   ?status=active
  Returns: { campaigns: Campaign[] }

### GET /v1/campaigns/:id
  Returns: { campaign, leads: Lead[], stats: CampaignStats }

### POST /v1/campaigns
  Body:    { name, product?, industry?, occasion?, sequenceConfig? }
  Returns: { campaign }

### PUT /v1/campaigns/:id
  Body:    Partial<Campaign>
  Returns: { campaign }

### DELETE /v1/campaigns/:id
  Returns: { success: true }
  Note:    Also deletes associated leads if cascade=true

### POST /v1/campaigns/:id/activate
  Returns: { campaign, stats }
  Action:  Sets status=active, schedules leads

### POST /v1/campaigns/:id/pause
  Returns: { campaign }

### POST /v1/campaigns/:id/generate
  Body:    { product, industry, occasion }
  Returns: { sequence: CampaignStep[] }
  Action:  Calls AI to generate campaign sequence

### POST /v1/campaigns/:id/enroll
  Body:    { leadIds: string[] }
  Returns: { enrolled: number }
  Action:  Assigns leads to campaign, sets next_action_at

================================================================================
## MESSAGE ENDPOINTS
================================================================================

### GET /v1/messages
  Query:   ?leadId=xxx&channel=email&unread=true&page=1&pageSize=50
  Returns: { messages: Message[], total: number }

### GET /v1/messages/:id
  Returns: { message, lead, campaign }

### POST /v1/messages
  Body:    { leadId, content, subject?, channel, campaignId? }
  Returns: { message }
  Action:  Sends via Twilio/SendGrid immediately

### GET /v1/inbox
  Query:   ?filter=unread|high_intent|all&search=xxx
  Returns: { conversations: Conversation[] }
  Conversation: { lead, lastMessage, unreadCount, intent }

### GET /v1/inbox/:leadId
  Returns: { lead, messages: Message[], draft }

### PATCH /v1/messages/:id/read
  Returns: { message }

### POST /v1/messages/:id/send-draft
  Returns: { message }
  Action:  Sends the AI-generated draft_reply

### POST /v1/messages/:id/regenerate-draft
  Returns: { message }
  Action:  Re-generates AI draft

================================================================================
## AI ENDPOINTS
================================================================================

### POST /v1/ai/analyze-intent
  Body:    { leadId, messageId? }
  Returns: { intent: IntentResult }
  Action:  Analyzes latest lead message via Gemini

### POST /v1/ai/generate-draft
  Body:    { leadId, messageId }
  Returns: { draft: string }

### POST /v1/ai/enrich-lead
  Body:    { leadId }
  Returns: { enrichment: EnrichmentResult }

### POST /v1/ai/generate-campaign
  Body:    { product, industry, occasion }
  Returns: { sequence: CampaignStep[] }

================================================================================
## AGENT SETTINGS ENDPOINTS
================================================================================

### GET /v1/agent-settings
  Returns: { settings: AgentSettings }

### PUT /v1/agent-settings
  Body:    Partial<AgentSettings>
  Returns: { settings }

### POST /v1/agent-settings/toggle-autopilot
  Returns: { settings }
  Action:  Toggles is_auto_pilot_active

================================================================================
## ACTIVITY LOG ENDPOINTS
================================================================================

### GET /v1/activity-logs
  Query:   ?type=ai_process&severity=error&limit=50&before=cursor
  Returns: { logs: ActivityLog[], nextCursor: string }
  Pagination: cursor-based for real-time feed

================================================================================
## API KEY ENDPOINTS
================================================================================

### GET /v1/api-keys
  Returns: { keys: ApiKey[] }

### POST /v1/api-keys
  Body:    { label, permissions }
  Returns: { key: ApiKey (with full key, shown once), fullKey: string }
  Note:    fullKey is only returned once (e.g. "lg_live_xxxxx")

### DELETE /v1/api-keys/:id
  Returns: { success: true }

================================================================================
## USAGE & BILLING ENDPOINTS
================================================================================

### GET /v1/usage
  Query:   ?period=current|last&metric=ai_message
  Returns: { usage: UsageRecord[], totals: { metric: count } }

### GET /v1/billing/invoices
  Returns: { invoices: Invoice[] }

### GET /v1/billing/upcoming
  Returns: { upcomingInvoice: Invoice }

### POST /v1/billing/create-checkout
  Body:    { priceId: string }
  Returns: { url: string } (Stripe checkout URL)

### POST /v1/billing/portal
  Returns: { url: string } (Stripe customer portal URL)

================================================================================
## WEBHOOK ENDPOINTS
================================================================================

### POST /webhook/reply
  Provider: Twilio (WhatsApp) / SendGrid (Email)
  Action:   Parses inbound message, creates record, queues AI analysis
  Returns:  200 OK (always, to acknowledge receipt)

### POST /webhook/email-bounce
  Provider: SendGrid event webhook
  Action:   Marks message as failed, updates lead status

### POST /webhook/stripe
  Provider: Stripe
  Action:   Handles subscription events
  Verification: Stripe signature header

### POST /webhook/twilio-status
  Provider: Twilio status callback
  Action:   Updates message delivery status

================================================================================
## MCP ENDPOINTS (Model Context Protocol)
================================================================================

### GET /mcp/tools
  Returns: ToolDefinition[] (for MCP discovery)

### POST /mcp/call
  Body:    { toolName, arguments }
  Returns: { result }
  Implements the MCP tool calling standard

### GET /mcp/resources
  Returns: ResourceDefinition[]

### GET /mcp/resource/:uri
  Returns: { resource }

### GET /mcp/prompts
  Returns: PromptTemplate[]

### POST /mcp/prompt/:name
  Body:    { arguments }
  Returns: { prompt }

================================================================================
## ERROR RESPONSE FORMAT
================================================================================

All errors follow this structure:

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ],
    "requestId": "req_abc123"
  }
}

Error Codes:
  VALIDATION_ERROR    - 400 - Invalid input
  UNAUTHORIZED        - 401 - Missing/invalid auth
  FORBIDDEN           - 403 - Insufficient permissions
  NOT_FOUND           - 404 - Resource not found
  RATE_LIMITED        - 429 - Too many requests
  INTERNAL_ERROR      - 500 - Server error
  PROVIDER_ERROR      - 502 - Twilio/SendGrid/Gemini error
  PAYMENT_REQUIRED    - 402 - Plan upgrade needed

Rate Limit Headers:
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 999
  X-RateLimit-Reset: 1620000000
  Retry-After: 45

================================================================================
## ZOD SCHEMA DEFINITIONS
================================================================================

// src/schemas/lead.ts
export const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone').optional().or(z.literal('')),
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  source: z.enum(['apollo','google_maps','csv','manual','api','webhook']).default('manual'),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.string(), z.unknown()).default({})
}).refine(data => data.email || data.phone, {
  message: 'At least one of email or phone is required'
});

// src/schemas/campaign.ts
export const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  product: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  occasion: z.string().max(1000).optional(),
  sequenceConfig: z.array(campaignStepSchema).optional()
});

export const campaignStepSchema = z.object({
  day: z.number().int().min(1).max(30),
  channel: z.enum(['email', 'whatsapp']),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
  delayHours: z.number().int().min(0).default(0),
  goal: z.enum(['introduction','value_proposition','case_study','demo_invite','close','follow_up']).optional()
});

// src/schemas/message.ts
export const sendMessageSchema = z.object({
  leadId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  subject: z.string().max(500).optional(),
  channel: z.enum(['email', 'whatsapp']),
  campaignId: z.string().uuid().optional()
});
