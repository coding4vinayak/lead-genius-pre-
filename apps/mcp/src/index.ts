import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.LEADGENIUS_API_URL || 'http://localhost:3001/api';
const API_TOKEN = process.env.LEADGENIUS_API_TOKEN || '';

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...options?.headers as Record<string, string> } });
  if (!res.ok) {
    const body: any = await res.json().catch(() => null);
    const msg = body?.error?.message || res.statusText || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

const server = new Server(
  { name: 'leadgenius-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_leads',
      description: 'List leads with pagination, search, and filters',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number (default 1)' },
          pageSize: { type: 'number', description: 'Items per page (default 50)' },
          search: { type: 'string', description: 'Search by name or email' },
          status: { type: 'string', description: 'Filter by status: active, unsubscribed, bounced, invalid' },
          source: { type: 'string', description: 'Filter by source' },
          tag: { type: 'string', description: 'Filter by tag' },
        },
      },
    },
    {
      name: 'get_lead',
      description: 'Get a single lead by ID',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Lead ID' } },
        required: ['id'],
      },
    },
    {
      name: 'create_lead',
      description: 'Create a new lead',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          phone: { type: 'string' },
          name: { type: 'string' },
          company: { type: 'string' },
          title: { type: 'string' },
          source: { type: 'string' },
          status: { type: 'string', enum: ['active', 'unsubscribed', 'bounced', 'invalid'] },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: [],
      },
    },
    {
      name: 'update_lead',
      description: 'Update an existing lead',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Lead ID' },
          email: { type: 'string' },
          phone: { type: 'string' },
          name: { type: 'string' },
          company: { type: 'string' },
          title: { type: 'string' },
          source: { type: 'string' },
          status: { type: 'string', enum: ['active', 'unsubscribed', 'bounced', 'invalid'] },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['id'],
      },
    },
    {
      name: 'delete_lead',
      description: 'Delete a lead by ID',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Lead ID' } },
        required: ['id'],
      },
    },
    {
      name: 'list_campaigns',
      description: 'List campaigns with pagination and filters',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number (default 1)' },
          pageSize: { type: 'number', description: 'Items per page (default 50)' },
          status: { type: 'string', description: 'Filter by status' },
        },
      },
    },
    {
      name: 'get_campaign',
      description: 'Get a single campaign by ID',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Campaign ID' } },
        required: ['id'],
      },
    },
    {
      name: 'create_campaign',
      description: 'Create a new campaign',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Campaign name' },
          description: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'whatsapp'] },
          templateId: { type: 'string', description: 'Template ID to use' },
          leadGroupIds: { type: 'array', items: { type: 'string' }, description: 'Lead group IDs' },
          scheduleType: { type: 'string', enum: ['immediate', 'scheduled', 'recurring'] },
          sendStrategy: { type: 'string', enum: ['sequential', 'burst'] },
          dailyLimit: { type: 'number' },
        },
        required: ['name', 'channel', 'templateId'],
      },
    },
    {
      name: 'list_groups',
      description: 'List lead groups',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          pageSize: { type: 'number' },
        },
      },
    },
    {
      name: 'list_templates',
      description: 'List message templates',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          pageSize: { type: 'number' },
          channel: { type: 'string', enum: ['email', 'whatsapp'] },
        },
      },
    },
    {
      name: 'list_messages',
      description: 'List messages with pagination and filters',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          pageSize: { type: 'number' },
          campaignId: { type: 'string' },
          leadId: { type: 'string' },
          status: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'whatsapp'] },
        },
      },
    },
    {
      name: 'get_analytics',
      description: 'Get dashboard analytics overview',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_campaign_analytics',
      description: 'Get detailed analytics for a campaign',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Campaign ID' } },
        required: ['id'],
      },
    },
    {
      name: 'analyze_message_intent',
      description: 'Analyze the intent of an inbound message using AI',
      inputSchema: {
        type: 'object',
        properties: { messageId: { type: 'string', description: 'Message ID to analyze' } },
        required: ['messageId'],
      },
    },
    {
      name: 'generate_reply_draft',
      description: 'Generate an AI-powered reply draft for a message',
      inputSchema: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID' },
          tone: { type: 'string', enum: ['professional', 'friendly', 'casual', 'formal'], description: 'Reply tone (default professional)' },
        },
        required: ['messageId'],
      },
    },
    {
      name: 'enrich_lead',
      description: 'Enrich lead data using AI (company info, suggested tags, etc.)',
      inputSchema: {
        type: 'object',
        properties: { leadId: { type: 'string', description: 'Lead ID to enrich' } },
        required: ['leadId'],
      },
    },
    {
      name: 'get_agent_settings',
      description: 'Get AI agent configuration and auto-pilot status',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'toggle_autopilot',
      description: 'Toggle the AI agent auto-pilot on/off',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_leads': {
        const params = new URLSearchParams();
        if (args?.page) params.set('page', String(args.page));
        if (args?.pageSize) params.set('pageSize', String(args.pageSize));
        if (args?.search) params.set('search', String(args.search));
        if (args?.status) params.set('status', String(args.status));
        if (args?.source) params.set('source', String(args.source));
        if (args?.tag) params.set('tag', String(args.tag));
        const data = await apiFetch(`/leads?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'get_lead': {
        const data = await apiFetch(`/leads/${args?.id}`);
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'create_lead': {
        const data = await apiFetch('/leads', {
          method: 'POST',
          body: JSON.stringify(args),
        });
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'update_lead': {
        const { id, ...body } = args as any;
        const data = await apiFetch(`/leads/${id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'delete_lead': {
        await apiFetch(`/leads/${args?.id}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: 'Lead deleted successfully' }] };
      }

      case 'list_campaigns': {
        const params = new URLSearchParams();
        if (args?.page) params.set('page', String(args.page));
        if (args?.pageSize) params.set('pageSize', String(args.pageSize));
        if (args?.status) params.set('status', String(args.status));
        const data = await apiFetch(`/campaigns?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'get_campaign': {
        const data = await apiFetch(`/campaigns/${args?.id}`);
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'create_campaign': {
        const data = await apiFetch('/campaigns', {
          method: 'POST',
          body: JSON.stringify(args),
        });
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'list_groups': {
        const params = new URLSearchParams();
        if (args?.page) params.set('page', String(args.page));
        if (args?.pageSize) params.set('pageSize', String(args.pageSize));
        const data = await apiFetch(`/groups?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'list_templates': {
        const params = new URLSearchParams();
        if (args?.page) params.set('page', String(args.page));
        if (args?.pageSize) params.set('pageSize', String(args.pageSize));
        if (args?.channel) params.set('channel', String(args.channel));
        const data = await apiFetch(`/templates?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'list_messages': {
        const params = new URLSearchParams();
        if (args?.page) params.set('page', String(args.page));
        if (args?.pageSize) params.set('pageSize', String(args.pageSize));
        if (args?.campaignId) params.set('campaignId', String(args.campaignId));
        if (args?.leadId) params.set('leadId', String(args.leadId));
        if (args?.status) params.set('status', String(args.status));
        if (args?.channel) params.set('channel', String(args.channel));
        const data = await apiFetch(`/messages?${params}`);
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'get_analytics': {
        const data = await apiFetch('/analytics');
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'get_campaign_analytics': {
        const data = await apiFetch(`/analytics/campaign/${args?.id}`);
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'analyze_message_intent': {
        const data = await apiFetch('/ai/analyze-intent', {
          method: 'POST',
          body: JSON.stringify({ messageId: args?.messageId }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'generate_reply_draft': {
        const data = await apiFetch('/ai/generate-draft', {
          method: 'POST',
          body: JSON.stringify({ messageId: args?.messageId, tone: args?.tone }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'enrich_lead': {
        const data = await apiFetch('/ai/enrich-lead', {
          method: 'POST',
          body: JSON.stringify({ leadId: args?.leadId }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'get_agent_settings': {
        const data = await apiFetch('/agent');
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      case 'toggle_autopilot': {
        const data = await apiFetch('/agent/toggle-autopilot', { method: 'POST' });
        return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LeadGenius MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
