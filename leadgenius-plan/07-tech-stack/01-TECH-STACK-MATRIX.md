# TECH STACK DECISION MATRIX - LeadGenius
## FINAL STACK (2026) — Self-Hosted PostgreSQL Core

================================================================================
## FINAL DECISION SUMMARY
================================================================================

  Runtime:      Bun (replaces Node.js — built-in TS, test runner, bundler, package mgr)
  Backend:      Hono (replaces Express — 12KB, multi-runtime, TypeScript-native)
  Frontend:     React 19 + Vite (SPA, no SSR needed for dashboard)
  Styling:      Tailwind CSS 4
  ORM:          Drizzle ORM (TypeScript-first, SQL-like, zero abstraction)
  Database:     PostgreSQL (self-hosted — NO Supabase, NO managed service)
                + pg-boss (queue — replaces BullMQ/Redis)
                + pg_cron (scheduler — replaces node-cron)
                + pgvector (AI embeddings — semantic lead search)
  Auth:         Better-Auth (open source, Hono + Drizzle native)
  AI SDK:       Vercel AI SDK (all providers: Gemini/OpenAI/Anthropic/Ollama/Mistral)
  Validation:   Zod (TypeScript-first, Hono-native integration)
  Charts:       Recharts (React-native)
  Icons:        Lucide React
  Email:        Nodemailer (fully open source) + SendGrid SDK (optional)
  WhatsApp:     Twilio SDK
  Billing:      Stripe SDK
  Testing:      Bun test + Playwright
  Monorepo:     Turborepo (open source)
  CI/CD:        GitHub Actions
  Docker:       Docker Compose (PostgreSQL + Bun app + Hono API)
  Monitoring:   Grafana + Prometheus + Loki (all open source, self-hosted)

================================================================================
## THE CORE PHILOSOPHY: POSTGRESQL FOR EVERYTHING
================================================================================

  Instead of:                    We use:
  ───────────────────────────────────────────────────
  Redis + BullMQ                 PostgreSQL + pg-boss
  node-cron                      PostgreSQL + pg_cron
  Supabase Auth                  Better-Auth (DB-backed sessions)
  Supabase Realtime              PostgreSQL LISTEN/NOTIFY + SSE
  Vector DB (Pinecone)           PostgreSQL + pgvector
  External queue (RabbitMQ)      PostgreSQL + pg-boss
  Separate cache layer           PostgreSQL (or in-memory with Bun)

  One database. One stack to manage. Zero vendor lock-in.

================================================================================
## WHY THIS STACK IN 2026
================================================================================

### Bun over Node.js
  - Built-in: TypeScript transpiler, test runner (Jest-compat), package manager, bundler
  - 4x faster startup than Node.js
  - Node.js API compatible (most npm packages work)
  - Native fetch(), WebSocket, File I/O (no polyfills)
  - Hot reload built-in (--watch)
  - Single binary deployment

### Hono over Express
  - 12KB vs 200KB+ (Express is bloated)
  - 3x faster requests/sec
  - TypeScript-native (not DefinitelyTyped)
  - Built-in Zod validation (@hono/zod-validator)
  - Multi-runtime (Bun/Node/Deno/Cloudflare Workers)
  - Web Standards compliant (Request/Response)
  - Type-safe RPC (hc client) for frontend-backend type sharing

### Drizzle over Prisma
  - No code generation step (Prisma generates 200+ files)
  - SQL-like syntax (if you know SQL you know Drizzle)
  - 2x faster runtime than Prisma
  - Better PostgreSQL feature access (extensions, raw SQL when needed)
  - Smaller bundle (tree-shakeable)
  - Drizzle Kit for migrations

### PostgreSQL + pg-boss over Redis + BullMQ
  - One database to manage vs two (Postgres + Redis)
  - No extra Docker container (Redis adds memory + CPU)
  - pg-boss provides: queues, schedules, retries, delays — all in Postgres
  - Built-in monitoring: query pg-boss tables directly
  - ACID compliance (Redis is not ACID)
  - pg_cron for scheduling (replaces node-cron)

### Better-Auth over Supabase Auth
  - 100% open source, MIT license
  - Works with ANY Postgres setup (self-hosted or managed)
  - Hono-native integration
  - Supports: email/password, OAuth (Google/GitHub), magic links, passkeys
  - DB-backed sessions (no JWT overhead for most operations)
  - Role-based access control (RBAC) built-in
  - Rate limiting built-in
  - No vendor lock-in

### Vercel AI SDK over Single Provider
  - One unified API for ALL providers:
    - Gemini 2.5 Flash (primary — cheapest, fastest)
    - OpenAI GPT-4o (fallback)
    - Anthropic Claude 3.5 (premium)
    - Ollama (local models — free, private, no API calls)
    - Mistral (european alternative)
  - Swap providers at runtime (per-workspace or per-operation)
  - Built-in telemetry, token tracking, cost calculation
  - Streaming support for all providers
  - Tool/function calling for all providers

================================================================================
## 1. FRONTEND FRAMEWORK
================================================================================

Criteria         | React 19        | Solid.js         | Svelte 5
-----------------|-----------------|------------------|-----------------
Bundle Size      | ~40KB           | ~7KB             | ~2KB
Performance      | Good (vdom)     | Excellent (signals)| Excellent (compiler)
Ecosystem        | Excellent       | Growing          | Growing
Learning Curve   | Moderate        | Low+             | Low
Developer Pool   | Huge            | Small            | Medium
TypeScript       | Excellent       | Good             | Good

VERDICT: React 19 + Vite
  - Largest ecosystem (Recharts, Lucide, TanStack Query)
  - Largest developer pool
  - Best TypeScript support
  - This is an SPA dashboard — React is perfect for this

================================================================================
## 2. STYLING
================================================================================

VERDICT: Tailwind CSS 4
  - Fastest development speed
  - Design system via tailwind.config
  - Smallest production bundle (purged)
  - Best responsive design utilities

================================================================================
## 3. STATE MANAGEMENT
================================================================================

VERDICT: TanStack Query (server) + Zustand (client) + React Context (auth)
  - TanStack Query: server cache, auto-refetch, optimistic updates, pagination
  - Zustand: UI state (filters, sidebar, theme, modals)
  - React Context: auth user + workspace (minimal, rarely changes)

================================================================================
## 4. BACKEND FRAMEWORK
================================================================================

Criteria         | Hono             | Elysia           | Express         | Fastify
-----------------|------------------|------------------|-----------------|----------
Bundle Size      | ~12KB            | ~22KB            | 200KB+          | ~50KB
Multi-runtime    | Yes              | Bun-first        | Node only       | Node only
TypeScript       | Native           | Native           | DefinitelyTyped | DefinitelyTyped
Zod Validation   | Built-in         | Plugin           | Manual          | Via plugin
Type-safe RPC    | Yes (hc)         | Yes (Eden)       | No              | No
Web Standards    | Yes              | Yes              | No              | No
GitHub Stars     | ~22K             | ~12K             | ~65K            | ~33K
Req/sec (Bun)    | 22K              | 25K              | 9K              | N/A
Middleware       | Express-like     | Plugin-based     | Huge ecosystem  | Plugin system

VERDICT: Hono
  - Runs on Bun, Node, Deno, Cloudflare Workers — zero code changes
  - Express-like middleware API (familiar pattern)
  - Built-in Zod validation
  - Type-safe RPC client for frontend (end-to-end types)
  - Web Standards compliant (Bun native fetch)
  - Lightest weight, fastest cold start

================================================================================
## 5. DATABASE
================================================================================

VERDICT: Self-hosted PostgreSQL 16 + Extensions
  - No vendor lock-in (not Supabase, not Neon, not RDS)
  - Full control: connections, size, extensions, config
  - Extensions:
    - pg_boss (queue) — replaces BullMQ + Redis
    - pg_cron (scheduler) — replaces node-cron
    - pgvector (embeddings) — replaces Pinecone/Weaviate
    - pg_stat_statements (monitoring) — query performance
  - Docker Compose for deployment
  - Wal-G for backups to S3-compatible storage

================================================================================
## 6. AUTH
================================================================================

VERDICT: Better-Auth
  - 100% open source (MIT)
  - Hono integration via @better-auth/hono
  - Drizzle ORM adapter
  - Features: email/password, OAuth, magic links, passkeys, 2FA
  - Sessions stored in PostgreSQL (no Redis needed)
  - RBAC built-in (Admin, Member, Viewer roles)
  - Rate limiting built-in
  - No vendor lock-in

================================================================================
## 7. QUEUE / BACKGROUND JOBS
================================================================================

VERDICT: pg-boss (PostgreSQL-based queue)
  - No Redis dependency — saves memory, ops, cost
  - ACID-compliant (Redis is not)
  - Features: delayed jobs, retries, schedules, concurrency
  - Monitor directly via SQL queries
  - Dashboard: pg-boss provides a simple web UI
  - Scales with PostgreSQL (read replicas, connection pooling)

Job Types in pg-boss:
  - campaign:send_message     (delay: step.delay_hours)
  - ai:analyze_intent         (priority: high)
  - ai:generate_draft         (priority: normal)
  - ai:enrich_lead            (priority: low)
  - webhook:process_inbound   (priority: high)
  - billing:report_usage      (schedule: hourly)
  - system:cleanup            (schedule: daily)

================================================================================
## 8. AI PROVIDER (via Vercel AI SDK)
================================================================================

Criteria         | Gemini 2.5 Flash  | OpenAI GPT-4o-mini | Anthropic Claude 3 Haiku
-----------------|-------------------|--------------------|-------------------------
Cost input       | $0.10/1M tokens   | $0.15/1M tokens    | $0.25/1M tokens
Cost output      | $0.40/1M tokens   | $0.60/1M tokens    | $1.25/1M tokens
Speed            | Fastest           | Fast               | Fast
Context window   | 1M tokens         | 128K tokens        | 200K tokens
Local model      | No                | No                 | No

VERDICT: Vercel AI SDK wraps ALL providers
  - Primary: Gemini 2.5 Flash (cheapest, fastest, 1M context)
  - Fallback: OpenAI GPT-4o-mini
  - Premium: Anthropic Claude 3.5 Sonnet
  - Local: Ollama (Mistral/Llama running on your own server)
  - Swap per workspace or per operation with zero code changes

================================================================================
## 9. COMPLETE TURBOREPO PROJECT STRUCTURE
================================================================================

leadgenius/                          # Monorepo root
├── .github/workflows/deploy.yml
├── apps/
│   ├── api/                         # Hono backend (Bun)
│   │   ├── src/
│   │   │   ├── index.ts             # Entry: Hono app
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── leads.ts
│   │   │   │   ├── campaigns.ts
│   │   │   │   ├── messages.ts
│   │   │   │   ├── inbox.ts
│   │   │   │   ├── agent.ts
│   │   │   │   ├── billing.ts
│   │   │   │   ├── api-keys.ts
│   │   │   │   └── webhooks/
│   │   │   │       ├── twilio.ts
│   │   │   │       ├── sendgrid.ts
│   │   │   │       └── stripe.ts
│   │   │   ├── services/
│   │   │   │   ├── ai/
│   │   │   │   │   ├── index.ts     # Vercel AI SDK
│   │   │   │   │   └── prompts/
│   │   │   │   ├── email.ts
│   │   │   │   ├── whatsapp.ts
│   │   │   │   └── billing.ts
│   │   │   ├── db/
│   │   │   │   ├── schema/          # Drizzle schema files
│   │   │   │   ├── migrations/
│   │   │   │   └── index.ts
│   │   │   ├── queue/
│   │   │   │   └── jobs.ts          # pg-boss job definitions
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts          # Better-Auth middleware
│   │   │   │   └── rate-limit.ts
│   │   │   └── lib/                 # Shared utilities
│   │   ├── drizzle.config.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── web/                         # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts    # Hono RPC client (type-safe)
│   │   │   │   └── auth-client.ts   # Better-Auth client
│   │   │   └── styles/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── workers/                     # Background workers (Bun)
│       ├── src/
│       │   ├── index.ts             # pg-boss worker loop
│       │   ├── campaign-worker.ts
│       │   ├── ai-worker.ts
│       │   ├── webhook-worker.ts
│       │   └── billing-worker.ts
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── shared/                      # Shared types & schemas
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── lead.ts
│   │   │   │   ├── campaign.ts
│   │   │   │   └── message.ts
│   │   │   └── schemas/
│   │   │       ├── lead.ts          # Zod schemas
│   │   │       ├── campaign.ts
│   │   │       └── message.ts
│   │   └── package.json
│   │
│   └── db/                          # Database package
│       ├── src/
│       │   ├── schema/
│       │   │   ├── leads.ts
│       │   │   ├── campaigns.ts
│       │   │   └── ...
│       │   ├── migrations/
│       │   └── seed.ts
│       ├── drizzle.config.ts
│       └── package.json
│
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
├── Dockerfile.worker
├── turbo.json
├── package.json                     # Root workspace
├── pnpm-workspace.yaml
├── tsconfig.json
└── .env.example

================================================================================
## 10. POSTGRESQL EXTENSIONS SETUP
================================================================================

-- docker-compose.yml (PostgreSQL service)
db:
  image: postgres:16-alpine
  command: |
    postgres 
    -c shared_preload_libraries='pg_boss,pg_cron,pgvector'
    -c cron.database_name='leadgenius'
  environment:
    POSTGRES_DB: leadgenius
    POSTGRES_PASSWORD: ${DB_PASSWORD}
  volumes:
    - pgdata:/var/lib/postgresql/data
    - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
  ports:
    - "5432:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
    timeout: 5s
    retries: 10

-- init.sql
CREATE EXTENSION IF NOT EXISTS pg_boss;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

================================================================================
## 11. COST COMPARISON (Monthly)
================================================================================

Service            | Supabase (managed) | Self-hosted (this stack)
-------------------|--------------------|--------------------------------
Database           | $25 (Pro, 8GB)    | $10 (VPS with 25GB SSD)
Auth               | Included           | Free (Better-Auth, MIT)
Redis              | $15 (Upstash)      | $0 (Using pg-boss instead)
Queue              | $0 (BullMQ+Redis)  | $0 (pg-boss, included in PG)
Realtime           | Included           | $0 (LISTEN/NOTIFY + SSE)
Vector DB          | $0 (pgvector)      | $0 (pgvector, included in PG)
Edge Functions     | Included           | $0 (Bun workers)
AI Gateway         | $0 (manual code)   | $0 (Vercel AI SDK)
Total              | $40/mo             | $10/mo

Saving: 75% on infrastructure costs
Control: 100% of your data and infrastructure
