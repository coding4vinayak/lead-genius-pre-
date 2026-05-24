# DATA FLOW DIAGRAMS - LeadGenius

================================================================================
## 1. LEAD IMPORT FLOW
================================================================================

User Uploads CSV
       |
       v
[Frontend] Uploads file -> [API] POST /api/leads/import
       |
       v
[Server] Parses CSV (multer + csv-parse)
       |
       v
[Server] Validates each row (Zod schema)
       |
       +--[Error]--> Returns error rows with messages
       |
       v
[Server] Inserts leads in batch (INSERT ... ON CONFLICT)
       |
       v
[Server] Triggers enrichment for each lead
       |
       +--[Enrichment Queue]--> BullMQ -> Worker -> Gemini API
       |                              |
       |                              v
       |                         Updates lead.enrichment_data
       |
       v
[Response] Returns { inserted: N, errors: [], enriched: N }

================================================================================
## 2. CAMPAIGN EXECUTION FLOW
================================================================================

User Activates Campaign
       |
       v
[API] PUT /api/campaigns/:id/activate
       |
       v
[Server] Updates status to 'active', sets started_at
       |
       v
[Scheduler] Cron job runs every 5 minutes
       |
       v
[Cron] SELECT * FROM leads 
       WHERE campaign_id = :id 
       AND next_action_at <= NOW()
       AND status IN ('new', 'contacted')
       |
       v
[For each eligible lead]
       |
       +--[Campaign Queue]--> BullMQ -> Worker
                |
                v
       [Worker] Gets sequence_config from campaign
                |
                v
       [Worker] Gets current step from lead.current_step
                |
                v
       [Worker] Constructs message from sequence step config
                |
                v
       [Worker] Sends via appropriate channel:
                |
                +--[Email]--> SendGrid API -> Update message status
                |
                +--[WhatsApp]--> Twilio API -> Update message status
                |
                v
       [Worker] Updates lead:
                - current_step++
                - status = 'contacted'
                - next_action_at = NOW() + step.delay_hours
                - last_contacted_at = NOW()
                |
                v
       [Worker] Logs activity

================================================================================
## 3. INBOUND MESSAGE FLOW
================================================================================

Lead Replies via Email/WhatsApp
       |
       v
[Webhook] POST /webhook/reply (Twilio/SendGrid)
       |
       v
[Server] Identifies lead from sender (email/phone lookup)
       |
       v
[Server] Creates inbound message record
       |
       v
[Server] Triggers intent analysis
       |
       +--[AI Queue]--> BullMQ -> Worker
                |
                v
       [Worker] Calls Gemini analyzeIntent(messages, lead context)
                |
                v
       [Worker] Returns: { level: "HIGH"|"MEDIUM"|"LOW", reasoning }
                |
                v
       [Worker] Updates lead.intent_analysis
                |
                v
       [Worker] If intent >= threshold:
                - Generates draft reply via Gemini
                - Updates message.draft_reply
                - message.is_read = false
                |
                v
       [Worker] If intent == "HIGH":
                - Updates lead status = 'replied'
                - Flags for human attention
                - Logs "Human handoff recommended"
       |
       v
[Server] Returns 200 OK to webhook provider

================================================================================
## 4. AUTO-PILOT FLOW
================================================================================

Auto-Pilot Active (agent_settings.is_auto_pilot_active = true)
       |
       v
[Worker] Monitors for new inbound messages with AI drafts
       |
       v
[Worker] Checks: is_auto_pilot_active AND 
                  intent_analysis.level >= auto_reply_threshold
       |
       +--[Condition: Auto-reply] 
                |
                v
       [Worker] Sends AI-generated draft as reply
                |
                v
       [Worker] Creates outbound message record
                |
                v
       [Worker] Updates lead status
                |
                v
       [Worker] Logs "Auto-reply sent"
       |
       +--[Condition: Human Handoff]
                |
                v
       [Worker] Sends human_handoff_message to lead
                |
                v
       [Worker] Flags lead for team attention
                |
                v
       [Worker] Logs "Human handoff - lead marked for review"

================================================================================
## 5. REAL-TIME DATA PUSH (WebSocket/SSE)
================================================================================

[Server Event] (new message, lead update, campaign change)
       |
       v
[Event Emitter] -> workspace channel
       |
       v
[SSE] Server-Sent Events to connected clients
       |
       v
[Frontend] EventSource listener updates React state
       |
       v
[React] Re-renders affected components
       - Inbox gets new message
       - Dashboard counters update
       - Lead status badge changes
       - Activity log appends entry

================================================================================
## 6. MCP SERVER DATA FLOW
================================================================================

[External AI Client] (Claude, Cursor, etc.)
       |
       v
[MCP Server] Stdio/SSE Transport
       |
       +--[List Tools]--> Returns tool definitions
       |
       +--[Call Tool]    
                |
                +--list_leads(workspace_id, filters) 
                |     -> Database query -> Formatted response
                |
                +--get_lead(lead_id) 
                |     -> Database query -> Lead object
                |
                +--create_campaign(name, product, industry, sequence) 
                |     -> Database insert -> Campaign object
                |
                +--analyze_intent(lead_id) 
                |     -> Get messages -> Call Gemini -> Return analysis
                |
                +--send_message(lead_id, content, channel) 
                |     -> Create outbound msg -> Send via Twilio/SendGrid
                |
                +--enrich_lead(lead_id) 
                |     -> Call Gemini -> Update lead data
                |
       |
       +--[List Resources]
                |
                +--lead://{id} -> Lead data
                +--campaign://{id} -> Campaign data
                +--inbox://{leadId} -> Messages for lead
                +--analytics://{workspaceId} -> Workspace stats
       |
       +--[Get Prompt]
                |
                +--draft_reply -> Template for generating replies
                +--campaign_strategy -> Template for campaign planning

================================================================================
## 7. BILLING FLOW
================================================================================

Usage Event Occurs
       |
       v
[Server] Records usage in usage_records table
       |
       v
[Cron Job] Runs hourly
       |
       v
[Worker] Aggregates usage for each workspace
       |
       v
[Worker] Reports to Stripe meter (stripe.meterEvents.create)
       |
       v
[Stripe] Calculates invoice based on metered usage
       |
       v
[Webhook] stripe/webhook receives invoice.finalized
       |
       v
[Server] Updates workspace.plan_tier if needed
       |
       v
[Email] Sends invoice to workspace admin
