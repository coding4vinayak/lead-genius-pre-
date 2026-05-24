# MCP SERVER ARCHITECTURE - LeadGenius
## Model Context Protocol Server Design & Integration

================================================================================
## 1. MCP SERVER OVERVIEW
================================================================================

Protocol: Model Context Protocol (MCP) v1.0
Transport: stdio (local) / SSE (remote)
Purpose: Allow AI clients (Claude, Cursor, custom) to interact with LeadGenius data
Tools: 8 operations (CRUD + AI)
Resources: 4 resource types
Prompts: 2 prompt templates

================================================================================
## 2. TOOL DEFINITIONS
================================================================================

### Tool 1: list_leads

name: "list_leads"
description: "Search and filter leads in the database"
inputSchema:
  type: object
  properties:
    workspace_id:
      type: string
      description: "Workspace UUID"
    status:
      type: string
      enum: ["new", "contacted", "replied", "converted", "lost"]
      description: "Filter by lead status"
    search:
      type: string
      description: "Search by name, email, or company"
    source:
      type: string
      enum: ["apollo", "google_maps", "csv", "manual", "api"]
      description: "Filter by source"
    limit:
      type: integer
      default: 25
      maximum: 100
    offset:
      type: integer
      default: 0
output:
  type: object
  properties:
    leads:
      type: array
      items:
        type: object
        properties:
          id: { type: string }
          name: { type: string }
          email: { type: string }
          phone: { type: string }
          company: { type: string }
          status: { type: string }
          score: { type: integer }
          intent_level: { type: string }
          last_contacted_at: { type: string }
          created_at: { type: string }
    total:
      type: integer

### Tool 2: get_lead

name: "get_lead"
description: "Get detailed lead information with messages"
inputSchema:
  type: object
  properties:
    lead_id:
      type: string
      description: "Lead UUID"
  required: ["lead_id"]
output:
  type: object
  properties:
    lead: { type: object }
    messages:
      type: array
      items: { type: object }
    campaign:
      type: object
      nullable: true

### Tool 3: create_lead

name: "create_lead"
description: "Create a new lead in the database"
inputSchema:
  type: object
  properties:
    workspace_id:
      type: string
    name:
      type: string
      maxLength: 255
    email:
      type: string
      format: email
    phone:
      type: string
    company:
      type: string
    title:
      type: string
    source:
      type: string
      enum: ["apollo", "google_maps", "csv", "manual", "api"]
      default: "api"
  required: ["workspace_id", "name"]
  oneOf: [{required: ["email"]}, {required: ["phone"]}]
output:
  type: object
  properties:
    lead: { type: object }

### Tool 4: update_lead

name: "update_lead"
description: "Update an existing lead"
inputSchema:
  type: object
  properties:
    lead_id:
      type: string
    name: { type: string }
    email: { type: string }
    phone: { type: string }
    company: { type: string }
    status:
      type: string
      enum: ["new", "contacted", "replied", "converted", "lost"]
    tags:
      type: array
      items: { type: string }
  required: ["lead_id"]
output:
  type: object
  properties:
    lead: { type: object }

### Tool 5: create_campaign

name: "create_campaign"
description: "Create a new campaign with optional AI-generated sequence"
inputSchema:
  type: object
  required: ["workspace_id", "name"]
  properties:
    workspace_id: { type: string }
    name:
      type: string
      maxLength: 255
    product:
      type: string
      maxLength: 255
    industry:
      type: string
      maxLength: 100
    occasion:
      type: string
      maxLength: 1000
    generate_sequence:
      type: boolean
      default: false
      description: "If true, AI generates the campaign sequence"
    sequence:
      type: array
      items:
        type: object
        properties:
          day: { type: integer }
          channel: { type: string, enum: ["email", "whatsapp"] }
          subject: { type: string }
          body: { type: string }
          delay_hours: { type: integer }
output:
  type: object
  properties:
    campaign: { type: object }

### Tool 6: analyze_lead_intent

name: "analyze_lead_intent"
description: "Analyze a lead's messages for purchase intent using AI"
inputSchema:
  type: object
  required: ["lead_id"]
  properties:
    lead_id: { type: string }
output:
  type: object
  properties:
    intent_level: { type: string, enum: ["HIGH", "MEDIUM", "LOW"] }
    confidence: { type: number }
    reasoning: { type: string }
    suggested_action: { type: string }
    key_signals:
      type: array
      items: { type: string }

### Tool 7: send_message

name: "send_message"
description: "Send a message to a lead via email or WhatsApp"
inputSchema:
  type: object
  required: ["lead_id", "content", "channel"]
  properties:
    lead_id: { type: string }
    content:
      type: string
      maxLength: 5000
    subject:
      type: string
      maxLength: 500
    channel:
      type: string
      enum: ["email", "whatsapp"]
output:
  type: object
  properties:
    message_id: { type: string }
    status: { type: string }
    provider_message_id: { type: string }

### Tool 8: enrich_lead

name: "enrich_lead"
description: "AI-enrich a lead with company research and icebreakers"
inputSchema:
  type: object
  required: ["lead_id"]
  properties:
    lead_id: { type: string }
output:
  type: object
  properties:
    company_description: { type: string }
    icebreaker: { type: string }
    technologies_used:
      type: array
      items: { type: string }
    pain_points:
      type: array
      items: { type: string }

================================================================================
## 3. RESOURCE DEFINITIONS
================================================================================

### Resource 1: Lead Resource

uri: "lead://{leadId}"
name: "Lead Details"
mimeType: "application/json"
description: "Complete lead information including messages and campaign"
schema:
  type: object
  properties:
    id: { type: string }
    name: { type: string }
    email: { type: string, nullable: true }
    phone: { type: string, nullable: true }
    company: { type: string, nullable: true }
    status: { type: string }
    score: { type: integer }
    source: { type: string }
    tags: { type: array, items: { type: string } }
    enrichment_data: { type: object }
    intent_analysis: { type: object }
    messages:
      type: array
      items: { type: object }
    campaign: { type: object, nullable: true }

### Resource 2: Campaign Resource

uri: "campaign://{campaignId}"
name: "Campaign Details"
mimeType: "application/json"
description: "Campaign configuration with stats and enrolled leads"

### Resource 3: Inbox Resource

uri: "inbox://{leadId}"
name: "Lead Inbox"
mimeType: "application/json"
description: "Message thread for a specific lead"

### Resource 4: Analytics Resource

uri: "analytics://{workspaceId}"
name: "Workspace Analytics"
mimeType: "application/json"
description: "Key metrics and analytics for a workspace"

================================================================================
## 4. PROMPT TEMPLATES
================================================================================

### Prompt 1: draft_reply

name: "draft_reply"
description: "Draft a sales reply to a lead's message"
arguments:
  lead_id:
    type: string
    description: "Lead UUID"
  tone:
    type: string
    enum: ["professional", "friendly", "casual", "formal"]
    default: "professional"
  context:
    type: string
    description: "Additional context for the reply"
messages:
  - role: system
    content:
      template: "You are {{agentTone}} sales rep drafting a reply to {{leadName}}..."
  - role: user
    content:
      template: "Lead: {{leadName}}\nCompany: {{company}}\nMessage: {{latestMessage}}\nIntent: {{intentLevel}}"

### Prompt 2: campaign_strategy

name: "campaign_strategy"
description: "Generate a campaign strategy"
arguments:
  product: { type: string }
  industry: { type: string }
  target_audience: { type: string }
  goal: { type: string }

================================================================================
## 5. MCP SERVER IMPLEMENTATION
================================================================================

// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'leadgenius-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_leads',
      description: 'Search and filter leads',
      inputSchema: { ... }
    },
    // ... other tools
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'list_leads':
      return { content: [{ type: 'text', text: JSON.stringify(await listLeads(args)) }] };
    case 'get_lead':
      return { content: [{ type: 'text', text: JSON.stringify(await getLead(args.lead_id)) }] };
    case 'create_lead':
      return { content: [{ type: 'text', text: JSON.stringify(await createLead(args)) }] };
    case 'analyze_lead_intent':
      return { content: [{ type: 'text', text: JSON.stringify(await analyzeIntent(args.lead_id)) }] };
    case 'send_message':
      return { content: [{ type: 'text', text: JSON.stringify(await sendMessage(args)) }] };
    // ... etc
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'lead://{id}',
      name: 'Lead Details',
      description: 'Complete lead information',
      mimeType: 'application/json'
    },
    // ... other resources
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  // Parse URI and fetch data
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(await getResourceData(uri))
    }]
  };
});

// Prompt handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'draft_reply',
      description: 'Draft a sales reply',
      arguments: [
        { name: 'lead_id', description: 'Lead UUID', required: true },
        { name: 'tone', description: 'Communication tone', required: false }
      ]
    }
  ]
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // Return prompt template with filled arguments
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

================================================================================
## 6. AUTHENTICATION FOR MCP
================================================================================

MCP Server supports two auth modes:
1. stdio: Auth via environment variable LEADGENIUS_API_KEY
2. SSE: Auth via X-API-Key header

Middleware validates in order:
1. Check X-API-Key header
2. Check Authorization: Bearer <JWT> header
3. Check LEADGENIUS_API_KEY env var (stdio)
4. Return 401 if none valid

================================================================================
## 7. MCP CONFIGURATION FOR CLIENTS
================================================================================

Claude Desktop:
{
  "mcpServers": {
    "leadgenius": {
      "command": "npx",
      "args": ["-y", "@leadgenius/mcp-server"],
      "env": {
        "LEADGENIUS_API_KEY": "lg_live_xxxx",
        "LEADGENIUS_WORKSPACE_ID": "ws_xxxx"
      }
    }
  }
}

opencode.jsonc:
{
  "mcpServers": {
    "leadgenius": {
      "command": "node",
      "args": ["path/to/mcp-server/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
