export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'LeadGenius API',
    version: '1.0.0',
    description: 'Lead management, campaigns, messaging, and AI-powered sales engagement platform.',
    contact: { email: 'hello@leadgenius.ai' },
  },
  servers: [{ url: '/', description: 'API server' }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT token from POST /api/auth/login' },
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'API key generated from /api/api-keys' },
    },
    schemas: {
      Lead: {
        type: 'object',
        properties: {
          id: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, name: { type: 'string' },
          company: { type: 'string' }, title: { type: 'string' }, source: { type: 'string' },
          status: { type: 'string', enum: ['active', 'unsubscribed', 'bounced', 'invalid'] },
          stage: { type: 'string', enum: ['new', 'contacted', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
          tags: { type: 'array', items: { type: 'string' } }, score: { type: 'integer' }, notes: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Campaign: {
        type: 'object',
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'scheduled', 'running', 'paused', 'completed'] },
          channel: { type: 'string', enum: ['email', 'whatsapp'] },
          sentCount: { type: 'integer' }, failedCount: { type: 'integer' }, replyCount: { type: 'integer' },
          openedCount: { type: 'integer' }, createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Message: {
        type: 'object', properties: {
          id: { type: 'string' }, leadId: { type: 'string' }, campaignId: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'whatsapp'] },
          direction: { type: 'string', enum: ['outbound', 'inbound'] },
          subject: { type: 'string' }, body: { type: 'string' },
          status: { type: 'string', enum: ['queued', 'sent', 'delivered', 'failed', 'bounced', 'replied'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'integer' }, message: { type: 'string' }, details: { type: 'object' } } } } },
      PaginationMeta: { type: 'object', properties: { total: { type: 'integer' }, page: { type: 'integer' }, pageSize: { type: 'integer' }, totalPages: { type: 'integer' } } },
    },
  },
  paths: {
    '/api/health': {
      get: { tags: ['Health'], summary: 'Health check', responses: { '200': { description: 'OK' } }, security: [] },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login', security: [],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] } } } },
        responses: { '200': { description: 'Returns JWT token' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/api/auth/signup': {
      post: {
        tags: ['Auth'], summary: 'Sign up', security: [],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' } }, required: ['email', 'password'] } } } },
        responses: { '201': { description: 'User created' } },
      },
    },
    '/api/leads': {
      get: {
        tags: ['Leads'], summary: 'List leads', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'pageSize', schema: { type: 'integer', default: 50 } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'source', schema: { type: 'string' } },
          { in: 'query', name: 'tag', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated leads', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Lead' } }, meta: { $ref: '#/components/schemas/PaginationMeta' } } } } } } },
      },
      post: {
        tags: ['Leads'], summary: 'Create lead', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } },
        responses: { '201': { description: 'Lead created' } },
      },
    },
    '/api/leads/{id}': {
      get: { tags: ['Leads'], summary: 'Get lead', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Lead details' } } },
      put: { tags: ['Leads'], summary: 'Update lead', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Lead updated' } } },
      delete: { tags: ['Leads'], summary: 'Delete lead', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Lead deleted' } } },
    },
    '/api/leads/{id}/stage': {
      put: { tags: ['Leads'], summary: 'Update lead stage', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { stage: { type: 'string', enum: ['new', 'contacted', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] } }, required: ['stage'] } } } }, responses: { '200': { description: 'Stage updated' } }, security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] },
    },
    '/api/leads/{id}/notes': {
      put: { tags: ['Leads'], summary: 'Update lead notes', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { notes: { type: 'string' } } } } } }, responses: { '200': { description: 'Notes updated' } }, security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] },
    },
    '/api/leads/{id}/timeline': {
      get: { tags: ['Leads'], summary: 'Get lead timeline', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Timeline entries' } }, security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] },
      post: { tags: ['Leads'], summary: 'Add timeline entry', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '201': { description: 'Entry created' } }, security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] },
    },
    '/api/leads/bulk-tag': {
      post: { tags: ['Leads'], summary: 'Bulk tag leads', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'Tags updated' } } },
    },
    '/api/leads/export': {
      post: { tags: ['Leads'], summary: 'Export leads', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'CSV or JSON export' } } },
    },
    '/api/campaigns': {
      get: { tags: ['Campaigns'], summary: 'List campaigns', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], parameters: [{ in: 'query', name: 'page', schema: { type: 'integer' } }, { in: 'query', name: 'pageSize', schema: { type: 'integer' } }, { in: 'query', name: 'status', schema: { type: 'string' } }], responses: { '200': { description: 'Paginated campaigns' } } },
      post: { tags: ['Campaigns'], summary: 'Create campaign', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '201': { description: 'Campaign created' } } },
    },
    '/api/campaigns/{id}': {
      get: { tags: ['Campaigns'], summary: 'Get campaign', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Campaign details' } }, security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] },
      put: { tags: ['Campaigns'], summary: 'Update campaign', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Campaign updated' } }, security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] },
      delete: { tags: ['Campaigns'], summary: 'Delete campaign', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Campaign deleted' } }, security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] },
    },
    '/api/campaigns/{id}/activate': {
      post: { tags: ['Campaigns'], summary: 'Activate campaign', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Campaign activated' } }, security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] },
    },
    '/api/groups': {
      get: { tags: ['Groups'], summary: 'List groups', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'Groups list' } } },
      post: { tags: ['Groups'], summary: 'Create group', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '201': { description: 'Group created' } } },
    },
    '/api/templates': {
      get: { tags: ['Templates'], summary: 'List templates', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'Templates list' } } },
      post: { tags: ['Templates'], summary: 'Create template', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '201': { description: 'Template created' } } },
    },
    '/api/messages': {
      get: { tags: ['Messages'], summary: 'List messages', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'Paginated messages' } } },
      post: { tags: ['Messages'], summary: 'Create message', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '201': { description: 'Message created' } } },
    },
    '/api/analytics/overview': {
      get: { tags: ['Analytics'], summary: 'Dashboard overview', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'Analytics overview' } } },
    },
    '/api/settings': {
      get: { tags: ['Settings'], summary: 'Get settings', security: [{ BearerAuth: [] }], responses: { '200': { description: 'Settings' } } },
      put: { tags: ['Settings'], summary: 'Update settings', security: [{ BearerAuth: [] }], responses: { '200': { description: 'Settings updated' } } },
    },
    '/api/api-keys': {
      get: { tags: ['API Keys'], summary: 'List API keys', security: [{ BearerAuth: [] }], responses: { '200': { description: 'API keys list' } } },
      post: { tags: ['API Keys'], summary: 'Create API key', security: [{ BearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, expiresInDays: { type: 'integer' } }, required: ['name'] } } } }, responses: { '201': { description: 'API key created (shown once)' } } },
    },
    '/api/api-keys/{id}': {
      delete: { tags: ['API Keys'], summary: 'Delete API key', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], security: [{ BearerAuth: [] }], responses: { '200': { description: 'API key deleted' } } },
    },
    '/api/api-keys/{id}/toggle': {
      post: { tags: ['API Keys'], summary: 'Toggle API key active status', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], security: [{ BearerAuth: [] }], responses: { '200': { description: 'Status toggled' } } },
    },
    '/api/webhook-endpoints': {
      get: { tags: ['Webhooks'], summary: 'List webhook endpoints', security: [{ BearerAuth: [] }], responses: { '200': { description: 'Webhook endpoints list' } } },
      post: { tags: ['Webhooks'], summary: 'Create webhook endpoint', security: [{ BearerAuth: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' } } }, required: ['name', 'url', 'events'] } } } }, responses: { '201': { description: 'Webhook created' } } },
    },
    '/api/webhook-endpoints/{id}': {
      put: { tags: ['Webhooks'], summary: 'Update webhook endpoint', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], security: [{ BearerAuth: [] }], responses: { '200': { description: 'Webhook updated' } } },
      delete: { tags: ['Webhooks'], summary: 'Delete webhook endpoint', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], security: [{ BearerAuth: [] }], responses: { '200': { description: 'Webhook deleted' } } },
    },
    '/api/webhook-endpoints/{id}/toggle': {
      post: { tags: ['Webhooks'], summary: 'Toggle webhook active', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], security: [{ BearerAuth: [] }], responses: { '200': { description: 'Status toggled' } } },
    },
    '/api/webhook-endpoints/{id}/deliveries': {
      get: { tags: ['Webhooks'], summary: 'Get delivery logs', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], security: [{ BearerAuth: [] }], responses: { '200': { description: 'Delivery logs' } } },
    },
    '/api/webhook-endpoints/{id}/regenerate-secret': {
      post: { tags: ['Webhooks'], summary: 'Regenerate webhook secret', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], security: [{ BearerAuth: [] }], responses: { '200': { description: 'Secret regenerated' } } },
    },
    '/api/inbox': {
      get: { tags: ['Inbox'], summary: 'List inbox messages', security: [{ BearerAuth: [] }], responses: { '200': { description: 'Inbox messages' } } },
    },
    '/api/agent': {
      get: { tags: ['AI Agent'], summary: 'Get agent settings', security: [{ BearerAuth: [] }], responses: { '200': { description: 'Agent settings' } } },
      put: { tags: ['AI Agent'], summary: 'Update agent settings', security: [{ BearerAuth: [] }], responses: { '200': { description: 'Agent settings updated' } } },
    },
    '/api/ai/enrich-lead': {
      post: { tags: ['AI'], summary: 'Enrich lead with AI', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'Lead enriched' } } },
    },
    '/api/ai/analyze-intent': {
      post: { tags: ['AI'], summary: 'Analyze message intent', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'Intent analyzed' } } },
    },
    '/api/ai/generate-draft': {
      post: { tags: ['AI'], summary: 'Generate reply draft', security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }], responses: { '200': { description: 'Draft generated' } } },
    },
    '/webhook/email': {
      post: { tags: ['Webhooks'], summary: 'Inbound email webhook', security: [], responses: { '200': { description: 'Processed' } } },
    },
    '/webhook/whatsapp': {
      post: { tags: ['Webhooks'], summary: 'Inbound WhatsApp webhook', security: [], responses: { '200': { description: 'Processed' } } },
    },
  },
};
