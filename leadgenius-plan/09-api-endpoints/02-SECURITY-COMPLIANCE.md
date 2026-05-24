# SECURITY & COMPLIANCE - LeadGenius

================================================================================
## 1. AUTHENTICATION SECURITY
================================================================================

Password Requirements:
  - Minimum 8 characters
  - At least 1 uppercase, 1 lowercase, 1 number
  - Hashed with bcrypt (12 rounds)
  - Rate-limited: 5 attempts per minute per IP
  - Account lockout after 10 failed attempts (15 min)

Session Management:
  - JWT tokens with 24h expiry
  - Refresh tokens with 7d expiry (stored in DB)
  - Tokens invalidated on password change
  - All sessions visible in security settings
  - Force logout all sessions feature

API Key Security:
  - Generate with crypto.randomBytes(32) (256-bit)
  - Store only SHA-256 hash
  - Prefix for identification (lg_live_xxx)
  - One-time display on creation
  - Revocable at any time
  - Auto-expire after 365 days
  - Optional IP whitelist

================================================================================
## 2. DATA ENCRYPTION
================================================================================

In Transit:
  - TLS 1.3 for all HTTP traffic
  - WSS for WebSocket connections
  - HSTS header (max-age=31536000, includeSubDomains)
  - Certificate from Let's Encrypt (auto-renewal)

At Rest:
  - Database: Transparent Data Encryption (Supabase provides)
  - BYOK API keys: AES-256-GCM encrypted before storage
  - Encryption key stored in environment variable (not DB)
  - Backups: encrypted with GPG before upload

Field-level Encryption:
  - lead.phone: AES-256 encrypted if not needed for search
  - lead.email: AES-256 encrypted if not needed for search
  - agent_settings.api_key_encrypted: AES-256-GCM

================================================================================
## 3. RATE LIMITING
================================================================================

Global limits:
  - 1000 requests/min per IP
  - 100 requests/min per API key
  - 10 auth attempts/min per IP
  - 5 file uploads/min per user

AI-specific limits:
  - 30 AI operations/min per workspace (Pro)
  - 100 AI operations/min per workspace (Agency)
  - Max 5000 tokens/response

Implement: express-rate-limit + rate-limit-redis

Response headers:
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 999
  X-RateLimit-Reset: 1620000000
  Retry-After: 45

================================================================================
## 4. INPUT VALIDATION & SANITIZATION
================================================================================

All inputs:
  - Zod schema validation on every endpoint
  - HTML entity encoding on all user-generated content
  - SQL injection prevention via parameterized queries
  - No eval() or dynamic require()
  - File upload type + size validation (10MB max, CSV only)
  - Stripe webhook signature verification

XSS Prevention:
  - Content-Security-Policy header
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - DOMPurify for rich text
  - React's built-in XSS protection

================================================================================
## 5. COMPLIANCE
================================================================================

GDPR:
  - Data export endpoint (user requests all their data)
  - Account deletion (cascade delete all data)
  - Cookie consent banner
  - Privacy policy
  - Data processing agreement (for B2B)
  - Data retention: 90 days active, 1 year archived, then deleted

CCPA:
  - Opt-out of data selling (we don't sell data, but provide mechanism)
  - Right to know what data is collected
  - Right to delete

SOC 2 (Future):
  - Audit logging (already implemented)
  - Access controls (already implemented)
  - Change management
  - Incident response plan
  - Vendor management

CAN-SPAM:
  - Unsubscribe link in all emails
  - Physical mailing address in footer
  - Honoring opt-out requests within 10 business days
  - Clear identification as advertisement

WhatsApp Policy:
  - Opt-in required before messaging
  - Template messages for first contact
  - Rate limits: 250 messages/phone/day
  - Business verification required
  - Message template approval process

================================================================================
## 6. INFRASTRUCTURE SECURITY
================================================================================

Server Hardening:
  - Docker containers run as non-root user
  - Read-only root filesystem
  - No privileged containers
  - Seccomp profiles
  - AppArmor for additional isolation
  - Regular security updates (automated)

Network Security:
  - Internal services on Docker network only
  - No public DB or Redis ports
  - WAF (Cloudflare or similar)
  - DDoS protection
  - IP allowlisting for admin panel

Secret Management:
  - Docker secrets for production
  - Environment variables for development
  - No secrets in git (enforced by .gitignore + pre-commit hook)
  - Regular key rotation (90 days)
  - Breach notification plan (72h)

================================================================================
## 7. INCIDENT RESPONSE PLAN
================================================================================

Tiers:
  P0: Data breach, system down - respond within 15 min
  P1: Major feature broken - respond within 1 hour
  P2: Minor bug - respond within 8 hours
  P3: Cosmetic - next sprint

Response Steps:
  1. Detect (monitoring alerts, user reports)
  2. Triage (determine severity, impact)
  3. Contain (disable access, rollback, block IPs)
  4. Investigate (logs, traces, determine root cause)
  5. Remediate (fix vulnerability, restore service)
  6. Communicate (status page, affected users)
  7. Post-mortem (within 48 hours, written report)

Communication:
  - Status page: status.leadgenius.com
  - Slack channel: #incidents
  - Email to affected users (within 72h for data breaches)
  - Updated within 24h or every 24h during ongoing incidents
