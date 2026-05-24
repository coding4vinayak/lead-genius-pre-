# LEADGENIUS — EXECUTION PLAN (Node.js + Express + BullMQ + Redis + Prisma + PostgreSQL)
## AI-Powered Multi-Tenant SDR SaaS Platform — Industrial Grade, Millions of Users

================================================================================
1. PROJECT STRUCTURE
================================================================================

leadgenius/                          # Monorepo root
├── apps/
│   ├── api/                         # Express backend (Node.js)
│   │   ├── src/
│   │   │   ├── index.ts             # Express app entry
│   │   │   ├── config/              # env, redis, db config
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts          # JWT + API key auth
│   │   │   │   ├── rate-limit.ts    # Rate limiting
│   │   │   │   ├── workspace.ts     # Workspace context
│   │   │   │   └── error-handler.ts # Global error handler
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts          # Signup, login, session
│   │   │   │   ├── leads.ts         # CRUD + import + enrich
│   │   │   │   ├── campaigns.ts     # CRUD + activate + pause
│   │   │   │   ├── messages.ts      # Send + inbox + drafts
│   │   │   │   ├── inbox.ts         # Conversations
│   │   │   │   ├── agent.ts         # Agent settings
│   │   │   │   ├── billing.ts       # Plans + usage + checkout
│   │   │   │   ├── api-keys.ts      # API key management
│   │   │   │   ├── activity.ts      # Activity logs
│   │   │   │   ├── webhooks/
│   │   │   │   │   ├── twilio.ts
│   │   │   │   │   ├── sendgrid.ts
│   │   │   │   │   └── stripe.ts
│   │   │   │   └── mcp.ts           # MCP protocol
│   │   │   ├── services/
│   │   │   │   ├── ai/
│   │   │   │   │   ├── index.ts     # AI router (primary + fallback)
│   │   │   │   │   ├── gemini.ts    # Gemini provider
│   │   │   │   │   └── prompts/
│   │   │   │   │       ├── intent-analysis.txt
│   │   │   │   │       ├── draft-reply.txt
│   │   │   │   │       ├── lead-enrichment.txt
│   │   │   │   │       └── campaign-generation.txt
│   │   │   │   ├── email.ts         # Nodemailer + SendGrid
│   │   │   │   ├── whatsapp.ts      # Twilio
│   │   │   │   └── billing.ts       # Stripe
│   │   │   ├── queue/
│   │   │   │   └── index.ts         # BullMQ queue definitions
│   │   │   └── lib/
│   │   │       ├── crypto.ts        # AES-256 encryption
│   │   │       ├── errors.ts        # Custom error classes
│   │   │       └── validation.ts    # Zod schemas
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database schema
│   │   │   └── seed.ts              # Seed data
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── web/                         # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx              # Router + layout
│   │   │   ├── pages/               # 13 screen components
│   │   │   ├── components/          # Shared component library
│   │   │   │   ├── ui/              # Button, Card, Input, Modal, Badge, etc.
│   │   │   │   ├── layout/          # Sidebar, Header
│   │   │   │   └── charts/          # Recharts wrappers
│   │   │   ├── hooks/               # Custom React hooks
│   │   │   ├── lib/
│   │   │   │   ├── api.ts           # Axios/fetch wrapper
│   │   │   │   └── auth.ts          # Auth client
│   │   │   └── styles/
│   │   │       └── app.css          # Tailwind imports
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── workers/                     # BullMQ workers (Node.js)
│       ├── src/
│       │   ├── index.ts             # Worker entry
│       │   ├── campaign-worker.ts   # Send campaign messages
│       │   ├── ai-worker.ts         # AI operations (intent, draft, enrich)
│       │   ├── webhook-worker.ts    # Process inbound webhooks
│       │   └── billing-worker.ts    # Usage tracking + Stripe
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                      # Shared types + Zod schemas
│       ├── src/
│       │   ├── types/
│       │   │   ├── lead.ts
│       │   │   ├── campaign.ts
│       │   │   ├── message.ts
│       │   │   ├── workspace.ts
│       │   │   └── billing.ts
│       │   └── schemas/
│       │       ├── lead.ts
│       │       ├── campaign.ts
│       │       └── message.ts
│       └── package.json
│
├── docker-compose.yml
├── .env.example
├── turbo.json
├── package.json
└── README.md

================================================================================
2. TECH STACK
================================================================================

Runtime:          Node.js (LTS 22)
Backend:          Express.js (most proven Node.js framework)
Database ORM:     Prisma (type-safe, auto-generated client, migrations)
Queue:            BullMQ (industry standard queue)
Cache/Sessions:   Redis (battle-tested, used by Twitter/GitHub)
Auth:             Better-Auth (open source, MIT, Express-native) 
Database:         PostgreSQL 16 (self-hosted)
Frontend:         React 19 + Vite + TanStack Query + Zustand + Recharts
Styling:          Tailwind CSS 4 + Lucide Icons + Framer Motion
Validation:       Zod (industry standard TypeScript validation)
Email:            Nodemailer + SendGrid SDK
WhatsApp:         Twilio SDK
Billing:          Stripe SDK
AI:               Gemini API (primary) + fallback OpenAI/Anthropic
Testing:          Jest + Supertest + Playwright
Monitoring:       Prometheus + Grafana + Loki
Deployment:       Docker Compose -> Docker Swarm -> Kubernetes

================================================================================
3. DATABASE SCHEMA (Prisma — 11 Models)
================================================================================

workspaces:      id, name, slug, planTier, isActive, maxSeats/Leads/Campaigns,
                 aiEnabled, autoPilotEnabled, stripe fields, settings JSONB

users:           id, email, passwordHash, fullName, avatarUrl, isSuperAdmin

teamMembers:     id, workspaceId, userId, role(admin/member/viewer), 
                 invitedBy, invitationStatus, joinedAt
                 UNIQUE(workspaceId, userId)

apiKeys:         id, workspaceId, keyPrefix, keyHash, label, permissions,
                 isActive, lastUsedAt, expiresAt, createdBy

campaigns:       id, workspaceId, name, product, industry, status, 
                 sequenceConfig JSONB, totalLeads, sentCount, replyCount,
                 conversionCount, startedAt, completedAt

leads:           id, workspaceId, campaignId, name, email, phone, company,
                 title, source, status, tags[], score, enrichmentData JSONB,
                 intentAnalysis JSONB, currentStep, nextActionAt

messages:        id, workspaceId, leadId, campaignId, content, subject,
                 direction, channel, status, isRead, isAiGenerated,
                 intentAnalysis JSONB, draftReply, providerMessageId

agentSettings:   id, workspaceId(unique), aiProvider, aiModel, tone,
                 autoReplyThreshold, isAutoPilotActive, maxDailyReplies

activityLogs:    id, workspaceId, leadId, campaignId, eventType,
                 severity, title, description, metadata JSONB
                 (indexed by workspaceId + createdAt for fast queries)

usageRecords:    id, workspaceId, metric, quantity, meteredAt
                 (indexed by workspaceId + meteredAt + metric)

stripeCustomers: id, workspaceId(unique), stripeCustomerId(unique),
                 subscriptionStatus, currentPeriodStart/End

================================================================================
4. API ROUTES (Express)
================================================================================

GET    /api/health
POST   /api/auth/signup, /login, /logout, /forgot-password, /reset-password
GET    /api/auth/session
GET    /api/workspace, /api/workspace/members
PUT    /api/workspace
POST   /api/workspace/members  (invite)
DELETE /api/workspace/members/:id
PATCH  /api/workspace/members/:id  (change role)
GET    /api/leads (query: status, source, search, sort, page, pageSize)
GET    /api/leads/:id
POST   /api/leads
PUT    /api/leads/:id
DELETE /api/leads/:id
POST   /api/leads/bulk-delete, /bulk-status, /import, /bulk-enrich
POST   /api/leads/:id/enrich
GET    /api/campaigns
GET    /api/campaigns/:id
POST   /api/campaigns
PUT    /api/campaigns/:id
DELETE /api/campaigns/:id
POST   /api/campaigns/:id/activate, /pause, /generate, /enroll
GET    /api/messages, /api/inbox, /api/inbox/:leadId
POST   /api/messages
PATCH  /api/messages/:id/read
POST   /api/messages/:id/send-draft, /regenerate-draft
GET    /api/agent, /api/api-keys
PUT    /api/agent
POST   /api/agent/toggle-autopilot
POST   /api/api-keys, DELETE /api/api-keys/:id
GET    /api/activity-logs
GET    /api/billing/invoices, /api/billing/usage, /api/billing/upcoming
POST   /api/billing/create-checkout, /portal
POST   /api/ai/analyze-intent, /generate-draft, /enrich-lead, /generate-campaign
POST   /webhook/reply, /webhook/email-bounce, /webhook/stripe, /webhook/twilio-status
GET    /mcp/tools, /mcp/resources, /mcp/prompts
POST   /mcp/call, /mcp/prompt/:name
GET    /mcp/resource/:uri

================================================================================
5. ALL 13 SCREENS
================================================================================

PHASE 1 (CORE):
  01 Dashboard:     KPI cards, pie/bar charts (Recharts), activity feed, 30s auto-refresh
  02 Leads:         Data table, filter bar, search, sort, pagination, bulk actions,
                    import CSV modal (drag-drop + column mapping), add lead modal
  03 Campaigns:     Card grid, 4-step wizard (basics -> sequence -> leads -> review),
                    AI generate sequence, campaign detail with stats
  04 AI Inbox:      Split pane, conversation list, message thread, AI intent badges,
                    AI draft suggestion (Edit/Send/Regenerate), reply box
  05 Agent:         Auto-pilot toggle, AI provider config, tone selector,
                    auto-reply settings, working hours, human handoff rules

PHASE 2 (AUTOMATION):
  06 Live Engine:   Real-time activity log (SSE), stats bar, filter tabs,
                    expandable entries, severity dots, auto-scroll
  07 Pipeline:      Kanban board with drag-drop columns, lead cards,
                    column counts, optimistic status updates

PHASE 3 (INTEGRATIONS):
  08 Integrations:  Twilio/SendGrid/Stripe/MCP connect cards, config modals
  09 Deliverability:SPF/DKIM/DMARC checks, deliverability gauge, bounce chart
  10 Deploy:        Docker Compose guide, env vars, health check, download button

PHASE 4 (ENTERPRISE):
  11 System Plan:   Architecture tabs, code blocks with syntax highlighting
  12 Multi-Tenancy: Workspace table, API key gen, team member management
  13 Strategy:      Business plan, pricing table, MRR calculator, launch checklist

================================================================================
6. QUEUES (BullMQ)
================================================================================

campaign-queue:  send-campaign-message  | concurrency=10, retries=3
ai-queue:        analyze-intent          | concurrency=5,  retries=2
                 generate-draft          |
                 enrich-lead             |
                 generate-campaign       |
webhook-queue:   process-inbound-email   | concurrency=15, retries=3
                 process-inbound-whatsapp|
billing-queue:   record-usage            | concurrency=3,  retries=3
                 report-to-stripe        |

Cron: campaign scheduler every 5min, auto-pilot check every 15min,
      usage aggregation every hour, cleanup daily

================================================================================
7. MULTI-TENANCY & BILLING
================================================================================

Isolation: workspaceId FK on all tables, filtered in every query
Auth:       JWT (dashboard) OR X-API-Key (B2B)
Roles:      Admin | Member | Viewer (with permission matrix)
API Keys:   Format lg_live_<32hex>, SHA-256 hash, one-time display, revocable

Pricing:
  Starter $29  — 1 seat, 500 leads, 5 campaigns, no AI
  Pro $99      — 5 seats, 5000 leads, unlimited campaigns, AI manual
  Agency $299  — 20 seats, 50000 leads, unlimited campaigns, auto-pilot

Metered: AI msg $0.02, Intent analysis $0.05, Enrichment $0.10, Seat $10-15

================================================================================
8. AI (Gemini + Fallback)
================================================================================

Primary: Gemini 2.5 Flash (free tier)
Fallback: OpenAI -> Anthropic
4 ops:   Intent analysis, Draft reply, Lead enrichment, Campaign generation
Auto-pilot: Check enabled -> Analyze -> Check threshold -> Working hours ->
            Daily limit -> HIGH? handoff : auto-reply

================================================================================
9. IMPLEMENTATION ORDER (~20 hours total)
================================================================================

STEP 1 — Install deps + Prisma setup (1-2h)
STEP 2 — Express API scaffold (2-3h)
STEP 3 — Core CRUD routes (3-4h)
STEP 4 — BullMQ workers (2-3h)
STEP 5 — Frontend rebuild (4-6h)
STEP 6 — Multi-tenancy + billing (2-3h)
STEP 7 — Polish + deploy (1-2h)
