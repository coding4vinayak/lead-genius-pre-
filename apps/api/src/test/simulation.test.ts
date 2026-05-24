import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';

// ────────────────────────────────────
// MOCK EXTERNAL SERVICES
// ────────────────────────────────────

const { mockQueue, mockWorker } = vi.hoisted(() => ({
  mockQueue: vi.fn(function () { return { add: vi.fn().mockResolvedValue(undefined as never), close: vi.fn() }; }),
  mockWorker: vi.fn(function () { return { on: vi.fn(), close: vi.fn() }; }),
}));

vi.mock('bullmq', () => ({ Queue: mockQueue, Worker: mockWorker }));

const mockSendMail = vi.fn().mockImplementation(() => ({ messageId: 'smtp-' + Date.now() }));
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: mockSendMail })) },
  createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
}));

vi.mock('@sendgrid/mail', () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{ headers: { 'x-message-id': 'fake-sg-id' } }]) },
}));

vi.mock('twilio', () => ({
  default: vi.fn(() => ({ messages: { create: vi.fn().mockResolvedValue({ sid: 'fake-twilio-sid' }) } })),
}));

vi.mock('../services/ai/openai.js', () => ({
  analyzeIntent: vi.fn().mockResolvedValue({ category: 'interested', confidence: 92, sentiment: 'positive', urgency: 'medium' }),
  generateDraft: vi.fn().mockResolvedValue({ subject: 'Re: Your inquiry', body: 'Thank you for reaching out! We would be happy to help.' }),
  enrichLead: vi.fn().mockResolvedValue({ companySize: '50-200', industry: 'Technology', suggestedTags: ['tech', 'saas', 'b2b'] }),
  generateCampaign: vi.fn().mockResolvedValue({ steps: [{ subject: 'Step 1', body: 'Hello' }, { subject: 'Step 2', body: 'Follow up' }] }),
}));

// ────────────────────────────────────
// IN-MEMORY DATABASE (fake Prisma)
// ────────────────────────────────────

interface InMemoryStore<T extends Record<string, unknown>> {
  items: Map<string, T>;
  nextId: () => string;
}

function createStore<T extends Record<string, unknown>>(): InMemoryStore<T> {
  let counter = 0;
  return { items: new Map(), nextId: () => { counter++; return `rec_${counter}`; } };
}

const fakeDb = {
  lead: createStore<any>(),
  campaign: createStore<any>(),
  template: createStore<any>(),
  group: createStore<any>(),
  message: createStore<any>(),
  settings: createStore<any>(),
  agentSettings: createStore<any>(),
  sequenceEnrollment: createStore<any>(),
  channelHealth: createStore<any>(),
};

fakeDb.settings.items.set('global', {
  id: 'global',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: 'user',
  smtpPass: 'pass',
  sendgridApiKey: null,
  twilioAccountSid: 'sid',
  twilioAuthToken: 'token',
  twilioFromNumber: '+15551234567',
  fromEmail: 'noreply@leadgenius.ai',
  fromName: 'LeadGenius AI',
  dailyGlobalLimit: 5000,
  defaultMinDelayMs: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeInMemoryPrisma() {
  function resolveInclude(item: any, include: any, storeName: string): any {
    if (!include) return item;
    const result = { ...item };
    for (const [rel, opts] of Object.entries(include)) {
      if (rel === 'lead') {
        result.lead = (fakeDb.lead as InMemoryStore<any>).items.get(item.leadId) || null;
        if (opts && typeof opts === 'object' && opts.select) {
          const selected: any = {};
          for (const f of Object.keys(opts.select)) selected[f] = result.lead?.[f];
          result.lead = selected;
        }
      } else if (rel === 'messages') {
        const allMsgs = Array.from((fakeDb.message as InMemoryStore<any>).items.values());
        const related = allMsgs.filter((m: any) => m.leadId === item.id || m.campaignId === item.id);
        const order = (opts as any)?.orderBy;
        if (order) {
          for (const [f, dir] of Object.entries(order)) {
            related.sort((a: any, b: any) => dir === 'desc'
              ? (b[f] < a[f] ? -1 : b[f] > a[f] ? 1 : 0)
              : (a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0));
          }
        }
        const take = (opts as any)?.take;
        result.messages = take ? related.slice(0, take) : related;
        if (opts && typeof opts === 'object' && opts.select) {
          result.messages = result.messages.map((m: any) => {
            const s: any = {};
            for (const f of Object.keys(opts.select)) s[f] = m[f];
            return s;
          });
        }
      } else if (rel === 'template') {
        result.template = (fakeDb.template as InMemoryStore<any>).items.get(item.templateId) || null;
        if (opts && typeof opts === 'object' && opts.select) {
          const selected: any = {};
          for (const f of Object.keys(opts.select)) selected[f] = result.template?.[f];
          result.template = selected;
        }
      } else if (rel === '_count') {
        const sel = (opts as any)?.select;
        if (sel) {
          result._count = {};
          for (const f of Object.keys(sel)) {
            if (f === 'messages') {
              const allMsgs = Array.from((fakeDb.message as InMemoryStore<any>).items.values());
              result._count.messages = allMsgs.filter((m: any) => m.leadId === item.id).length;
            }
          }
        }
      }
    }
    return result;
  }

  function matchQuery(item: any, where: any): boolean {
    if (!where) return true;
    for (const [key, val] of Object.entries(where)) {
      if (key === 'AND' && Array.isArray(val)) {
        if (!val.every((c: any) => matchQuery(item, c))) return false;
        continue;
      }
      if (key === 'OR' && Array.isArray(val)) {
        if (!val.some((c: any) => matchQuery(item, c))) return false;
        continue;
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        if ('every' in val && typeof val.every === 'object') {
          if (!item[key]?.every((i: any) => matchQuery(i, val.every))) return false;
          continue;
        }
        if ('some' in val && typeof val.some === 'object') {
          const relItems = (fakeDb.message as InMemoryStore<any>).items;
          const found = Array.from(relItems.values()).some((r: any) => r.leadId === item.id && matchQuery(r, val.some));
          if (!found) return false;
          continue;
        }
        if ('in' in val && Array.isArray((val as any).in)) {
          if (!(val as any).in!.includes(item[key])) return false;
          continue;
        }
        if ('has' in val) {
          if (!item[key]?.includes((val as any).has)) return false;
          continue;
        }
        if ('contains' in val) {
          const str = item[key]?.toString().toLowerCase() || '';
          if (!str.includes((val as any).contains.toLowerCase())) return false;
          continue;
        }
        if ('increment' in val) return true;
        if ('equals' in val) {
          if (item[key] !== (val as any).equals) return false;
          continue;
        }
      }
      if (item[key] !== val) return false;
    }
    return true;
  }

  function queryItems(storeName: string, args: any): any[] {
    const store = (fakeDb as any)[storeName] as InMemoryStore<any>;
    if (!store) return [];
    let items = Array.from(store.items.values());
    const where = args?.where ?? args?.[0]?.where;
    if (where) items = items.filter((i) => matchQuery(i, where));
    const orderBy = args?.orderBy ?? args?.[0]?.orderBy;
    if (orderBy) {
      for (const [field, dir] of Object.entries(orderBy)) {
        items.sort((a, b) => {
          const av = a[field], bv = b[field];
          if (av == null) return 1; if (bv == null) return -1;
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return dir === 'desc' ? -cmp : cmp;
        });
      }
    }
    return items;
  }

  function findMany(storeName: string, args: any): any[] {
    let items = queryItems(storeName, args);
    const skip = args?.skip ?? 0;
    const take = args?.take;
    if (take !== undefined) items = items.slice(skip, skip + take);
    return items;
  }

  const models = ['lead', 'campaign', 'template', 'message', 'settings', 'agentSettings', 'group', 'sequenceEnrollment', 'channelHealth'] as const;
  const handlers: Record<string, any> = {};

  for (const m of models) {
    const store = (fakeDb as any)[m] as InMemoryStore<any>;
    handlers[m] = {
      findUnique: vi.fn((args: any) => {
        const id = args?.where?.id ?? args?.[0]?.where?.id;
        const item = store.items.get(id) || null;
        if (!item) return null;
        const base = { ...item };
        return args?.include ? resolveInclude(base, args.include, m) : base;
      }),
      findFirst: vi.fn((args: any) => {
        const items = queryItems(m, args);
        if (!items.length) return null;
        const base = { ...items[0] };
        return args?.include ? resolveInclude(base, args.include, m) : base;
      }),
      findMany: vi.fn((args: any) => {
        const items = findMany(m, args);
        const copies = items.map((i: any) => ({ ...i }));
        return args?.include ? copies.map((i: any) => resolveInclude(i, args.include, m)) : copies;
      }),
      count: vi.fn((args: any) => queryItems(m, args).length),
      create: vi.fn((args: any) => {
        const raw = args?.data ?? args?.[0]?.data ?? {};
        const data = { ...raw, id: raw.id || store.nextId() };
        store.items.set(data.id, data);
        return data;
      }),
      createMany: vi.fn((args: any) => {
        const rows = args?.data ?? args?.[0]?.data ?? [];
        for (const row of rows) {
          const id = row.id || store.nextId();
          store.items.set(id, { ...row, id });
        }
        return { count: rows.length };
      }),
      update: vi.fn((args: any) => {
        const id = args?.where?.id ?? args?.[0]?.where?.id;
        const existing = store.items.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...(args?.data ?? args?.[0]?.data), updatedAt: new Date() };
        store.items.set(id, updated);
        return updated;
      }),
      updateMany: vi.fn((args: any) => {
        const items = queryItems(m, args);
        const data = args?.data ?? args?.[0]?.data;
        for (const item of items) store.items.set(item.id, { ...item, ...data, updatedAt: new Date() });
        return { count: items.length };
      }),
      delete: vi.fn((args: any) => {
        const id = args?.where?.id ?? args?.[0]?.where?.id;
        const existing = store.items.get(id);
        if (existing) store.items.delete(id);
        return existing || null;
      }),
      deleteMany: vi.fn((args: any) => { const items = queryItems(m, args); for (const i of items) store.items.delete(i.id); return { count: items.length }; }),
      upsert: vi.fn((args: any) => {
        const id = args?.where?.id; const existing = store.items.get(id);
        if (existing) { const u = { ...existing, ...args?.update, updatedAt: new Date() }; store.items.set(id, u); return u; }
        const d = { ...args?.create, id: id || store.nextId() }; store.items.set(d.id, d); return d;
      }),
    };
  }

  return { lead: handlers.lead, campaign: handlers.campaign, template: handlers.template, message: handlers.message, settings: handlers.settings, agentSettings: handlers.agentSettings, leadGroup: handlers.group, sequenceEnrollment: handlers.sequenceEnrollment, channelHealth: handlers.channelHealth };
}

const mockPrisma = makeInMemoryPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

vi.mock('../queue/index.js', () => ({
  campaignQueue: { add: vi.fn().mockResolvedValue(undefined as never), close: vi.fn() },
  sendQueue: { add: vi.fn().mockResolvedValue(undefined as never), close: vi.fn() },
  aiQueue: { add: vi.fn().mockResolvedValue(undefined as never), close: vi.fn() },
}));

// ────────────────────────────────────
// BUILD EXPRESS APP WITH ALL ROUTES
// ────────────────────────────────────

async function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const { default: leadRoutes } = await import('../routes/leads.js');
  const { default: campaignRoutes } = await import('../routes/campaigns.js');
  const { default: groupRoutes } = await import('../routes/groups.js');
  const { default: templateRoutes } = await import('../routes/templates.js');
  const { default: messageRoutes } = await import('../routes/messages.js');
  const { default: analyticsRoutes } = await import('../routes/analytics.js');
  const { default: settingsRoutes } = await import('../routes/settings.js');
  const { default: webhookRoutes } = await import('../routes/webhooks.js');
  const { default: inboxRoutes } = await import('../routes/inbox.js');
  const { default: agentRoutes } = await import('../routes/agent.js');

  app.use('/api/leads', leadRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/webhook', webhookRoutes);
  app.use('/api/inbox', inboxRoutes);
  app.use('/api/agent', agentRoutes);
  app.use(errorHandler);

  return app;
}

// ────────────────────────────────────
// SIMULATION TESTS
// ────────────────────────────────────

describe('Full System Simulation — LeadGenius End-to-End Pipeline', () => {
  let app: express.Express;
  let aliceLeadId: string;
  let frankLeadId: string;
  let createdGroupId: string;
  let emailTemplateId: string;
  let createdCampaignId: string;
  let outboundMessageId: string;
  let inboundMessageId: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(() => {
    for (const store of Object.values(fakeDb)) store.items.clear();
  });

  // ── PHASE 1: LEAD INGESTION ──

  it('PHASE 1: Import leads in bulk', async () => {
    const res = await request(app).post('/api/leads/import').send({
      leads: [
        { name: 'Alice Johnson', email: 'alice@acme.com', phone: '+14155550101', company: 'Acme Corp', title: 'VP Sales', source: 'website', status: 'active', tags: ['tech', 'saas'] },
        { name: 'Bob Smith', email: 'bob@widgets.io', phone: '+14155550102', company: 'Widgets Inc', title: 'CEO', source: 'referral', status: 'active', tags: ['ecommerce'] },
        { name: 'Carol Davis', email: 'carol@dataflow.com', phone: '+14155550103', company: 'DataFlow', title: 'CTO', source: 'linkedin', status: 'active', tags: ['tech', 'ai'] },
        { name: 'Dave Wilson', email: 'dave@buildcorp.com', phone: '+14155550104', company: 'BuildCorp', title: 'Engineer', source: 'manual', status: 'active', tags: ['manufacturing'] },
        { name: 'Eve Martin', email: 'eve@healthplus.com', phone: '+14155550105', company: 'HealthPlus', title: 'CMO', source: 'event', status: 'lead', tags: ['healthtech'] },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.count).toBe(5);
    expect(fakeDb.lead.items.size).toBe(5);

    const alice = Array.from(fakeDb.lead.items.values()).find((l: any) => l.email === 'alice@acme.com')!;
    aliceLeadId = alice.id;
  });

  it('PHASE 1b: Create individual lead', async () => {
    const res = await request(app).post('/api/leads').send({
      name: 'Frank Thomas', email: 'frank@example.com', phone: '+14155550106', company: 'FrankCo', source: 'manual', status: 'active',
    });
    expect(res.status).toBe(201);
    frankLeadId = res.body.data.id;
    expect(fakeDb.lead.items.size).toBe(6);
  });

  it('PHASE 1c: List & filter leads', async () => {
    const res = await request(app).get('/api/leads?page=1&pageSize=3');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta.total).toBe(6);
    expect(res.body.meta.totalPages).toBe(2);

    const filtered = await request(app).get('/api/leads?source=website&page=1&pageSize=10');
    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].email).toBe('alice@acme.com');
  });

  // ── PHASE 2: GROUPS ──

  it('PHASE 2: Create group', async () => {
    const res = await request(app).post('/api/groups').send({
      name: 'Tech Companies', description: 'Companies in tech industry', filterRules: { tag: 'tech' },
    });
    expect(res.status).toBe(201);
    createdGroupId = res.body.data.id;
  });

  it('PHASE 2b: List groups', async () => {
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  // ── PHASE 3: TEMPLATES ──

  it('PHASE 3: Create email template', async () => {
    const res = await request(app).post('/api/templates').send({
      name: 'Q1 Outreach Email', channel: 'email',
      subject: 'Hello {{name}}, great to connect!',
      body: '<p>Hi {{name}},</p><p>We loved meeting you at {{event}}. Check out our platform!</p>',
      variables: ['name', 'event'], category: 'outreach',
    });
    expect(res.status).toBe(201);
    emailTemplateId = res.body.data.id;
  });

  it('PHASE 3b: Create WhatsApp template (omit subject)', async () => {
    const res = await request(app).post('/api/templates').send({
      name: 'WhatsApp Follow-up', channel: 'whatsapp',
      body: 'Hey {{name}}, thanks for your interest in {{product}}!',
      variables: ['name', 'product'], category: 'followup',
    });
    expect(res.status).toBe(201);
    expect(fakeDb.template.items.size).toBe(2);
  });

  // ── PHASE 4: CAMPAIGNS ──

  it('PHASE 4: Create campaign', async () => {
    const res = await request(app).post('/api/campaigns').send({
      name: 'Q1 Tech Outreach',
      description: 'First outreach to tech companies',
      channel: 'email',
      templateId: emailTemplateId,
      leadGroupIds: [createdGroupId],
      scheduleType: 'immediate',
      sendStrategy: 'sequential',
      dailyLimit: 50,
      minDelayMs: 2000,
    });
    expect(res.status).toBe(201);
    createdCampaignId = res.body.data.id;
  });

  it('PHASE 4b: Activate campaign → status=running + queue.execute-campaign', async () => {
    const queueModule = await import('../queue/index.js');
    const mockCampaignQueue = queueModule.campaignQueue;

    const res = await request(app).post(`/api/campaigns/${createdCampaignId}/activate`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('running');
    expect(mockCampaignQueue.add).toHaveBeenCalledWith('execute-campaign', { campaignId: createdCampaignId });
  });

  it('PHASE 5: Campaign lifecycle — pause / resume / stop', async () => {
    expect((await request(app).post(`/api/campaigns/${createdCampaignId}/pause`)).body.data.status).toBe('paused');
    expect((await request(app).post(`/api/campaigns/${createdCampaignId}/resume`)).body.data.status).toBe('running');
    expect((await request(app).post(`/api/campaigns/${createdCampaignId}/stop`)).body.data.status).toBe('completed');
    expect((await request(app).post(`/api/campaigns/${createdCampaignId}/activate`)).body.data.status).toBe('running');
  });

  // ── PHASE 6: EMAIL SENDING (sandbox) ──

  it('PHASE 6: Send email via SMTP — captured in sandbox', async () => {
    const { sendEmail } = await import('../services/email.js');
    const created = await mockPrisma.message.create({
      data: { leadId: aliceLeadId, channel: 'email', direction: 'outbound', subject: 'Welcome!', body: '<p>Hi Alice</p>', status: 'queued' },
    });
    outboundMessageId = created.id;

    await sendEmail('alice@acme.com', 'Welcome!', '<p>Hi Alice</p>', created.id);

    const msg = fakeDb.message.items.get(outboundMessageId);
    expect(msg?.status).toBe('sent');
    expect(msg?.providerId).toBeTruthy();
    expect(msg?.deliveredAt).toBeDefined();
  });

  // ── PHASE 7: WEBHOOK HANDLING ──

  it('PHASE 7: Email reply webhook → creates inbound message + queues AI analysis', async () => {
    const queueModule = await import('../queue/index.js');
    const mockAiQueue = queueModule.aiQueue;
    const outbound = fakeDb.message.items.get(outboundMessageId);

    const res = await request(app).post('/webhook/email').send({
      to: 'alice@acme.com',
      subject: 'Re: Welcome to LeadGenius!',
      text: 'Thanks for reaching out! I am interested in learning more.',
      messageId: outbound?.providerId,
      event: 'reply',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(true);

    const repliedMsg = fakeDb.message.items.get(outboundMessageId);
    expect(repliedMsg?.status).toBe('replied');

    const inboundMsgs = Array.from(fakeDb.message.items.values())
      .filter((m: any) => m.direction === 'inbound' && m.leadId === aliceLeadId);
    expect(inboundMsgs.length).toBe(1);
    inboundMessageId = inboundMsgs[0].id;
    expect(inboundMsgs[0].body).toContain('interested');

    expect(mockAiQueue.add).toHaveBeenCalledWith('analyze-intent', { messageId: inboundMessageId });
  });

  it('PHASE 7b: Email open webhook → marks readAt', async () => {
    const outbound = fakeDb.message.items.get(outboundMessageId);
    await request(app).post('/webhook/email').send({ to: 'alice@acme.com', messageId: outbound?.providerId, event: 'open' });
    expect(fakeDb.message.items.get(outboundMessageId)?.readAt).toBeDefined();
  });

  it('PHASE 7c: Email bounce webhook → marks lead bounced + message bounced', async () => {
    const outbound = fakeDb.message.items.get(outboundMessageId);
    const res = await request(app).post('/webhook/email').send({ to: 'alice@acme.com', messageId: outbound?.providerId, event: 'bounce' });
    expect(res.status).toBe(200);
    expect(fakeDb.lead.items.get(aliceLeadId)?.status).toBe('bounced');
    expect(fakeDb.message.items.get(outboundMessageId)?.status).toBe('bounced');
  });

  it('PHASE 7d: Webhook ignores unknown email', async () => {
    const res = await request(app).post('/webhook/email').send({ to: 'unknown@nobody.com', subject: 'Hello', event: 'reply' });
    expect(res.body.data.ignored).toBe(true);
  });

  it('PHASE 7e: WhatsApp inbound → queues AI analysis', async () => {
    const queueModule = await import('../queue/index.js');
    const mockAiQueue = queueModule.aiQueue;

    const res = await request(app).post('/webhook/whatsapp').send({
      From: 'whatsapp:+14155550101',
      Body: 'Hi, interested in your product!',
      MessageSid: 'SMwhatsapp001',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(true);

    const whatsInbound = Array.from(fakeDb.message.items.values())
      .filter((m: any) => m.channel === 'whatsapp' && m.direction === 'inbound');
    expect(whatsInbound.length).toBeGreaterThanOrEqual(1);
    expect(mockAiQueue.add).toHaveBeenCalledWith('analyze-intent', { messageId: whatsInbound[0].id });
  });

  // ── PHASE 8: AI SERVICES ──

  it('PHASE 8: AI intent analysis on inbound message', async () => {
    const { analyzeMessageIntent } = await import('../services/ai/index.js');
    const result = await analyzeMessageIntent(inboundMessageId);
    expect(result.category).toBe('interested');
    expect(result.confidence).toBe(92);

    expect(fakeDb.message.items.get(inboundMessageId)?.intentAnalysis).toBeDefined();
    expect(fakeDb.lead.items.get(aliceLeadId)?.intentAnalysis).toBeDefined();
  });

  it('PHASE 8b: AI generates reply draft', async () => {
    const { generateReplyDraft } = await import('../services/ai/index.js');
    const draft = await generateReplyDraft(inboundMessageId, 'professional');
    expect(draft.subject).toBe('Re: Your inquiry');
    expect(fakeDb.message.items.get(inboundMessageId)?.draftReply).toBe(draft.body);
  });

  it('PHASE 8c: AI enriches lead data', async () => {
    const { enrichLeadData } = await import('../services/ai/index.js');
    const result = await enrichLeadData(aliceLeadId);
    expect(result.industry).toBe('Technology');
    expect(fakeDb.lead.items.get(aliceLeadId)?.enrichmentData).toBeDefined();
    expect(fakeDb.lead.items.get(aliceLeadId)?.tags).toContain('saas');
  });

  it('PHASE 8d: AI generates campaign sequence', async () => {
    const { generateCampaignSequence } = await import('../services/ai/index.js');
    const result = await generateCampaignSequence('Follow-up', 'Tech', 'Platform', 'email', 100);
    expect(result.steps).toHaveLength(2);
  });

  // ── PHASE 9: INBOX ──

  it('PHASE 9: List inbound messages in inbox', async () => {
    const res = await request(app).get('/api/inbox?page=1&pageSize=20');
    expect(res.status).toBe(200);
    const inbound = res.body.data.filter((m: any) => m.direction === 'inbound');
    expect(inbound.length).toBeGreaterThanOrEqual(1);
    expect(inbound[0].direction).toBe('inbound');
  });

  it('PHASE 9b: Conversation grouping', async () => {
    const res = await request(app).get('/api/inbox/conversations');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('PHASE 9c: Get full thread for lead', async () => {
    const res = await request(app).get(`/api/inbox/${aliceLeadId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.lead).toBeDefined();
    expect(res.body.data.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('PHASE 9d: Send draft reply from inbox', async () => {
    const res = await request(app).post(`/api/inbox/${inboundMessageId}/send-draft`).send({
      draftBody: 'Thanks for your interest! Let me schedule a demo.',
      draftSubject: 'Re: Your inquiry',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.isAiGenerated).toBe(true);
    expect(res.body.data.status).toBe('queued');
  });

  // ── PHASE 10: EXPORT ──

  it('PHASE 10: Export leads as JSON with field selection', async () => {
    const res = await request(app).post('/api/leads/export').send({
      format: 'json', source: 'manual', fields: ['name', 'email', 'company', 'tags'],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const lead of res.body.data) {
      expect(lead.name).toBeDefined();
      expect(lead.email).toBeDefined();
      expect(lead.source).toBeUndefined();
    }
  });

  it('PHASE 10b: Export leads as CSV', async () => {
    const res = await request(app).post('/api/leads/export').send({ format: 'csv', fields: ['name', 'email', 'company'] });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('name,email,company');
    expect(res.text).toContain('Alice Johnson');
  });

  it('PHASE 10c: Export all leads as JSON', async () => {
    const res = await request(app).post('/api/leads/export').send({ format: 'json' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(6);
  });

  // ── PHASE 11: ANALYTICS ──

  it('PHASE 11: Analytics overview', async () => {
    const res = await request(app).get('/api/analytics/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.totalLeads).toBe(6);
  });

  // ── PHASE 12: CAMPAIGN TEST ──

  it('PHASE 12: Campaign test mode queues send-message job', async () => {
    const queueModule = await import('../queue/index.js');
    const res = await request(app).post(`/api/campaigns/${createdCampaignId}/test`).send({ email: 'test@leadgenius.ai' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('Test');
    expect(queueModule.campaignQueue.add).toHaveBeenCalledWith('send-message', expect.objectContaining({
      campaignId: createdCampaignId, to: 'test@leadgenius.ai',
    }));
  });

  // ── PHASE 13: BULK OPERATIONS ──

  it('PHASE 13: Bulk tag and status operations', async () => {
    const allLeads = Array.from(fakeDb.lead.items.values());
    const ids = allLeads.slice(0, 3).map((l: any) => l.id);

    const tagRes = await request(app).post('/api/leads/bulk-tag').send({ ids, tags: ['simulation', 'e2e'], action: 'add' });
    expect(tagRes.status).toBe(200);
    for (const id of ids) expect(fakeDb.lead.items.get(id)?.tags).toContain('simulation');

    const statusRes = await request(app).post('/api/leads/bulk-status').send({ ids, status: 'archived' });
    expect(statusRes.status).toBe(200);
    for (const id of ids) expect(fakeDb.lead.items.get(id)?.status).toBe('archived');
  });

  // ── PHASE 14: MESSAGES ──

  it('PHASE 14: Messages listing', async () => {
    const res = await request(app).get('/api/messages?page=1&pageSize=10');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);

    const filtered = await request(app).get(`/api/messages?leadId=${aliceLeadId}&page=1&pageSize=10`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.every((m: any) => m.leadId === aliceLeadId)).toBe(true);
  });

  // ── PHASE 15: AGENT SETTINGS ──

  it('PHASE 15: Agent settings CRUD', async () => {
    const getRes = await request(app).get('/api/agent/');
    expect(getRes.status).toBe(200);

    const updateRes = await request(app).put('/api/agent/').send({ tone: 'friendly', isAutoPilotActive: true });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.tone).toBe('friendly');
    expect(updateRes.body.data.isAutoPilotActive).toBe(true);
  });

  // ── PHASE 16: SETTINGS ──

  it('PHASE 16: Settings CRUD', async () => {
    const updateRes = await request(app).put('/api/settings').send({
      fromEmail: 'hello@leadgenius.ai', fromName: 'LeadGenius Team',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.fromEmail).toBe('hello@leadgenius.ai');
  });

  // ── PHASE 17: DATA INTEGRITY CHECK ──

  it('PHASE 17: Final data integrity verification', async () => {
    expect(fakeDb.lead.items.size).toBe(6);
    expect(fakeDb.campaign.items.size).toBe(1);
    expect(fakeDb.template.items.size).toBe(2);
    expect(fakeDb.group.items.size).toBe(1);
    expect(fakeDb.message.items.size).toBeGreaterThanOrEqual(4);

    const allMessages = Array.from(fakeDb.message.items.values());
    expect(allMessages.filter((m: any) => m.direction === 'outbound').length).toBeGreaterThanOrEqual(2);
    expect(allMessages.filter((m: any) => m.direction === 'inbound').length).toBeGreaterThanOrEqual(2);
  });
});
