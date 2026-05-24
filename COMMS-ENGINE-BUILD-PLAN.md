# LEADGENIUS — CORE COMMUNICATION ENGINE BUILD PLAN
## No Auth · No Multi-Tenancy · Industrial Grade · AI-Ready

==============================================================================
1. SYSTEM OVERVIEW
==============================================================================

A 24/7 communication engine that sends templated email/WhatsApp messages
to leads based on scheduled campaigns, festivals, offers, and segment rules.
AI layer drops in later to understand responses and auto-communicate.

LEADS → SEGMENTS/GROUPS → CAMPAIGNS (with templates) → SCHEDULER → SENDERS
                                                                       ↓
                                                              RESPONSE TRACKER
                                                                       ↓
                                                              [AI LAYER LATER]

==============================================================================
2. DIRECTORY STRUCTURE
==============================================================================

comms-engine/
├── apps/
│   ├── api/                         # Express backend
│   │   ├── src/
│   │   │   ├── index.ts             # Entry point
│   │   │   ├── config.ts            # Env, DB, Redis config
│   │   │   ├── db.ts                # Prisma client singleton
│   │   │   ├── routes/
│   │   │   │   ├── leads.ts         # CRUD + import/export
│   │   │   │   ├── groups.ts        # Lead groups/segments
│   │   │   │   ├── templates.ts     # Email & WhatsApp templates
│   │   │   │   ├── campaigns.ts     # CRUD + schedule + activate
│   │   │   │   ├── messages.ts      # Message history + status
│   │   │   │   ├── analytics.ts     # Stats, charts, reports
│   │   │   │   └── settings.ts      # SMTP/Twilio config, global prefs
│   │   │   ├── services/
│   │   │   │   ├── email.ts         # Nodemailer + SendGrid
│   │   │   │   ├── whatsapp.ts      # Twilio
│   │   │   │   └── template.ts      # Template renderer (Handlebars)
│   │   │   ├── queue/
│   │   │   │   └── index.ts         # BullMQ queue definitions
│   │   │   └── lib/
│   │   │       ├── errors.ts
│   │   │       └── validation.ts    # Zod schemas
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── web/                         # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Leads.tsx
│   │   │   │   ├── Groups.tsx
│   │   │   │   ├── Templates.tsx
│   │   │   │   ├── Campaigns.tsx
│   │   │   │   ├── Messages.tsx
│   │   │   │   ├── Analytics.tsx
│   │   │   │   └── Settings.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/              # Button, Card, Modal, Table, etc.
│   │   │   │   ├── layout/          # Sidebar, TopBar
│   │   │   │   └── forms/           # Reusable form components
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   │   ├── api.ts           # Axios client
│   │   │   │   └── utils.ts
│   │   │   └── styles/
│   │   │       └── app.css
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── workers/                     # BullMQ workers
│       ├── src/
│       │   ├── index.ts
│       │   ├── campaign-worker.ts   # Sends campaign messages
│       │   └── response-worker.ts   # Tracks replies (AI-ready)
│       ├── tsconfig.json
│       └── package.json
│
├── docker-compose.yml
├── .env.example
├── package.json (turbo root)
└── README.md

==============================================================================
3. TECH STACK
==============================================================================

Backend:     Node.js 22 + Express + TypeScript
Database:    PostgreSQL 16 + Prisma ORM
Queue:       BullMQ + Redis 7
Email:       Nodemailer (SMTP) + optional SendGrid SDK
WhatsApp:    Twilio SDK
Templates:   Handlebars (server-side rendering with variables)
Frontend:    React 19 + Vite + TanStack Query + Zustand + Recharts
Styling:     Tailwind CSS 4 + Lucide Icons + Framer Motion
Validation:  Zod
Testing:     Vitest + Supertest + Playwright
Deployment:  Docker Compose

==============================================================================
4. DATABASE SCHEMA (Prisma — 7 Models)
==============================================================================

leads:
  id            String @id @default(cuid())
  email         String?
  phone         String?
  name          String?
  company       String?
  title         String?
  source        String?              // manual, import, webhook
  status        LeadStatus           // active, unsubscribed, bounced, invalid
  tags          String[]             // for grouping/filtering
  customFields  Json?                // user-defined key-value pairs
  lastContactedAt DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

leadGroups:
  id            String @id @default(cuid())
  name          String
  description   String?
  filterRules   Json?                // saved filter criteria (dynamic segment)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

groupMembers:
  leadId        String
  groupId       String
  assignedAt    DateTime @default(now())
  @@id([leadId, groupId])

templates:
  id            String @id @default(cuid())
  name          String
  channel       Channel              // email, whatsapp
  subject       String?              // email subject line
  body          String               // Handlebars template
  variables     String[]             // list of expected variables
  category      String?              // festival, offer, followup, etc.
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

campaigns:
  id            String @id @default(cuid())
  name          String
  description   String?
  status        CampaignStatus       // draft, scheduled, running, paused, completed
  channel       Channel              // email, whatsapp, both
  templateId    String
  leadGroupIds  String[]             // target groups
  productFilter String?              // filter leads by product/offer
  scheduleType  ScheduleType         // immediate, scheduled, recurring
  scheduledAt   DateTime?
  recurringRule String?              // cron expression
  sendStrategy  SendStrategy         // sequential, batch, burst
  dailyLimit    Int?                 // max per day
  minDelayMs    Int?                 // min gap between sends
  sentCount     Int @default(0)
  failedCount   Int @default(0)
  replyCount    Int @default(0)
  openedCount   Int @default(0)
  clickedCount  Int @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

messages:
  id            String @id @default(cuid())
  campaignId    String?
  leadId        String
  channel       Channel
  direction     Direction            // outbound, inbound  
  subject       String?
  body          Text
  status        MessageStatus        // queued, sent, delivered, failed, bounced, replied
  providerId    String?              // SendGrid/Twilio message ID
  errorMessage  String?
  deliveredAt   DateTime?
  readAt        DateTime?
  createdAt     DateTime @default(now())

settings:                             // singleton table for global config
  id            String @id @default("global")
  smtpHost      String?
  smtpPort      Int?
  smtpUser      String?
  smtpPass      String?
  sendgridApiKey String?
  twilioAccountSid String?
  twilioAuthToken String?
  twilioFromNumber String?
  fromEmail     String?
  fromName      String?
  dailyGlobalLimit Int?              // global daily cap
  defaultMinDelayMs Int?             // default 30000 (30s)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

Enums:
  LeadStatus:   active, unsubscribed, bounced, invalid
  Channel:      email, whatsapp
  Direction:    outbound, inbound
  MessageStatus: queued, sent, delivered, failed, bounced, replied
  CampaignStatus: draft, scheduled, running, paused, completed
  ScheduleType: immediate, scheduled, recurring
  SendStrategy: sequential, batch, burst

==============================================================================
5. API ROUTES (Express)
==============================================================================

LEADS:
  GET    /api/leads          — list with filter/search/sort/paginate
  GET    /api/leads/:id      — single lead detail + message history
  POST   /api/leads          — create single lead
  PUT    /api/leads/:id      — update lead
  DELETE /api/leads/:id      — delete lead
  POST   /api/leads/import   — CSV/JSON import
  POST   /api/leads/export   — CSV/JSON export
  POST   /api/leads/bulk-tag — bulk assign tags
  POST   /api/leads/bulk-status — bulk status change

GROUPS:
  GET    /api/groups         — list groups (with lead count)
  POST   /api/groups         — create group
  PUT    /api/groups/:id     — update group
  DELETE /api/groups/:id     — delete group (not leads)
  POST   /api/groups/:id/leads — assign leads to group
  DELETE /api/groups/:id/leads/:leadId — remove lead from group

TEMPLATES:
  GET    /api/templates      — list (filter by channel/category)
  POST   /api/templates      — create template
  PUT    /api/templates/:id  — update template
  DELETE /api/templates/:id  — delete template
  POST   /api/templates/:id/preview — render with test variables

CAMPAIGNS:
  GET    /api/campaigns      — list with status filter
  GET    /api/campaigns/:id  — detail + stats
  POST   /api/campaigns      — create campaign
  PUT    /api/campaigns/:id  — update campaign
  DELETE /api/campaigns/:id  — delete campaign
  POST   /api/campaigns/:id/activate  — start campaign
  POST   /api/campaigns/:id/pause     — pause campaign
  POST   /api/campaigns/:id/resume    — resume campaign
  POST   /api/campaigns/:id/stop      — stop campaign
  POST   /api/campaigns/:id/test      — send test to specific email

MESSAGES:
  GET    /api/messages       — list with filter (lead, campaign, status)
  GET    /api/messages/:id   — single message detail

ANALYTICS:
  GET    /api/analytics/overview       — total sent, delivered, opened, etc.
  GET    /api/analytics/by-campaign    — per-campaign stats
  GET    /api/analytics/timeline       — sends over time (day/week/month)
  GET    /api/analytics/channel-breakdown — email vs whatsapp

SETTINGS:
  GET    /api/settings       — get global settings
  PUT    /api/settings       — update global settings
  POST   /api/settings/test-email   — send test email with current SMTP config
  POST   /api/settings/test-whatsapp — send test WhatsApp

==============================================================================
6. CAMPAIGN SCHEDULING & SEND ENGINE (Core)
==============================================================================

The send engine is what runs 24/7. Here's how it works:

────────────────────────────────────────
CAMPAIGN SCHEDULER (cron every 1 min)
────────────────────────────────────────
1. BullMQ queue checks: campaign:scheduler
2. Picks campaigns where:
   - status == 'scheduled' AND scheduledAt <= now
   - status == 'running' AND (recurringRule matches current time)
3. Enqueues a campaign-run job per eligible campaign

────────────────────────────────────────
CAMPAIGN RUNNER (campaign-worker.ts)
────────────────────────────────────────
1. Receives campaign-run job
2. Fetches campaign + template + settings
3. Fetches leads from all assigned lead groups
4. Applies product/segment filter if set
5. Excludes leads already sent to in this campaign
6. Respects dailyLimit (global + campaign)
7. Respects minDelayMs between sends
8. For each eligible lead:
   a. Renders template with lead variables using Handlebars
   b. Determines channel(s)
   c. Creates Message record (status: queued)
   d. Enqueues send-message job to send-queue
9. Updates campaign sentCount

────────────────────────────────────────
SEND WORKER (handles send-queue)
────────────────────────────────────────
1. Receives send-message job
2. Fetches message record + settings
3. Routes by channel:
   email    → Nodemailer/SendGrid
   whatsapp → Twilio
4. On success:
   - Updates message: status=delivered, providerId, deliveredAt
   - Increments campaign sentCount
5. On failure:
   - Updates message: status=failed, errorMessage
   - Increments campaign failedCount
   - Retry logic: 3 attempts with exponential backoff

────────────────────────────────────────
INBOUND WEBHOOK RECEIVER (response-worker)
────────────────────────────────────────
1. POST /webhook/email — receives email bounces, replies
2. POST /webhook/whatsapp — receives WhatsApp replies
3. Matches inbound message to a lead (via from address/number)
4. Creates Message record (direction: inbound)
5. Updates lead lastContactedAt
6. [AI READY] Enqueues intent-analysis job for AI processing
7. Sends notification (SSE to frontend or webhook)

==============================================================================
7. FRONTEND SCREENS (React)
==============================================================================

01 DASHBOARD
  - KPI cards: Total Leads, Active Campaigns, Sent Today, Delivery Rate
  - Line chart: Sends over last 7/30 days (Recharts)
  - Pie chart: Channel breakdown (email vs whatsapp)
  - Recent activity feed (last 20 messages)

02 LEADS
  - Data table with columns: Name, Email, Phone, Company, Status, Tags
  - Search bar + multi-field filter (status, tags, source, date range)
  - Sort by any column
  - Pagination (50/page)
  - Row actions: View, Edit, Delete
  - Bulk actions: Tag, Change Status, Delete, Assign to Group
  - Import button → modal with drag-drop CSV + column mapping
  - Export button
  - Add Lead button → modal form

03 GROUPS
  - Card list of groups with lead count
  - Create/Edit group modal
  - Click group → view members list
  - Add/Remove leads from group

04 TEMPLATES
  - Tab view: Email / WhatsApp
  - Card grid with preview
  - Create/Edit screen:
    - Name, Channel, Category fields
    - Subject (email only)
    - Body editor (textarea with Handlebars variable insertion)
    - Variable picker sidebar (click to insert {{name}}, {{company}}, etc.)
    - Preview pane (rendered with sample data)
  - Duplicate template
  - Delete with confirmation

05 CAMPAIGNS
  - Card grid with status badges
  - Filter: All / Draft / Scheduled / Running / Paused / Completed
  - Create Campaign → multi-step wizard:
    STEP 1: Name, Description, Channel (email/whatsapp/both)
    STEP 2: Select Template
    STEP 3: Select Lead Groups + product/segment filter
    STEP 4: Schedule (immediate / scheduled date / recurring cron)
    STEP 5: Strategy (sequential/batch/burst) + daily limit + delay
    STEP 6: Review & Activate (or Save as Draft)
  - Campaign detail page:
    - Stats bar: Sent, Delivered, Failed, Opened, Replied
    - Progress bar
    - Timeline of sends
    - Lead table with per-lead status
    - Action buttons: Activate / Pause / Resume / Stop

06 MESSAGES
  - Data table with all messages
  - Filters: Channel, Status, Campaign, Date Range
  - Click → message detail modal (full body, headers, delivery info)

07 ANALYTICS
  - Date range selector
  - Overview cards
  - Campaign-by-campaign comparison
  - Delivery rate gauge
  - Channel breakdown charts

08 SETTINGS
  - SMTP Configuration (host, port, user, pass, from email/name)
  - SendGrid API key (optional override)
  - Twilio Configuration (Account SID, Auth Token, From Number)
  - Global limits (daily cap, default delay)
  - Test buttons (send test email / test WhatsApp)

==============================================================================
8. QUEUE DESIGN (BullMQ)
==============================================================================

QUEUE NAME          JOBS                    CONCURRENCY  RETRIES
────────────────────────────────────────────────────────────────
campaign-scheduler  run-scheduled-campaigns  1            -
campaign-runner     execute-campaign         5            -
send-queue          send-message             20           3
response-queue      process-inbound          10           3
[future] ai-queue   analyze-intent           5            -
                     generate-draft          5            -

Cron jobs:
  campaign-schedule-check:  every 1 minute  — picks ready campaigns
  campaign-cleanup:         daily at 3am    — archival/cleanup

==============================================================================
9. IMPLEMENTATION ORDER (Estimated: ~40 hours)
==============================================================================

PHASE 1 — FOUNDATION (8h)
  Day 1:
    [ ] Project scaffold (turbo repo, tsconfig, eslint, prettier)
    [ ] Docker Compose (PostgreSQL + Redis)
    [ ] Prisma schema + migrations + seed
    [ ] Express app scaffold with error handling middleware
    [ ] Settings API + global config management
    [ ] React project scaffold (Vite + Tailwind + Router + layout)

PHASE 2 — LEADS + GROUPS (6h)
  Day 2:
    [ ] Leads API (CRUD + filter/search/paginate)
    [ ] Groups API (CRUD + assign/remove leads)
    [ ] CSV import/export (leads)
    [ ] Frontend: Leads page (table, filters, modals)
    [ ] Frontend: Groups page (list, members)

PHASE 3 — TEMPLATES + PREVIEW (6h)
  Day 3:
    [ ] Templates API (CRUD + channel/category filter)
    [ ] Handlebars render service + preview
    [ ] Frontend: Templates page (editor, preview, variable picker)

PHASE 4 — CAMPAIGN ENGINE (12h)
  Day 4-5:
    [ ] Campaigns API (CRUD + status transitions)
    [ ] BullMQ queue setup (campaign-scheduler, campaign-runner, send-queue)
    [ ] Campaign scheduler worker (cron check every 1min)
    [ ] Campaign runner worker (fetch leads, render, enqueue sends)
    [ ] Send worker (email via Nodemailer, WhatsApp via Twilio)
    [ ] Rate limiting per campaign + globally
    [ ] Frontend: Campaigns page (list, wizard, detail)
    [ ] Frontend: Campaign detail with live stats

PHASE 5 — MESSAGES + WEBHOOKS (4h)
  Day 6:
    [ ] Messages API (list/filter)
    [ ] Inbound webhooks (email + WhatsApp)
    [ ] Response worker + bounce handling
    [ ] Frontend: Messages page (table, detail modal)

PHASE 6 — ANALYTICS + POLISH (4h)
  Day 6-7:
    [ ] Analytics API (overview, per-campaign, timeline, breakdown)
    [ ] Frontend: Dashboard with charts
    [ ] Frontend: Analytics page
    [ ] Error handling polish
    [ ] Loading states, empty states, edge cases

==============================================================================
10. NPM PACKAGES TO INSTALL
==============================================================================

Backend (api):
  express @types/express
  cors @types/cors
  helmet
  @prisma/client prisma
  bullmq ioredis
  nodemailer @types/nodemailer
  @sendgrid/mail
  twilio
  handlebars
  zod
  dotenv
  uuid
  winston
  date-fns
  tsx (dev) typescript @types/node (dev)

Frontend (web):
  react react-dom react-router-dom
  @tanstack/react-query
  zustand
  recharts
  tailwindcss @tailwindcss/vite
  lucide-react
  framer-motion
  axios
  react-hot-toast
  @hookform/resolvers react-hook-form
  zod

Workers:
  bullmq ioredis
  @prisma/client
  nodemailer
  @sendgrid/mail
  twilio
  handlebars
  winston
  dotenv
  tsx (dev) typescript @types/node (dev)

==============================================================================
11. .env.example
==============================================================================

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/comms_engine

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# SMTP (default)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
FROM_EMAIL=noreply@example.com
FROM_NAME=LeadGenius

# SendGrid (optional override)
SENDGRID_API_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Server
PORT=3001
NODE_ENV=development

==============================================================================
12. docker-compose.yml
==============================================================================

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: comms_engine
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:

==============================================================================
13. AI READINESS — Future Drop-In (Not Building Now)
==============================================================================

The architecture is designed so AI plugs in without rewrites:

  RESPONSE WORKER now          → Creates inbound Message record
  RESPONSE WORKER + AI later   → Also calls analyze-intent on inbound message

  SEND WORKER now              → Sends template exactly as written
  SEND WORKER + AI later       → Can inject AI-generated personalization

  FRONTEND now                 → Manual reply box
  FRONTEND + AI later          → Shows AI-suggested reply (Edit/Send/Regenerate)

No changes needed to schema, queues, or core flow. AI is a new worker + new
service function that hooks into existing pipeline points.

==============================================================================
14. WHAT WE ARE NOT BUILDING (Clear Scope)
==============================================================================

  ✗ Authentication / Login / Signup
  ✗ Multi-tenancy / Workspaces / Team roles
  ✗ API keys
  ✗ Billing / Stripe / Metering
  ✗ User management
  ✗ MCP server
  ✗ AI intent analysis / auto-reply (coming in phase 2)
  ✗ Real-time collaboration
