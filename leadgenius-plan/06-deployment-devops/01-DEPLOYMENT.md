# DEPLOYMENT & DEVOPS - LeadGenius
## Docker, CI/CD, Monitoring, Scaling

================================================================================
## 1. DOCKER COMPOSE
================================================================================

// docker-compose.yml

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/leadgenius
      - REDIS_URL=redis://redis:6379
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - TWILIO_WHATSAPP_NUMBER=${TWILIO_WHATSAPP_NUMBER}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
      - SENDGRID_FROM_EMAIL=${SENDGRID_FROM_EMAIL}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - db
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    build: .
    command: node src/workers/index.js
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/leadgenius
      - REDIS_URL=redis://redis:6379
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    depends_on:
      - db
      - redis
    restart: unless-stopped
    scale: 2

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: leadgenius
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  bullboard:
    image: deadlydog/bull-board
    ports:
      - "3002:3002"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

volumes:
  pgdata:

================================================================================
## 2. ENVIRONMENT CONFIGURATION
================================================================================

// .env.example

# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database (Supabase or local)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:password@localhost:5432/leadgenius

# Redis
REDIS_URL=redis://localhost:6379

# AI Provider
GEMINI_API_KEY=AIzaSy...
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886

# SendGrid
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=sales@leadgenius.com
SENDGRID_INBOUND_PARSE_DOMAIN=inbound.leadgenius.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_AGENCY_PRICE_ID=price_...

# Session
SESSION_SECRET=your-secret-key-min-32-chars-long
JWT_SECRET=jwt-secret-min-32-chars

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Encryption
ENCRYPTION_KEY=32-byte-hex-string (for encrypting BYOK API keys)

================================================================================
## 3. CI/CD PIPELINE (GitHub Actions)
================================================================================

// .github/workflows/deploy.yml

name: Deploy LeadGenius

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: leadgenius_test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/leadgenius_test
          REDIS_URL: redis://localhost:6379
      - run: npm run test:e2e
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t leadgenius:${{ github.sha }} .
      - run: docker tag leadgenius:${{ github.sha }} ghcr.io/leadgenius/app:latest
      - run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
      - run: docker push ghcr.io/leadgenius/app:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: |
          ssh ${{ secrets.DEPLOY_HOST }} "
            cd /opt/leadgenius &&
            docker compose pull &&
            docker compose up -d --force-recreate &&
            docker system prune -f
          "

================================================================================
## 4. MONITORING & ALERTING
================================================================================

### Logging Stack
  - Application Logs: Winston -> Log files + Loki
  - Dashboard: Grafana (logs, metrics, traces)
  - Metrics: Prometheus (Node.js metrics, custom business metrics)
  - Traces: OpenTelemetry (request tracing)

### Key Metrics to Monitor
  Business:
    - Leads created/min
    - Messages sent/min
    - AI operations/min
    - Conversion rate
    - Active workspaces
  
  Technical:
    - API response time (p50, p95, p99)
    - Error rate by endpoint
    - BullMQ queue depth
    - Redis memory usage
    - Postgres connection count
    - CPU/Memory per container

### Alert Rules (PagerDuty)
  Critical:
    - Error rate > 5% for 5 minutes
    - API p95 latency > 1000ms for 5 minutes
    - BullMQ queue depth > 10k
    - Worker stalled for > 5 minutes
    - Payment failure rate > 10%
  
  Warning:
    - Error rate > 2% for 5 minutes
    - API p95 latency > 500ms
    - Redis memory > 80%
    - Disk usage > 80%
    - SSL cert expires in < 7 days

================================================================================
## 5. SCALING STRATEGY
================================================================================

### Phase 1: Single Server (up to 100 workspaces)
  - One instance with app + worker
  - Supabase managed Postgres
  - Upstash managed Redis
  - Cost: ~$100/month

### Phase 2: Multi-Server (100-1000 workspaces)
  - App server (auto-scaled, 2-4 instances)
  - Worker server (auto-scaled, 2-4 instances)
  - Supabase Pro (dedicated Postgres)
  - Redis Cluster
  - CDN for static assets
  - Cost: ~$500/month

### Phase 3: Enterprise (1000+ workspaces)
  - Kubernetes cluster
  - Read replicas for Postgres
  - Redis Cluster with sharding
  - Microservices split
  - Multi-region deployment
  - Cost: ~$2000+/month

================================================================================
## 6. BACKUP & DISASTER RECOVERY
================================================================================

### Backup Schedule
  - Postgres: Daily full backup (pg_dump), WAL streaming (continuous)
  - Redis: Daily RDB snapshot
  - Files: Hourly to S3-compatible storage

### Retention
  - Daily backups: 30 days
  - Weekly backups: 6 months
  - Monthly backups: 1 year

### Disaster Recovery
  - RTO (Recovery Time Objective): 1 hour
  - RPO (Recovery Point Objective): 5 minutes
  - Procedure:
    1. Provision new server from latest Docker image
    2. Restore latest Postgres backup
    3. Restore Redis from RDB
    4. Verify health endpoint
    5. Switch DNS to new server

### Playbook: Common Incidents
  - "Server not responding": Check health endpoint, check logs, restart container
  - "Messages not sending": Check BullMQ dashboard, check Twilio/SendGrid status
  - "AI responses slow": Check Gemini status, switch fallback provider
  - "Database slow": Check slow query log, add index, increase connection pool
  - "Redis out of memory": Flush stale cache, increase maxmemory
