# SCREENS & COMPONENT TREE - LeadGenius
## Every Screen: Components, Props, State, Actions, Colors

================================================================================
[SCREEN 01] DASHBOARD
================================================================================

File: src/pages/Dashboard.tsx
Route: /dashboard (default)
Layout: Full width with sidebar

=== COMPONENT TREE ===

DashboardPage
  +-- PageHeader
  |     title: "Dashboard"
  |     subtitle: "Your sales overview at a glance"
  |     rightAction: <DateRangeSelector />
  |
  +-- KpiRow (grid-cols-4 gap-6)
  |     +-- KpiCard (x4)
  |           variant: "primary" | "success" | "warning" | "info"
  |           icon: <TrendingUp> | <Users> | <MessageSquare> | <Target>
  |           label: "Total Leads" | "Active Campaigns" | "Replies" | "Conversions"
  |           value: number
  |           change: number (percentage, positive=green, negative=red)
  |           changeLabel: "vs last week"
  |           bgColor: brand-50 | emerald-50 | amber-50 | violet-50
  |           iconColor: brand-600 | emerald-600 | amber-600 | violet-600
  |           state: loading (skeleton) | error (retry button) | empty (0)
  |
  +-- GridRow (grid-cols-2 gap-6)
  |     +-- Card "Lead Status Distribution"
  |     |     +-- PieChart (Recharts)
  |     |           data: [{name: "New", value: N, color: blue}, ...]
  |     |           innerRadius: 60, outerRadius: 100
  |     |           +-- CustomTooltip
  |     |           +-- Legend (bottom)
  |     |     state: loading | empty ("No leads yet") | error
  |     |
  |     +-- Card "Message Activity (7 Days)"
  |           +-- BarChart (Recharts)
  |                 data: [{day: "Mon", email: N, whatsapp: N}, ...]
  |                 bars: <Bar dataKey="email" color=blue>, <Bar dataKey="whatsapp" color=green>
  |                 stacked: true
  |           state: loading | empty | error
  |
  +-- Card "Recent Activity"
        +-- ActivityFeed
              items: Array<ActivityItem>
              +-- ActivityItem (x5)
                    icon: <Mail> | <MessageCircle> | <Brain> | <UserCheck>
                    bgColor: brand-50 | emerald-50 | violet-50 | amber-50
                    iconColor: brand-600 | emerald-600 | violet-600 | amber-600
                    title: string
                    description: string
                    timestamp: "2 min ago" (relative time)
                    badge?: string (optional status badge)
              state: loading (3 skeleton items) | empty ("No recent activity") | error
              emptyAction: "Launch your first campaign" button -> navigates to /campaigns

=== INTERACTIONS ===
  - DateRangeSelector click: opens dropdown with "7D", "30D", "90D", Custom
  - KpiCard click: navigates to relevant screen
  - PieChart segment click: filters leads by status
  - ActivityItem click: navigates to relevant record

=== STATE MANAGEMENT ===
  Context: useData() from DataProvider
  State: dashboardStats { totalLeads, activeCampaigns, totalReplies, conversions, leadByStatus, activityByDay, recentActivity }
  Refresh: auto-refresh every 30 seconds
  Loading: skeleton placeholders
  Error: toast notification + retry button on each card

=== EDGE CASES ===
  - First time user: Show "Welcome to LeadGenius!" with onboarding CTA
  - No data: Empty states with clear CTAs
  - API failure: Individual card-level error with retry
  - Real-time update: Dashboard updates via SSE when new activity occurs

================================================================================
[SCREEN 02] LEADS DATABASE
================================================================================

File: src/pages/Leads.tsx
Route: /leads

=== COMPONENT TREE ===

LeadsPage
  +-- PageHeader
  |     title: "Leads Database"
  |     subtitle: "Manage your leads and prospects"
  |     rightActions: [
  |       <Button variant="secondary" icon=<Upload> label="Import CSV">,
  |       <Button variant="primary" icon=<Plus> label="Add Lead">
  |     ]
  |
  +-- FilterBar
  |     +-- SearchInput placeholder="Search leads..." with debounce 300ms
  |     +-- StatusDropdown options: All, New, Contacted, Replied, Converted, Lost
  |     +-- SourceDropdown options: All, Apollo, Google Maps, CSV, Manual, API
  |     +-- CampaignDropdown options: All, Campaign names
  |     +-- SortDropdown options: Newest, Oldest, Name, Status, Score
  |     +-- ViewToggle: <Grid> | <List> layout toggle
  |     activeFilters: { status: string, source: string, campaign: string, search: string }
  |     clearFilters button shown when any filter is active
  |
  +-- BulkActions (shown when leads selected)
  |     selectedCount: "N selected"
  |     actions: [
  |       <Button label="Assign to Campaign">,
  |       <Button label="Change Status">,
  |       <Button label="Enrich with AI">,
  |       <Button label="Export Selected">,
  |       <Button variant="danger" label="Delete">
  |     ]
  |
  +-- DataTable
  |     columns: [
  |       { key: "checkbox", width: 40, render: <Checkbox> },
  |       { key: "name", label: "Name", sortable: true, width: 200,
  |         render: (lead) => <LeadNameCell lead={lead} />,
  |         cell: avatar + name + company below
  |       },
  |       { key: "email", label: "Email", sortable: true, width: 200,
  |         render: (lead) => <EmailLink email={lead.email} />
  |       },
  |       { key: "phone", label: "Phone", width: 150 },
  |       { key: "status", label: "Status", width: 120,
  |         render: (lead) => <StatusBadge status={lead.status} />,
  |         colors: { new: blue, contacted: amber, replied: violet, converted: emerald, lost: red }
  |       },
  |       { key: "source", label: "Source", width: 120,
  |         render: (lead) => <Badge>{lead.source}</Badge>
  |       },
  |       { key: "score", label: "Score", width: 100,
  |         render: (lead) => <ScoreBar score={lead.score} />,
  |         color: gradient green-yellow-red
  |       },
  |       { key: "intent", label: "Intent", width: 100,
  |         render: (lead) => <IntentBadge level={lead.intent_analysis?.level} />,
  |         colors: HIGH=red, MEDIUM=amber, LOW=gray, null=dashed
  |       },
  |       { key: "lastContacted", label: "Last Contacted", width: 150,
  |         render: (lead) => relativeTime(lead.last_contacted_at)
  |       },
  |       { key: "actions", width: 80,
  |         render: (lead) => <RowActionsDropdown leadId={lead.id} />
  |       }
  |     ]
  |     sortBy: { column: string, direction: "asc" | "desc" }
  |     page: current page number
  |     pageSize: 25
  |     totalItems: number
  |     pagination: <Pagination page={n} total={N} onChange={fn} />
  |     state: loading (6 skeleton rows) | empty (illustration + "No leads yet") | error
  |
  +-- ImportCsvModal
  |     trigger: "Import CSV" button click
  |     content: 
  |       Step 1: Dropzone (drag & drop .csv file)
  |       Step 2: Column mapping UI (detect from header)
  |       Step 3: Preview first 10 rows
  |       Step 4: Import button with progress bar
  |     validation: 
  |       - Max 10MB file size
  |       - Required columns: name (email or phone)
  |       - Invalid rows highlighted in red
  |     results: { inserted: N, errors: [{row, reason}], enriched: N }
  |
  +-- AddLeadModal
        trigger: "Add Lead" button click
        width: md (640px)
        fields:
          - name: input (required, max 255 chars)
          - email: email input (optional, email format validation)
          - phone: phone input (optional, E.164 format)
          - company: input (optional)
          - title: input (optional)
          - source: dropdown (Manual default)
          - tags: tag input (multi-value, autocomplete)
          - customFields: dynamic key-value pairs
        validation: Zod schema with error messages
        onSubmit: POST /api/leads
        state: idle | submitting | success | error
        onSuccess: toast + refresh leads list

=== ACTIONS (click/event handlers) ===
  Lead row click: Navigate to lead detail (opens in modal or separate view)
  Row checkbox click: Select/deselect, show bulk actions
  Header checkbox: Select all/deselect all visible
  Sort header click: Toggle sort direction
  Import CSV: Opens modal, handles file upload, column mapping
  Add Lead: Opens modal, validates, submits
  Bulk assign campaign: Opens campaign selector modal
  Bulk change status: Opens status selector dropdown
  Bulk delete: Confirmation dialog "Delete N leads?" (danger variant)
  Row actions dropdown: View, Edit, Duplicate, Delete, Enrich with AI

=== STATE MANAGEMENT ===
  Context: useData() for leads
  Local state: filters, sorting, pagination, selected rows
  Cache: leads list cached in React Query with 30s stale time

================================================================================
[SCREEN 03] CAMPAIGNS
================================================================================

File: src/pages/Campaigns.tsx
Route: /campaigns

=== COMPONENT TREE ===

CampaignsPage
  +-- PageHeader
  |     title: "Campaigns"
  |     rightActions: [
  |       <Button variant="primary" icon=<Plus> label="New Campaign">
  |         onClick: opens CampaignWizard
  |     ]
  |
  +-- CampaignList (grid-cols-2 lg:grid-cols-3 gap-6)
  |     +-- CampaignCard (x N, clickable)
  |     |     bg: white, border, rounded-xl, shadow-sm
  |     |     hover: shadow-md, translateY -2px
  |     |     header: campaign name + status badge
  |     |     status colors: draft=gray, active=green, paused=amber, completed=blue
  |     |     stats row: leads | sent | replies | conversions (with mini progress bars)
  |     |     footer: created date + action buttons (Edit, Pause, Delete)
  |     |
  |     +-- CreateCampaignCard (last card, "dashed" border)
  |           icon: <Plus> circle
  |           title: "Create New Campaign"
  |           description: "AI-powered campaign generator"
  |
  |     state: loading (6 skeleton cards) | empty ("No campaigns") | error
  |
  +-- CampaignWizard (multi-step modal, xl width)
        Step 1 - Basics:
          - name: input (required)
          - product: input (required)
          - industry: dropdown (required)
          - occasion: textarea (optional)
          - [Generate with AI] button: calls AI to generate sequence
        Step 2 - Sequence:
          - Visual timeline of campaign steps
          - Each step: day input, channel toggle (Email/WhatsApp), subject, body editor
          - Add step button
          - Drag-and-drop reorder
          - [Generate with AI] replaces all steps if exists
        Step 3 - Leads:
          - Select leads to include (from leads database)
          - Search + filter leads
          - Show selected count
          - Campaign stats preview (total leads, estimated timeline)
        Step 4 - Review:
          - Summary of all settings
          - [Save as Draft] / [Launch Campaign] buttons
        state: dirty tracking, unsaved changes warning on close

=== ACTIONS ===
  Campaign card click: Navigate to campaign detail
  New Campaign: Opens CampaignWizard at step 1
  Generate with AI: Calls AI queue, shows loading spinner, populates steps
  Campaign status toggle: Click to pause/resume
  Delete: Confirmation dialog

================================================================================
[SCREEN 04] AI INBOX
================================================================================

File: src/pages/Inbox.tsx
Route: /inbox

=== COMPONENT TREE ===

InboxPage
  +-- PageHeader
  |     title: "AI Inbox"
  |     subtitle: "Unified inbox with AI-powered intent analysis"
  |     badge: "N unread" (red badge, auto-updates via SSE)
  |
  +-- SplitPane (horizontal, left=40% right=60%)
  |     +-- (Left) MessageListPanel
  |     |     +-- SearchInput placeholder="Search messages..."
  |     |     +-- FilterTabs: All | Unread | High Intent | Medium | Low
  |     |     +-- MessageList (scrollable, virtualized)
  |     |     |     +-- MessageListItem (x N)
  |     |     |           lead.name + company
  |     |     |           preview: first 80 chars of last message
  |     |     |           timestamp: relative time
  |     |     |           intentBadge: HIGH(red)/MEDIUM(amber)/LOW(gray)
  |     |     |           unreadDot: blue circle if unread
  |     |     |           channelIcon: <Mail> or <MessageCircle>
  |     |     |           isSelected: bg-brand-50
  |     |     |           onClick: select message, show detail
  |     |     |
  |     |     state: loading(8 skeleton items) | empty | error
  |     |
  |     +-- (Right) MessageDetailPanel
  |           +-- LeadInfoHeader
  |           |     name, company, email, phone
  |           |     statusBadge, intentBadge
  |           |     actions: [<Button "View Lead">, <Button "Call">, <Button "Email">]
  |           |
  |           +-- MessageThread (scrollable)
  |           |     +-- MessageBubble (x N)
  |           |           direction: left(inbound/brand-50) | right(outbound/slate-50)
  |           |           content: message text
  |           |           timestamp
  |           |           channelIcon
  |           |           intentTag: shown on inbound messages
  |           |           +-- AIDraftSuggestion (if has draft_reply)
  |           |                 bg: violet-50 border-l-4 border-violet-500
  |           |                 badge: "AI Suggested Reply"
  |           |                 content: draft_reply text
  |           |                 actions: [<Button "Edit">, <Button "Send">, <Button "Regenerate">]
  |           |
  |           +-- ReplyBox (bottom)
  |                 textarea: multi-line with auto-resize
  |                 toolbar: bold, italic, link, emoji
  |                 channelToggle: <Mail> <MessageCircle> (send via which channel)
  |                 actions: [<Button "Send">, <Button primary "Send with AI">]
  |                 Send with AI: opens AI draft in suggestion area first


=== AI INTENT BADGE VARIANTS ===
  HIGH: 
    bg: red-50, text: red-700, border: red-200, dot: red-500
    label: "🔥 High Intent"
  MEDIUM:
    bg: amber-50, text: amber-700, border: amber-200, dot: amber-500
    label: "👀 Medium Intent"  
  LOW:
    bg: gray-50, text: gray-600, border: gray-200, dot: gray-400
    label: "Low Intent"
  PENDING (analyzing):
    bg: violet-50, text: violet-700, border: violet-200, dot: violet-500
    label: "Analyzing..." with spinner

================================================================================
[SCREEN 05] AGENT SETTINGS
================================================================================

File: src/pages/AgentSettings.tsx
Route: /agent

=== COMPONENT TREE ===

AgentSettingsPage
  +-- PageHeader
  |     title: "Agent Settings"
  |     subtitle: "Configure your AI sales agent"
  |
  +-- AutoPilotToggle
  |     bg: white, rounded-xl, border, shadow-sm, p-6
  |     label: "Auto-Pilot Mode"
  |     description: "Let AI automatically reply to leads 24/7"
  |     toggle: <Switch checked={isAutoPilotActive} onChange={toggle} />
  |     statusBadge: "ON" (green) / "OFF" (gray)
  |     When active: shows "Agent is running" with pulse animation
  |
  +-- SettingsCard (x5, each rounded-xl border shadow-sm p-6)
  |     Card 1 - AI Provider:
  |       dropdown: Gemini 2.5 Flash | Gemini 2.0 Pro | OpenAI GPT-4o | Anthropic Claude
  |       note: "Default provider. Workspace can bring their own API key."
  |
  |     Card 2 - Communication Tone:
  |       presetButtons: Professional | Friendly | Casual | Formal
  |       custom: textarea (show when "Custom" selected)
  |       helpText: "Define how your AI agent communicates with leads"
  |
  |     Card 3 - Auto-Reply Settings:
  |       threshold: dropdown "High | Medium | Low"
  |         helpText: "Only auto-reply to intents at or above this level"
  |       maxDaily: number input (default 50)
  |       workingHours: time inputs (start/end) + day checkboxes (Mon-Sun)
  |       handoffMessage: textarea
  |
  |     Card 4 - Language & Region:
  |       language: dropdown
  |       timezone: dropdown
  |
  |     Card 5 - Human Handoff:
  |       when: radio buttons
  |         - "Never (fully autonomous)"
  |         - "On HIGH intent only"
  |         - "On HIGH and MEDIUM intent"
  |         - "Manual only"
  |
  +-- SaveButtonBar (sticky bottom)
        <Button variant="secondary" label="Reset to Defaults">
        <Button variant="primary" label="Save Settings">
        state: idle | saving | saved (shows checkmark for 2s) | error

=== EDGE CASES ===
  - Saving while auto-pilot active: Show warning "Changes will affect active agent"
  - Invalid language/tz combo: Show validation error
  - Workspace not on AI plan: Show upgrade card with pricing link

================================================================================
[SCREEN 06] LIVE ENGINE (24/7)
================================================================================

File: src/pages/LiveEngine.tsx
Route: /engine

=== COMPONENT TREE ===

LiveEnginePage
  +-- PageHeader
  |     title: "Live Engine (24/7)"
  |     subtitle: "Real-time activity from your automation engine"
  |     statusPill: "Active" (green pulse) / "Paused" (gray)
  |
  +-- StatsBar (3 cards, grid-cols-3 gap-4)
  |     +-- StatCard:
  |           label: "Processed Today"
  |           value: number (animated counter)
  |           icon: <Activity>
  |     +-- StatCard:
  |           label: "Success Rate"
  |           value: percentage
  |           icon: <CheckCircle>
  |     +-- StatCard:
  |           label: "AI Messages"
  |           value: number
  |           icon: <Brain>
  |
  +-- FilterBar
  |     filterTabs: All | Messages | AI | Webhooks | Cron | Errors
  |     severityFilter: All | Info | Warning | Error | Critical
  |
  +-- ActivityLog (scrollable, auto-scrolls to bottom, virtualized)
        +-- LogEntry (x N, infinite scroll)
              icon: <Mail> / <MessageCircle> / <Brain> / <AlertCircle> / <Clock>
              iconBg: brand-50 / emerald-50 / violet-50 / red-50 / amber-50
              iconColor: brand-600 / emerald-600 / violet-600 / red-600 / amber-600
              title: "Message sent via WhatsApp"
              description: "Step 3 of 5 sent to John Doe"
              timestamp: "2 seconds ago" (updates in real-time)
              severityDot: green/yellow/red
              +-- ExpandDetails (on click)
                    metadata: JSON viewer
                    retryButton: shown for failed items
        state: loading (10 skeleton rows) | empty ("No activity yet") | error

=== REAL-TIME UPDATES ===
  - WebSocket/SSE connection for live feed
  - New log entries slide in from bottom
  - Auto-scroll: follow mode (toggleable)
  - Sound notification on errors (toggleable)

================================================================================
[SCREEN 07-13 - SUCCINCT]
================================================================================

07 - SalesPipeline (Kanban):
  - Drag-and-drop columns: New | Contacted | Replied | Converted | Lost
  - Lead cards show name, company, score, last contact
  - Drag handler: onChangeStatus API call
  - Column counts, scrollable columns

08 - Integrations:
  - Grid of integration cards (Twilio, SendGrid, Stripe, Google, etc.)
  - Each card: logo, connected status (green dot), configure button
  - Connection modal: API key / credentials form
  - Webhook URL display with copy button

09 - Inbound & Anti-Spam:
  - SPF/DKIM/DMARC check cards
  - WhatsApp ban prevention tips
  - Deliverability score gauge
  - Bounce rate chart
  - Recommended actions list

10 - Deploy Backend:
  - Download button: generates zip with server.js, docker-compose.yml, .env
  - Code viewer with syntax highlighting
  - One-click deploy instructions
  - Environment variable guide

11 - System Plan (Blueprint):
  - Tabbed layout: Overview | DB Schema | Backend | Frontend | Integrations
  - Each tab: code blocks with syntax highlighting
  - Copy code button on each block
  - Download full specification PDF

12 - Multi-Tenancy & API:
  - Workspace management table
  - API key generation (label + create)
  - API key list with revoke option
  - Rate limit settings
  - Team member management (invite, roles)

13 - Success Strategy:
  - Markdown-rendered business plan
  - Pricing table (Starter $29 | Pro $99 | Agency $299)
  - Product Hunt launch checklist
  - MRR calculator
  - Risk mitigation matrix

================================================================================
## COMMON COMPONENTS LIBRARY
================================================================================

Shared/Reusable Components:
  Button        - variants: primary, secondary, danger, ghost, icon
                  sizes: sm, md, lg
                  states: default, hover, active, disabled, loading
                  icon support (left, right, icon-only)
  
  Modal         - sizes: sm, md, lg, xl, full, custom
                  overlay: click-to-close, escape-to-close
                  animation: scale + fade
                  header: title + close button
                  body: scrollable
                  footer: action buttons
  
  Card          - variants: default, interactive (hover), dashed (create)
                  padding: sm, md, lg
                  header, body, footer slots
  
  Badge         - variants: default, success, warning, error, info, ai
                  sizes: sm, md
                  with dot indicator option
  
  Input         - types: text, email, phone, number, password, search
                  states: default, focus, error, disabled
                  with label, helper text, error text
                  prefix/suffix icon support
  
  Select        - native or custom dropdown
                  searchable option
                  multi-select with tags
  
  Table         - sortable columns
                  selectable rows
                  pagination
                  empty state
                  loading skeleton
  
  Tabs          - underline style
                  pill style
                  with badge on tab
  
  Toast         - success, error, info, warning
                  auto-dismiss (5s)
                  manual dismiss
                  stack multiple
  
  Tooltip       - position: top, bottom, left, right
                  delay: 300ms show, 100ms hide
  
  Dropdown      - position: bottom-left, bottom-right, top-left, top-right
                  items: with icons, dividers, disabled
  
  Switch/Toggle - sizes: sm, md
                  with label
                  with description
  
  Skeleton      - variants: text, avatar, card, table-row, chart
                  animation: pulse
  
  ProgressBar   - determinate, indeterminate
                  with label, with percentage
  
  Avatar        - sizes: xs(24), sm(32), md(40), lg(48), xl(64)
                  with status dot (online/offline)
                  initials fallback
