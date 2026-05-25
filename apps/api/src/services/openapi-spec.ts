export function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'LeadGenius API',
      description: 'Public REST API for the LeadGenius marketing automation platform. Manage leads, campaigns, templates, messages, sequences, and more programmatically.',
      version: '1.0.0',
      contact: {
        name: 'LeadGenius Support',
        email: 'support@leadgenius.io',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API base path',
      },
    ],
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token obtained via /api/auth/login',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key generated from the dashboard',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'integer' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
              required: ['code', 'message'],
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        Lead: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            name: { type: 'string' },
            company: { type: 'string' },
            title: { type: 'string' },
            source: { type: 'string' },
            status: { type: 'string', enum: ['active', 'unsubscribed', 'bounced', 'invalid'] },
            tags: { type: 'array', items: { type: 'string' } },
            score: { type: 'integer', nullable: true },
            stage: { type: 'string', enum: ['new', 'contacted', 'engaged', 'warm', 'hot', 'converted', 'lost'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Campaign: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'scheduled', 'running', 'paused', 'completed'] },
            channel: { type: 'string', enum: ['email', 'whatsapp'] },
            templateId: { type: 'string' },
            sentCount: { type: 'integer' },
            failedCount: { type: 'integer' },
            replyCount: { type: 'integer' },
            openedCount: { type: 'integer' },
            clickedCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Template: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            channel: { type: 'string', enum: ['email', 'whatsapp'] },
            subject: { type: 'string' },
            body: { type: 'string' },
            variables: { type: 'array', items: { type: 'string' } },
            category: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            campaignId: { type: 'string', nullable: true },
            leadId: { type: 'string' },
            channel: { type: 'string', enum: ['email', 'whatsapp'] },
            direction: { type: 'string', enum: ['outbound', 'inbound'] },
            subject: { type: 'string' },
            body: { type: 'string' },
            status: { type: 'string', enum: ['queued', 'sent', 'delivered', 'failed', 'bounced', 'replied'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Sequence: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        LeadGroup: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      parameters: {
        page: {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', default: 1 },
          description: 'Page number for pagination',
        },
        pageSize: {
          in: 'query',
          name: 'pageSize',
          schema: { type: 'integer', default: 50, maximum: 100 },
          description: 'Number of items per page',
        },
      },
    },
    paths: {
      '/leads': {
        get: {
          tags: ['Leads'],
          summary: 'List leads',
          description: 'Retrieve a paginated list of leads with optional filtering',
          parameters: [
            { $ref: '#/components/parameters/page' },
            { $ref: '#/components/parameters/pageSize' },
            { in: 'query', name: 'status', schema: { type: 'string' } },
            { in: 'query', name: 'search', schema: { type: 'string' } },
            { in: 'query', name: 'tag', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'List of leads',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Lead' } },
                      meta: { $ref: '#/components/schemas/Pagination' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        post: {
          tags: ['Leads'],
          summary: 'Create a lead',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    name: { type: 'string' },
                    company: { type: 'string' },
                    title: { type: 'string' },
                    source: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Lead created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Lead' } } } } } },
            '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/leads/{id}': {
        get: {
          tags: ['Leads'],
          summary: 'Get a lead by ID',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Lead details', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Lead' } } } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        put: {
          tags: ['Leads'],
          summary: 'Update a lead',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Lead' } } } },
          responses: {
            '200': { description: 'Lead updated', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Lead' } } } } } },
          },
        },
        delete: {
          tags: ['Leads'],
          summary: 'Delete a lead',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Lead deleted' },
          },
        },
      },
      '/campaigns': {
        get: {
          tags: ['Campaigns'],
          summary: 'List campaigns',
          parameters: [
            { $ref: '#/components/parameters/page' },
            { $ref: '#/components/parameters/pageSize' },
          ],
          responses: {
            '200': { description: 'List of campaigns', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Campaign' } }, meta: { $ref: '#/components/schemas/Pagination' } } } } } },
          },
        },
        post: {
          tags: ['Campaigns'],
          summary: 'Create a campaign',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, channel: { type: 'string' }, templateId: { type: 'string' } }, required: ['name', 'channel', 'templateId'] } } } },
          responses: {
            '201': { description: 'Campaign created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Campaign' } } } } } },
          },
        },
      },
      '/templates': {
        get: {
          tags: ['Templates'],
          summary: 'List templates',
          parameters: [
            { $ref: '#/components/parameters/page' },
            { $ref: '#/components/parameters/pageSize' },
          ],
          responses: {
            '200': { description: 'List of templates', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Template' } }, meta: { $ref: '#/components/schemas/Pagination' } } } } } },
          },
        },
        post: {
          tags: ['Templates'],
          summary: 'Create a template',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, channel: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['name', 'channel', 'body'] } } } },
          responses: {
            '201': { description: 'Template created', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Template' } } } } } },
          },
        },
      },
      '/groups': {
        get: {
          tags: ['Groups'],
          summary: 'List lead groups',
          parameters: [
            { $ref: '#/components/parameters/page' },
            { $ref: '#/components/parameters/pageSize' },
          ],
          responses: {
            '200': { description: 'List of groups', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/LeadGroup' } }, meta: { $ref: '#/components/schemas/Pagination' } } } } } },
          },
        },
      },
      '/messages': {
        get: {
          tags: ['Messages'],
          summary: 'List messages',
          parameters: [
            { $ref: '#/components/parameters/page' },
            { $ref: '#/components/parameters/pageSize' },
            { in: 'query', name: 'leadId', schema: { type: 'string' } },
            { in: 'query', name: 'campaignId', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'List of messages', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Message' } }, meta: { $ref: '#/components/schemas/Pagination' } } } } } },
          },
        },
      },
      '/sequences': {
        get: {
          tags: ['Sequences'],
          summary: 'List sequences',
          parameters: [
            { $ref: '#/components/parameters/page' },
            { $ref: '#/components/parameters/pageSize' },
          ],
          responses: {
            '200': { description: 'List of sequences', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Sequence' } }, meta: { $ref: '#/components/schemas/Pagination' } } } } } },
          },
        },
      },
    },
    tags: [
      { name: 'Leads', description: 'Lead management endpoints' },
      { name: 'Campaigns', description: 'Campaign management endpoints' },
      { name: 'Templates', description: 'Template management endpoints' },
      { name: 'Groups', description: 'Lead group management endpoints' },
      { name: 'Messages', description: 'Message history endpoints' },
      { name: 'Sequences', description: 'Drip sequence endpoints' },
    ],
  };
}
