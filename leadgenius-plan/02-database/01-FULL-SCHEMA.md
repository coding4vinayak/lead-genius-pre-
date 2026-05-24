# DATABASE SCHEMA - LeadGenius
## Complete PostgreSQL Schema with RLS, Indexes & Migrations

================================================================================
## ENTITY RELATIONSHIP DIAGRAM (Text)
================================================================================

workspaces  1---*  users
workspaces  1---*  workspaces_api_keys
workspaces  1---*  campaigns
workspaces  1---*  agent_settings
workspaces  1---*  activity_logs
workspaces  1---*  usage_records
workspaces  1---*  stripe_customers

campaigns   1---*  leads
campaigns   1---*  campaign_sequences

leads       1---*  messages
leads       1---*  lead_analytics

users       1---*  team_members
workspaces  1---*  team_members
users       1---*  user_sessions

================================================================================
## TABLE: workspaces
================================================================================

CREATE TABLE workspaces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) UNIQUE NOT NULL,
  plan_tier         VARCHAR(20) NOT NULL DEFAULT 'starter' 
                    CHECK (plan_tier IN ('starter', 'pro', 'agency')),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  max_seats         INTEGER NOT NULL DEFAULT 1,
  max_leads         INTEGER NOT NULL DEFAULT 500,
  max_campaigns     INTEGER NOT NULL DEFAULT 5,
  ai_enabled        BOOLEAN NOT NULL DEFAULT false,
  auto_pilot_enabled BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  settings          JSONB NOT NULL DEFAULT '{
    "default_tone": "professional",
    "timezone": "UTC",
    "working_hours": {"start": "09:00", "end": "18:00"},
    "working_days": [1,2,3,4,5]
  }',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_stripe ON workspaces(stripe_customer_id);

================================================================================
## TABLE: users
================================================================================

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255),
  full_name         VARCHAR(255) NOT NULL,
  avatar_url        VARCHAR(500),
  is_superadmin     BOOLEAN NOT NULL DEFAULT false,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login ON users(last_login_at);

================================================================================
## TABLE: team_members
================================================================================

CREATE TABLE team_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role              VARCHAR(20) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by        UUID REFERENCES users(id),
  invitation_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (invitation_status IN ('pending', 'accepted', 'declined')),
  joined_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_team_members_workspace ON team_members(workspace_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

================================================================================
## TABLE: api_keys
================================================================================

CREATE TABLE api_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_prefix        VARCHAR(10) NOT NULL, -- first 10 chars for identification
  key_hash          VARCHAR(64) NOT NULL, -- SHA-256 of full key
  label             VARCHAR(100) NOT NULL,
  permissions       JSONB NOT NULL DEFAULT '["leads:read", "campaigns:read"]',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_used_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id)
);

CREATE INDEX idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

================================================================================
## TABLE: campaigns
================================================================================

CREATE TABLE campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  product           VARCHAR(255),
  industry          VARCHAR(100),
  occasion          VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  sequence_config   JSONB NOT NULL DEFAULT '[]',
  -- sequence_config structure:
  -- [
  --   {
  --     "day": 1,
  --     "channel": "email",
  --     "subject": "string",
  --     "body": "string",
  --     "delay_hours": 0
  --   },
  --   {
  --     "day": 3,
  --     "channel": "whatsapp",
  --     "body": "string",
  --     "delay_hours": 0
  --   }
  -- ]
  total_leads       INTEGER NOT NULL DEFAULT 0,
  sent_count        INTEGER NOT NULL DEFAULT 0,
  reply_count       INTEGER NOT NULL DEFAULT 0,
  conversion_count  INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_started ON campaigns(started_at);

================================================================================
## TABLE: leads
================================================================================

CREATE TABLE leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name              VARCHAR(255) NOT NULL,
  email             VARCHAR(255),
  phone             VARCHAR(50),
  company           VARCHAR(255),
  title             VARCHAR(255),
  linkedin_url      VARCHAR(500),
  source            VARCHAR(50) NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('apollo', 'google_maps', 'csv', 'manual', 'api', 'webhook')),
  status            VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'contacted', 'replied', 'converted', 'lost')),
  tags              TEXT[] DEFAULT '{}',
  score             INTEGER DEFAULT 0, -- AI lead scoring 0-100
  enrichment_data   JSONB DEFAULT '{}', 
  -- {
  --   "company_description": "text",
  --   "icebreaker": "text",
  --   "linkedin_summary": "text",
  --   "recent_news": ["..."],
  --   "technologies_used": ["..."]
  -- }
  intent_analysis   JSONB DEFAULT '{}',
  -- {
  --   "level": "HIGH" | "MEDIUM" | "LOW",
  --   "reasoning": "text",
  --   "analyzed_at": "ISO timestamp"
  -- }
  current_step      INTEGER DEFAULT 0,
  next_action_at    TIMESTAMPTZ,  -- when to send next message
  last_contacted_at TIMESTAMPTZ,
  converted_at      TIMESTAMPTZ,
  custom_fields     JSONB DEFAULT '{}',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL INDEXES for query performance
CREATE INDEX idx_leads_workspace ON leads(workspace_id);
CREATE INDEX idx_leads_campaign ON leads(campaign_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_next_action ON leads(next_action_at) WHERE status IN ('new', 'contacted');
CREATE INDEX idx_leads_workspace_status ON leads(workspace_id, status);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_leads_tags ON leads USING GIN(tags);
CREATE INDEX idx_leads_created ON leads(created_at DESC);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_phone ON leads(phone);

-- Full text search index
CREATE INDEX idx_leads_search ON leads USING GIN(
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(company,'') || ' ' || coalesce(email,''))
);

================================================================================
## TABLE: messages
================================================================================

CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  content           TEXT NOT NULL,
  subject           VARCHAR(500), -- for email messages
  direction         VARCHAR(10) NOT NULL
                    CHECK (direction IN ('outbound', 'inbound')),
  channel           VARCHAR(20) NOT NULL
                    CHECK (channel IN ('email', 'whatsapp', 'webhook', 'api')),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  is_read           BOOLEAN NOT NULL DEFAULT false,
  is_ai_generated   BOOLEAN NOT NULL DEFAULT false,
  intent_analysis   JSONB DEFAULT NULL,
  -- {
  --   "level": "HIGH" | "MEDIUM" | "LOW",
  --   "reasoning": "text",
  --   "analyzed_at": "ISO timestamp"
  -- }
  draft_reply       TEXT DEFAULT NULL, -- AI-generated draft response
  provider_message_id VARCHAR(255), -- Twilio/SendGrid message ID
  provider_status   VARCHAR(50),
  metadata          JSONB DEFAULT '{}',
  -- {
  --   "provider_response": {},
  --   "error_details": {},
  --   "tracking": {}
  -- }
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_lead ON messages(lead_id);
CREATE INDEX idx_messages_workspace ON messages(workspace_id);
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_unread ON messages(lead_id, is_read) WHERE is_read = false;
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_status ON messages(status);

================================================================================
## TABLE: agent_settings
================================================================================

CREATE TABLE agent_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ai_provider           VARCHAR(20) NOT NULL DEFAULT 'gemini'
                        CHECK (ai_provider IN ('gemini', 'openai', 'anthropic')),
  ai_model              VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash',
  api_key_encrypted     TEXT, -- encrypted API key for BYOK
  tone                  VARCHAR(20) NOT NULL DEFAULT 'professional'
                        CHECK (tone IN ('professional', 'friendly', 'casual', 'formal', 'custom')),
  custom_tone_prompt    TEXT,
  auto_reply_threshold  VARCHAR(10) NOT NULL DEFAULT 'medium'
                        CHECK (auto_reply_threshold IN ('high', 'medium', 'low')),
  human_handoff_message TEXT NOT NULL DEFAULT 'A sales representative will follow up with you shortly.',
  is_auto_pilot_active  BOOLEAN NOT NULL DEFAULT false,
  working_hours_only    BOOLEAN NOT NULL DEFAULT true,
  max_daily_replies     INTEGER NOT NULL DEFAULT 50,
  language              VARCHAR(10) NOT NULL DEFAULT 'en',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_settings_workspace ON agent_settings(workspace_id);

================================================================================
## TABLE: activity_logs
================================================================================

CREATE TABLE activity_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id           UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  event_type        VARCHAR(30) NOT NULL
                    CHECK (event_type IN (
                      'cron', 'webhook', 'ai_process', 'message_sent',
                      'message_received', 'intent_analyzed', 'lead_enriched',
                      'campaign_started', 'campaign_paused', 'lead_status_changed',
                      'auto_reply_sent', 'human_handoff', 'error', 'api_call',
                      'user_action', 'auth_event', 'billing_event', 'system'
                    )),
  severity          VARCHAR(10) NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  metadata          JSONB DEFAULT '{}',
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_workspace ON activity_logs(workspace_id);
CREATE INDEX idx_activity_logs_lead ON activity_logs(lead_id);
CREATE INDEX idx_activity_logs_type ON activity_logs(event_type);
CREATE INDEX idx_activity_logs_severity ON activity_logs(severity);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- Partition by month for performance
-- CREATE TABLE activity_logs_y2026m01 PARTITION OF activity_logs
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

================================================================================
## TABLE: usage_records
================================================================================

CREATE TABLE usage_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric            VARCHAR(50) NOT NULL
                    CHECK (metric IN (
                      'ai_message', 'intent_analysis', 'lead_enrichment',
                      'campaign_generation', 'api_call', 'whatsapp_message',
                      'email_sent', 'storage_mb'
                    )),
  quantity          INTEGER NOT NULL DEFAULT 1,
  unit              VARCHAR(20) NOT NULL DEFAULT 'count',
  metered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB DEFAULT '{}'
);

CREATE INDEX idx_usage_records_workspace ON usage_records(workspace_id);
CREATE INDEX idx_usage_records_metric ON usage_records(metric);
CREATE INDEX idx_usage_records_metered ON usage_records(metered_at);
CREATE INDEX idx_usage_records_billing ON usage_records(workspace_id, metered_at, metric);

================================================================================
## TABLE: stripe_customers
================================================================================

CREATE TABLE stripe_customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(20) DEFAULT 'incomplete'
                      CHECK (subscription_status IN (
                        'incomplete', 'active', 'past_due', 'canceled', 'unpaid'
                      )),
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  metered_features   JSONB DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_customers_stripe ON stripe_customers(stripe_customer_id);
CREATE INDEX idx_stripe_customers_subscription ON stripe_customers(stripe_subscription_id);

================================================================================
## ROW LEVEL SECURITY (RLS) POLICIES
================================================================================

-- Enable RLS on all tenant tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's workspace
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  UNION
  SELECT id FROM workspaces WHERE id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  );
$$;

-- Campaigns RLS
CREATE POLICY campaigns_tenant_isolation ON campaigns
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Leads RLS
CREATE POLICY leads_tenant_isolation ON leads
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Messages RLS
CREATE POLICY messages_tenant_isolation ON messages
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Agent Settings RLS
CREATE POLICY agent_settings_tenant_isolation ON agent_settings
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Activity Logs RLS
CREATE POLICY activity_logs_tenant_isolation ON activity_logs
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- API Keys RLS
CREATE POLICY api_keys_tenant_isolation ON api_keys
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- Usage Records RLS
CREATE POLICY usage_records_tenant_isolation ON usage_records
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

================================================================================
## TRIGGERS
================================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_agent_settings_updated_at
  BEFORE UPDATE ON agent_settings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Auto-update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE campaigns SET
    total_leads = (SELECT COUNT(*) FROM leads WHERE campaign_id = NEW.campaign_id),
    sent_count = (SELECT COUNT(*) FROM messages WHERE campaign_id = NEW.campaign_id AND direction = 'outbound'),
    reply_count = (SELECT COUNT(*) FROM messages WHERE campaign_id = NEW.campaign_id AND direction = 'inbound'),
    conversion_count = (SELECT COUNT(*) FROM leads WHERE campaign_id = NEW.campaign_id AND status = 'converted')
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaign_stats_on_lead_change
  AFTER INSERT OR UPDATE ON leads FOR EACH ROW
  WHEN (NEW.campaign_id IS NOT NULL)
  EXECUTE FUNCTION update_campaign_stats();

================================================================================
## MIGRATION STRATEGY
================================================================================

Use Supabase migrations or node-pg-migrate:

migrations/
  001_create_workspaces.sql
  002_create_users.sql
  003_create_team_members.sql
  004_create_api_keys.sql
  005_create_campaigns.sql
  006_create_leads.sql
  007_create_messages.sql
  008_create_agent_settings.sql
  009_create_activity_logs.sql
  010_create_usage_records.sql
  011_create_stripe_customers.sql
  012_create_indexes.sql
  013_enable_rls.sql
  014_create_triggers.sql
  015_seed_data.sql

================================================================================
## CACHE STRATEGY
================================================================================

  Redis Cache Keys:
    workspace:{id}:stats          - Dashboard stats (TTL: 5min)
    workspace:{id}:leads:count    - Lead count by status (TTL: 1min)
    workspace:{id}:campaigns      - Campaign list (TTL: 2min)
    workspace:{id}:inbox:unread   - Unread count (TTL: 30s)
    lead:{id}                     - Single lead (TTL: 5min)
    campaign:{id}                 - Single campaign (TTL: 5min)
    agent:settings:{workspace_id} - Agent config (TTL: 10min)
    api:key:{prefix}              - API key lookup (TTL: 1hr)

  Cache invalidation on mutation of the underlying resource.
