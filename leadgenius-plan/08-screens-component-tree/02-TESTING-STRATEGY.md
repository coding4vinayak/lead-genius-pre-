# TESTING STRATEGY & QA - LeadGenius

================================================================================
## 1. TEST PYRAMID
================================================================================

           /\
          /  \        E2E Tests (Playwright) - 10 tests
         /    \       Cover critical user journeys
        /      \
       /--------\     Integration Tests (Supertest) - 50 tests
      /          \    Cover API endpoints + DB interaction
     /            \
    /--------------\  Unit Tests (Vitest) - 200+ tests
   /                \ Cover services, utils, schemas, workers

================================================================================
## 2. UNIT TESTS (Vitest)
================================================================================

Location: src/**/*.test.ts
Config: vitest.config.ts with coverage

Services to test:
  - AI service (mock Gemini responses)
  - Auth service (JWT, API key verification)
  - Email service (SendGrid mock)
  - WhatsApp service (Twilio mock)
  - Validation schemas (Zod)
  - Utility functions
  - Prompt templates (variable substitution)

Example:
  describe('AIService.analyzeIntent', () => {
    it('returns HIGH for purchase intent messages')
    it('returns LOW for generic responses')
    it('handles empty message history')
    it('handles API errors gracefully')
    it('returns valid structured output')
    it('respects temperature parameter')
  })

  describe('LeadValidation', () => {
    it('requires name')
    it('requires email or phone')
    it('validates email format')
    it('validates phone E.164 format')
    it('strips whitespace from fields')
    it('truncates long strings')
  })

================================================================================
## 3. INTEGRATION TESTS (Supertest)
================================================================================

Location: tests/integration/
Setup: Test database (separate Postgres) + Redis

Test Suites:
  - Auth flow (signup, login, logout, session)
  - Lead CRUD (create, read, update, delete, search, filter)
  - Campaign lifecycle (create, activate, pause, complete)
  - Message flow (send, receive webhook, read)
  - Webhook handlers (Twilio, SendGrid, Stripe)
  - Billing (usage recording, Stripe sync)
  - API key auth (create, verify, revoke, rate limit)
  - Multi-tenancy (data isolation between workspaces)

Example:
  describe('POST /api/leads', () => {
    it('creates a lead successfully')
    it('returns 400 for missing name')
    it('returns 400 for invalid email')
    it('returns 401 without auth')
    it('creates lead in correct workspace')
    it('rejects cross-workspace access')
    it('auto-enriches on creation')
  })

================================================================================
## 4. E2E TESTS (Playwright)
================================================================================

Location: tests/e2e/
Browser: Chromium (default), Firefox, WebKit

Critical User Journeys:
  1. New user signs up, creates workspace
  2. Imports CSV leads, views in table
  3. Creates campaign via AI generator
  4. Activates campaign, monitors in Live Engine
  5. Receives inbound message, views intent analysis
  6. Sends AI-generated reply
  7. Configures agent settings, toggles auto-pilot
  8. Invites team member, changes roles
  9. Generates API key, tests with curl
  10. Upgrades plan via Stripe checkout

Example Playwright test:
  test('Lead import flow', async ({ page }) => {
    await page.goto('/leads');
    await page.click('text=Import CSV');
    await page.setInputFiles('input[type=file]', 'test-data/leads.csv');
    await page.click('text=Import');
    await page.waitForSelector('text=25 leads imported');
    expect(await page.locator('table tr').count()).toBe(26); // 25 + header
  });

================================================================================
## 5. LOAD TESTS (k6)
================================================================================

Location: tests/load/
Scenarios:
  - 100 concurrent users browsing dashboard
  - 50 concurrent leads API operations
  - 10 concurrent AI analysis requests
  - Webhook flood test (100 req/sec)

Metrics targets:
  - p95 response time < 500ms
  - Error rate < 1%
  - Zero timeouts

================================================================================
## 6. TEST DATA STRATEGY
================================================================================

Factories: @faker-js/faker for generating realistic test data
Seeds: tests/seeds/ with 100 leads, 5 campaigns, 500 messages

Database per test suite:
  - Each test suite gets fresh database
  - AfterAll: drop database
  - Use transactions for test isolation within suites

================================================================================
## 7. CI INTEGRATION
================================================================================

GitHub Actions:
  - PR tests: lint + typecheck + unit + integration (< 5 min)
  - Main merge: all tests + E2E + build (< 15 min)
  - Nightly: full test suite + load tests (< 30 min)

Coverage threshold:
  - Line coverage: 80%
  - Branch coverage: 70%
  - Function coverage: 85%
