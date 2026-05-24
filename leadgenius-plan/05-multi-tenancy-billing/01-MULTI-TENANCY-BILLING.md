# MULTI-TENANCY & BILLING - LeadGenius
## Workspace Architecture, API Keys, Roles, Stripe Integration

================================================================================
## 1. MULTI-TENANCY MODEL
================================================================================

Architecture: Row-Level Multi-tenancy (Shared Database, Isolated Data)

  Workspace A                    Workspace B
  ├── Users: alice@, bob@       ├── Users: carol@, dave@
  ├── Leads: 150                ├── Leads: 300
  ├── Campaigns: 3              ├── Campaigns: 7
  ├── Messages: 1200            ├── Messages: 4500
  ├── API Keys: 2               ├── API Keys: 5
  └── Plan: Pro ($99)           └── Plan: Agency ($299)

Isolation Strategy:
  99%: Row Level Security (Postgres RLS)
  1%: Application-level checks (critical operations)

================================================================================
## 2. WORKSPACE CREATION FLOW
================================================================================

User Signs Up
  |
  v
1. Create workspace with unique slug
2. Create user record
3. Create team_member entry (role: admin)
4. Create default agent_settings
5. Create Stripe customer
6. Return workspace + session

Workspace Switcher:
  - User can belong to multiple workspaces
  - Header shows current workspace name + dropdown
  - Switching changes context (all data fetches scoped to workspace)
  - localStorage: lastActiveWorkspace

================================================================================
## 3. TEAM ROLES & PERMISSIONS
================================================================================

Role       | Leads | Campaigns | Settings | API Keys | Billing | Members
-----------|-------|-----------|----------|----------|---------|--------
Admin      | CRUD  | CRUD      | CRUD     | CRUD     | CRUD    | CRUD
Member     | CRUD  | CRUD      | Read     | Read     | Read    | Read
Viewer     | Read  | Read      | Read     | Read     | Read    | Read

Permission Map:
{
  "admin": {
    "leads": ["create", "read", "update", "delete", "export", "import"],
    "campaigns": ["create", "read", "update", "delete", "activate", "pause"],
    "settings": ["read", "update"],
    "api_keys": ["create", "read", "revoke"],
    "billing": ["read", "update", "cancel"],
    "members": ["invite", "remove", "change_role"]
  },
  "member": {
    "leads": ["create", "read", "update", "delete", "export", "import"],
    "campaigns": ["create", "read", "update", "delete", "activate", "pause"],
    "settings": ["read"],
    "api_keys": ["read"],
    "billing": ["read"],
    "members": ["read"]
  },
  "viewer": {
    "leads": ["read"],
    "campaigns": ["read"],
    "settings": ["read"],
    "api_keys": [],
    "billing": [],
    "members": ["read"]
  }
}

Middleware checkPermission(workspaceId, userId, resource, action):
  SELECT role FROM team_members WHERE workspace_id = $1 AND user_id = $2
  -> Check if role has permission

================================================================================
## 4. API KEY SYSTEM
================================================================================

Key Format:  lg_live_<36 chars hex>
Prefix:      lg_live_xxxx (first 10 chars for identification)
Full Key:    lg_live_abc123def456... (shown only once at creation)

Flow:
  1. User clicks "Generate API Key"
  2. POST /api-keys { label: "Production", permissions: [...] }
  3. Server generates random key
  4. Stores SHA-256 hash + prefix
  5. Returns full key to user (one-time display)
  6. User copies key

Verification:
  1. Extract prefix from key
  2. SELECT key_hash FROM api_keys WHERE key_prefix = prefix
  3. SHA-256(full key) == key_hash
  4. Check is_active, expires_at
  5. Resolve to workspace_id

Rate Limiting:
  workspace-{id}: 100 req/min (API key)
  Tracking: Redis sorted set per minute

================================================================================
## 5. DUAL AUTH MIDDLEWARE
================================================================================

// src/middleware/auth.ts

async function requireApiKeyOrAuth(req, res, next) {
  // 1. Check API Key
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const workspaceId = await verifyApiKey(apiKey);
    if (!workspaceId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' }});
    }
    req.workspaceId = workspaceId;
    req.authMethod = 'api_key';
    return next();
  }

  // 2. Check JWT (Supabase)
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' }});
    }
    req.user = user;
    
    // Resolve workspace (from header, session, or default)
    const workspaceId = req.headers['x-workspace-id'] || 
                        await getDefaultWorkspace(user.id);
    req.workspaceId = workspaceId;
    req.authMethod = 'jwt';
    return next();
  }

  // 3. No auth
  return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' }});
}

================================================================================
## 6. STRIPE BILLING INTEGRATION
================================================================================

### Pricing Tiers

Tier     | Price  | AI Msgs | Intent Analysis | Enrich | Auto-Pilot | API | Team
---------|--------|---------|-----------------|--------|------------|-----|-----
Starter  | $29/mo | 0       | 0               | 0      | No         | No  | 1 seat
Pro      | $99/mo | 500     | 200             | 100    | Manual    | Yes | 5 seats
Agency   | $299/mo| 3000    | 1000            | 500    | Yes        | Yes | 20 seats

Add-ons:
  - Additional AI Message: $0.02
  - Additional Intent Analysis: $0.05
  - Additional Seat: $15/mo (Pro), $10/mo (Agency)
  - White-label: $999/mo
  - BYOK (Bring Your Own Key): Included in Agency

### Stripe Product Configuration

Products in Stripe:
  1. leadgenius_starter  - $29/month (standard subscription)
  2. leadgenius_pro      - $99/month (standard subscription)
  3. leadgenius_agency   - $299/month (standard subscription)
  4. ai_message_meter    - $0.02/unit (metered usage)
  5. intent_analysis_meter - $0.05/unit (metered usage)
  6. extra_seat          - $15/unit (per-seat add-on)

### Metered Billing Flow

Every Hour (Cron):
  1. Aggregate usage_records for each workspace
     SELECT metric, SUM(quantity) 
     FROM usage_records 
     WHERE metered_at >= last_report_time 
       AND metered_at < NOW()
     GROUP BY workspace_id, metric

  2. For each workspace with Stripe subscription:
     - stripe.meterEvents.create({
         event_name: 'ai_messages_used',
         payload: {
           value: quantity,
           stripe_customer_id: workspace.stripe_customer_id
         }
       })

  3. Update last_report_time

### Stripe Webhook Events

customer.subscription.updated:
  - Update workspace.plan_tier
  - Update workspace.max_seats, max_leads, max_campaigns
  - Toggle ai_enabled, auto_pilot_enabled based on tier

invoice.payment_succeeded:
  - Mark subscription as active
  - Send success email

invoice.payment_failed:
  - Mark subscription as past_due
  - Send warning email
  - Grace period: 7 days
  - After grace: downgrade to Starter (manual mode)

customer.subscription.deleted:
  - Downgrade to Starter (manual)
  - Disable AI features
  - Disable auto-pilot
  - Archive workspace after 30 days

### Checkout Flow

User clicks "Upgrade" in dashboard
  |
  v
POST /api/billing/create-checkout { priceId }
  |
  v
Returns Stripe Checkout Session URL
  |
  v
User completes payment on Stripe
  |
  v
Stripe sends checkout.session.completed webhook
  |
  v
Server: update workspace plan, enable features
  |
  v
Redirect back to dashboard with success toast

================================================================================
## 7. USAGE TRACKING & LIMITS
================================================================================

Every AI operation records usage:
  After analyzeIntent: INSERT INTO usage_records (workspace_id, metric='intent_analysis', quantity=1)
  After generateDraft: INSERT INTO usage_records (workspace_id, metric='ai_message', quantity=1)
  After enrichLead: INSERT INTO usage_records (workspace_id, metric='lead_enrichment', quantity=1)
  After generateCampaign: INSERT INTO usage_records (workspace_id, metric='campaign_generation', quantity=1)

Limit Checking:
  Before AI operation: check workspace usage vs plan limits
  If exceeded: return 402 (Payment Required) with upgrade link
  Soft limit (80%): warning notification
  Hard limit (100%): block operation

Reset Cycle: Monthly (billing period)

================================================================================
## 8. AUDIT LOGGING
================================================================================

All sensitive operations logged to activity_logs:
  - API key created/revoked
  - Team member invited/removed
  - Role changed
  - Workspace settings changed
  - Billing plan changed
  - Campaign activated/paused
  - Bulk operations (import, delete, status change)

Log retention: 90 days (active), 1 year (archived)
