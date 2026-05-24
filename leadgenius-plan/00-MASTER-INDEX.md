# LEADGENIUS - MASTER BUILD PLAN
## AI-Powered SDR (Sales Development Representative) SaaS Platform

================================================================================
                          COMPLETE SYSTEM ARCHITECTURE
================================================================================

## TABLE OF CONTENTS

### 01 - UI/UX DESIGN & COMPONENT TREE
  - Design System (colors, typography, spacing, shadows)
  - Every screen with pixel-perfect layout
  - Component tree hierarchy (atomic design)
  - State management (React Context + Zustand)
  - Animations & transitions (Framer Motion)
  - Responsive breakpoints
  - Accessibility (a11y) standards
  - Error states, loading states, empty states, edge cases

### 02 - DATABASE SCHEMA & DATA FLOW
  - Full PostgreSQL schema (all tables, columns, types, defaults)
  - Indexes, constraints, foreign keys
  - Row Level Security (RLS) policies
  - Migration strategy (Supabase/local)
  - Data flow diagrams
  - Cache invalidation strategy
  - Real-time subscriptions (Supabase Realtime)

### 03 - BACKEND WORKERS & QUEUES
  - Express server architecture
  - BullMQ queue definitions (campaigns, messages, AI, webhooks)
  - Cron job schedules
  - Worker implementations
  - Error handling & retry logic
  - Rate limiting & throttling
  - Logging & monitoring (Winston + Grafana)

### 04 - AI AGENT ARCHITECTURE
  - Gemini 2.5 Flash integration
  - Prompt engineering (all system prompts)
  - Intent analysis pipeline
  - Auto-Pilot mode logic
  - Human handoff protocol
  - Context window management
  - Token usage tracking & billing
  - Fallback providers (OpenAI, Anthropic)

### 05 - MULTI-TENANCY & BILLING
  - Workspace model
  - Team roles (Admin, Member, Viewer)
  - API key generation & management
  - Dual auth system (JWT + API Key)
  - Stripe metered billing
  - Rate limiting per workspace
  - Audit logging

### 06 - DEPLOYMENT & DEVOPS
  - Docker Compose setup
  - CI/CD pipeline (GitHub Actions)
  - Environment configuration
  - Secrets management
  - Scaling strategy
  - Monitoring & alerting
  - Backup & recovery

### 07 - TECH STACK DECISION MATRIX
  - Frontend: React vs Next.js vs Solid
  - Styling: Tailwind vs CSS Modules vs Styled Components
  - Database: Supabase vs Neon vs RDS
  - Queue: BullMQ vs RabbitMQ vs SQS
  - AI: Gemini vs OpenAI vs Claude
  - Deployment: Docker vs Serverless vs VPS

### 08 - SCREENS & COMPONENT TREE
  - Every screen: components, props, state, actions
  - Every button: click handler, API call, state transition
  - Every form: validation rules, error messages, submission
  - Every modal: trigger, content, actions, close behavior
  - Every dropdown: options, filtering, selection behavior

### 09 - API ENDPOINTS
  - RESTful API design
  - Request/response schemas (Zod)
  - Authentication middleware
  - Rate limiting middleware
  - Error response format
  - Webhook handlers
  - MCP tool definitions

### 10 - MCP SERVER ARCHITECTURE
  - Model Context Protocol design
  - Tool definitions (JSON schema)
  - Resource definitions
  - Prompt templates
  - Transport layer (stdio/SSE)
  - Integration with the app

================================================================================
                          PROJECT ROADMAP (PHASES)
================================================================================

PHASE 1: PLANNING & DESIGN (Weeks 1-2)
  - [ ] Complete architecture planning
  - [ ] Design system definition
  - [ ] Database schema finalization
  - [ ] API contract definition
  - [ ] MCP server design
  - [ ] UI mockups & wireframes

PHASE 2: CORE INFRASTRUCTURE (Weeks 3-4)
  - [ ] Supabase project setup
  - [ ] Database migrations
  - [ ] Express server scaffold
  - [ ] Authentication system
  - [ ] Multi-tenancy setup
  - [ ] Docker Compose configuration

PHASE 3: FRONTEND FOUNDATION (Weeks 5-7)
  - [ ] React project scaffold (Vite)
  - [ ] Design system implementation
  - [ ] Component library
  - [ ] State management setup
  - [ ] Routing & navigation
  - [ ] Auth integration (Supabase)

PHASE 4: BACKEND SERVICES (Weeks 6-8)
  - [ ] REST API endpoints
  - [ ] BullMQ queue setup
  - [ ] Worker implementations
  - [ ] Cron job scheduling
  - [ ] Webhook handlers
  - [ ] Rate limiting

PHASE 5: AI INTEGRATION (Weeks 7-9)
  - [ ] Gemini API integration
  - [ ] Prompt engineering
  - [ ] Intent analysis
  - [ ] Reply drafting
  - [ ] Lead enrichment
  - [ ] Campaign generation
  - [ ] Auto-Pilot mode

PHASE 6: COMMUNICATIONS (Weeks 8-10)
  - [ ] Twilio WhatsApp integration
  - [ ] SendGrid email integration
  - [ ] Webhook receiver setup
  - [ ] Message template system
  - [ ] Delivery tracking

PHASE 7: MCP SERVER (Weeks 9-11)
  - [ ] MCP server setup
  - [ ] Tool definitions
  - [ ] Resource implementations
  - [ ] Prompt templates
  - [ ] Client integration
  - [ ] Testing & documentation

PHASE 8: BILLING & PAYMENTS (Weeks 10-12)
  - [ ] Stripe integration
  - [ ] Metered billing
  - [ ] Usage tracking
  - [ ] Invoice generation
  - [ ] Payment portal

PHASE 9: TESTING & QA (Weeks 11-13)
  - [ ] Unit tests (Vitest)
  - [ ] Integration tests
  - [ ] E2E tests (Playwright)
  - [ ] Load testing (k6)
  - [ ] Security audit
  - [ ] Accessibility audit

PHASE 10: DEPLOYMENT & LAUNCH (Weeks 13-14)
  - [ ] Production deployment
  - [ ] Domain & SSL setup
  - [ ] Monitoring setup
  - [ ] Documentation
  - [ ] Product Hunt launch prep
  - [ ] Marketing site

================================================================================
                          CORE METRICS & KPIs
================================================================================

Technical:
  - API response time: <100ms p95
  - Page load time: <1.5s (LCP)
  - AI response time: <3s per generation
  - Uptime: 99.9%
  - Concurrent users: 1000 per workspace

Business:
  - MRR target: $10K within 6 months
  - Customer acquisition cost: <$50
  - Conversion rate: 5% free -> paid
  - Churn rate: <5% monthly
