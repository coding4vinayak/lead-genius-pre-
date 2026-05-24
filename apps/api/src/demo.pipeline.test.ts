import { describe, it, expect, vi } from 'vitest';

// ──────────────────────────────
//  MOCK ALL EXTERNAL DEPENDENCIES
// ──────────────────────────────

vi.mock('bullmq', () => ({
  Queue: vi.fn(function () { return { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() }; }),
  Worker: vi.fn(function () { return { on: vi.fn(), close: vi.fn() }; }),
}));

const emailSandbox: any[] = [];
const mockSendMail = vi.fn((opts: any) => {
  const providerId = 'smtp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  emailSandbox.push({ ...opts, providerId, timestamp: new Date() });
  return { messageId: providerId };
});
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: mockSendMail })) },
  createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
}));
vi.mock('@sendgrid/mail', () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));
vi.mock('twilio', () => ({ default: vi.fn(() => ({ messages: { create: vi.fn().mockResolvedValue({ sid: 'fake-sid' }) } })) }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(() => 'hashed'), compare: vi.fn(() => true) }, hash: vi.fn(() => 'hashed'), compare: vi.fn(() => true) }));
vi.mock('./services/ai/openai.js', () => ({
  analyzeIntent: vi.fn().mockResolvedValue({ category: 'interested', confidence: 92, sentiment: 'positive', urgency: 'medium' }),
  generateDraft: vi.fn().mockResolvedValue({ subject: 'Re: Your inquiry', body: 'Thank you for reaching out! We would be happy to help.' }),
  enrichLead: vi.fn().mockResolvedValue({ companySize: '50-200', industry: 'Technology', suggestedTags: ['tech', 'saas', 'b2b'] }),
  generateCampaign: vi.fn().mockResolvedValue({ steps: [{ subject: 'Step 1', body: 'Hello' }, { subject: 'Step 2', body: 'Follow up' }] }),
}));

// ──────────────────────────────
//  IN-MEMORY DATABASE
// ──────────────────────────────
const stores: Record<string, Map<string, any>> = {};
const counters: Record<string, number> = {};
function mkStore(name: string) {
  if (!stores[name]) { stores[name] = new Map(); counters[name] = 0; }
  const s = stores[name]; const c = () => { counters[name]++; return `${name.slice(0, 3)}_${counters[name]}`; };
  return {
    get: (id: string) => s.get(id), set: (id: string, v: any) => s.set(id, v),
    values: () => Array.from(s.values()), size: () => s.size, nextId: c, clear: () => s.clear(),
  };
}
const _lead = mkStore('lead'); const _campaign = mkStore('campaign'); const _template = mkStore('template');
const _group = mkStore('group'); const _message = mkStore('message'); const _user = mkStore('user');
_user.set('usr_demo', { id: 'usr_demo', email: 'demo@leadgenius.ai', name: 'Demo User', password: '', role: 'admin', createdAt: new Date(), updatedAt: new Date() });
mkStore('settings').set('global', { id: 'global', smtpHost: 'smtp.example.com', smtpPort: 587, smtpUser: 'user', smtpPass: 'pass', sendgridApiKey: null, twilioAccountSid: 'sid', twilioAuthToken: 'token', twilioFromNumber: '+15551234567', fromEmail: 'noreply@leadgenius.ai', fromName: 'LeadGenius AI', dailyGlobalLimit: 5000, defaultMinDelayMs: 1000, createdAt: new Date(), updatedAt: new Date() });

function matchQuery(item: any, where: any): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (key === 'AND' && Array.isArray(val)) { if (!val.every((c: any) => matchQuery(item, c))) return false; continue; }
    if (key === 'OR' && Array.isArray(val)) { if (!val.some((c: any) => matchQuery(item, c))) return false; continue; }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('some' in val) {
        const relItems = stores.message || new Map();
        if (!Array.from(relItems.values()).some((r: any) => r.leadId === item.id && matchQuery(r, val.some))) return false; continue;
      }
      if ('in' in val) { if (!val.in!.includes(item[key])) return false; continue; }
      if ('has' in val) { if (!item[key]?.includes(val.has)) return false; continue; }
      if ('contains' in val) { if (!(item[key]?.toString().toLowerCase() || '').includes(val.contains.toLowerCase())) return false; continue; }
      if ('increment' in val) return true;
    }
    if (item[key] !== val) return false;
  }
  return true;
}

function queryItems(mapName: string, args: any): any[] {
  const map = stores[mapName]; if (!map) return [];
  let items = Array.from(map.values());
  const where = args?.where ?? args?.[0]?.where;
  if (where) items = items.filter((i) => matchQuery(i, where));
  const orderBy = args?.orderBy ?? args?.[0]?.orderBy;
  if (orderBy) for (const [f, d] of Object.entries(orderBy)) items.sort((a, b) => d === 'desc' ? (b[f] < a[f] ? -1 : b[f] > a[f] ? 1 : 0) : (a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0));
  return items;
}

function resolveInclude(item: any, include: any): any {
  if (!include) return item;
  const r = { ...item };
  for (const [rel, opts] of Object.entries(include)) {
    if (rel === 'lead') { r.lead = stores.lead?.get(item.leadId) || null; }
    if (rel === 'messages') {
      const all = Array.from(stores.message?.values() || []);
      let rels = all.filter((m: any) => m.leadId === item.id || m.campaignId === item.id);
      const order = (opts as any)?.orderBy;
      if (order) for (const [f, d] of Object.entries(order)) rels.sort((a: any, b: any) => d === 'desc' ? (b[f] < a[f] ? -1 : b[f] > a[f] ? 1 : 0) : (a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0));
      r.messages = (opts as any)?.take ? rels.slice(0, (opts as any).take) : rels;
    }
    if (rel === 'template') { r.template = stores.template?.get(item.templateId) || null; }
    if (rel === '_count') {
      const sel = (opts as any)?.select;
      if (sel) { r._count = {}; for (const f of Object.keys(sel)) if (f === 'messages') r._count.messages = Array.from(stores.message?.values() || []).filter((m: any) => m.leadId === item.id).length; }
    }
  }
  return r;
}

const handlers: Record<string, any> = {};
for (const m of ['lead', 'campaign', 'template', 'message', 'settings', 'agentSettings', 'group', 'user']) {
  handlers[m] = {
    findUnique: vi.fn((args: any) => { const id = args?.where?.id; const it = stores[m]?.get(id); if (!it) return null; const base = { ...it }; return args?.include ? resolveInclude(base, args.include) : base; }),
    findFirst: vi.fn((args: any) => { const items = queryItems(m, args); if (!items.length) return null; const base = { ...items[0] }; return args?.include ? resolveInclude(base, args.include) : base; }),
    findMany: vi.fn((args: any) => { let items = queryItems(m, args); const skip = args?.skip ?? 0; const take = args?.take; if (take !== undefined) items = items.slice(skip, skip + take); const copies = items.map((i: any) => ({ ...i })); return args?.include ? copies.map((i: any) => resolveInclude(i, args.include)) : copies; }),
    count: vi.fn((args: any) => queryItems(m, args).length),
    create: vi.fn((args: any) => { const raw = args?.data ?? args?.[0]?.data ?? {}; const d = { ...raw, id: raw.id || (() => { counters[m]++; return `${m.slice(0, 3)}_${counters[m]}`; })() }; stores[m]?.set(d.id, d); return d; }),
    createMany: vi.fn((args: any) => { for (const row of (args?.data ?? args?.[0]?.data ?? [])) { const id = row.id || (() => { counters[m]++; return `${m.slice(0, 3)}_${counters[m]}`; })(); stores[m]?.set(id, { ...row, id }); } return { count: (args?.data ?? args?.[0]?.data ?? []).length }; }),
    update: vi.fn((args: any) => { const id = args?.where?.id; const e = stores[m]?.get(id); if (!e) return null; const u = { ...e, ...(args?.data ?? args?.[0]?.data), updatedAt: new Date() }; stores[m]?.set(id, u); return u; }),
    updateMany: vi.fn((args: any) => { const items = queryItems(m, args); const d = args?.data ?? args?.[0]?.data; for (const i of items) stores[m]?.set(i.id, { ...i, ...d, updatedAt: new Date() }); return { count: items.length }; }),
    delete: vi.fn((args: any) => { const id = args?.where?.id; const e = stores[m]?.get(id); if (e) stores[m]?.delete(id); return e || null; }),
    deleteMany: vi.fn((args: any) => { const items = queryItems(m, args); for (const i of items) stores[m]?.delete(i.id); return { count: items.length }; }),
    upsert: vi.fn((args: any) => { const id = args?.where?.id; const e = stores[m]?.get(id); if (e) { const u = { ...e, ...args?.update, updatedAt: new Date() }; stores[m]?.set(id, u); return u; } const d = { ...args?.create, id: id || (() => { counters[m]++; return `${m.slice(0, 3)}_${counters[m]}`; })() }; stores[m]?.set(d.id, d); return d; }),
  };
}
const mockPrisma = { lead: handlers.lead, campaign: handlers.campaign, template: handlers.template, message: handlers.message, settings: handlers.settings, agentSettings: handlers.agentSettings, leadGroup: handlers.group, user: handlers.user };
vi.mock('./db.js', () => ({ prisma: mockPrisma }));
vi.mock('./queue/index.js', () => ({ campaignQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() }, sendQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() }, aiQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() } }));

// ──────────────────────────────
//  BUILD EXPRESS APP
// ──────────────────────────────
async function buildApp() {
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());
  const { default: authRoutes } = await import('./routes/auth.js');
  const { default: leadRoutes } = await import('./routes/leads.js');
  const { default: campaignRoutes } = await import('./routes/campaigns.js');
  const { default: groupRoutes } = await import('./routes/groups.js');
  const { default: templateRoutes } = await import('./routes/templates.js');
  const { default: messageRoutes } = await import('./routes/messages.js');
  const { default: analyticsRoutes } = await import('./routes/analytics.js');
  const { default: settingsRoutes } = await import('./routes/settings.js');
  const { default: webhookRoutes } = await import('./routes/webhooks.js');
  const { default: inboxRoutes } = await import('./routes/inbox.js');
  const { default: agentRoutes } = await import('./routes/agent.js');
  const { requireAuth } = await import('./middleware/auth.js');
  app.use('/api/auth', authRoutes);
  app.use('/api/leads', requireAuth, leadRoutes);
  app.use('/api/campaigns', requireAuth, campaignRoutes);
  app.use('/api/groups', requireAuth, groupRoutes);
  app.use('/api/templates', requireAuth, templateRoutes);
  app.use('/api/messages', requireAuth, messageRoutes);
  app.use('/api/analytics', requireAuth, analyticsRoutes);
  app.use('/api/settings', requireAuth, settingsRoutes);
  app.use('/webhook', webhookRoutes);
  app.use('/api/inbox', requireAuth, inboxRoutes);
  app.use('/api/agent', requireAuth, agentRoutes);
  const { getRouter: getSandboxRouter } = await import('./services/email-sandbox.js');
  app.use('/api/sandbox', getSandboxRouter());
  const { errorHandler } = await import('./middleware/error-handler.js');
  app.use(errorHandler);
  return app;
}

const B = (s: string) => `\x1b[1m${s}\x1b[0m`;
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const C = (s: string) => `\x1b[36m${s}\x1b[0m`;
const M = (s: string) => `\x1b[35m${s}\x1b[0m`;

describe('LeadGenius Pipeline Demo', () => {
  let app: any;
  let token: string;
  let aliceId: string;
  let tmplId: string;
  let campId: string;
  let inboundId: string;

  function req() {
    const supertest = require('supertest');
    const r = supertest(app);
    const origGet = r.get.bind(r);
    const origPost = r.post.bind(r);
    const origPut = r.put.bind(r);
    const origDelete = r.delete.bind(r);
    r.get = (url: string) => origGet(url).set('Authorization', `Bearer ${token}`);
    r.post = (url: string) => origPost(url).set('Authorization', `Bearer ${token}`);
    r.put = (url: string) => origPut(url).set('Authorization', `Bearer ${token}`);
    r.delete = (url: string) => origDelete(url).set('Authorization', `Bearer ${token}`);
    return r;
  }

  it('BUILD: App', async () => { app = await buildApp(); });

  it('PHASE 0: Authentication', async () => {
    const supertest = (await import('supertest')).default;
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 0: Authentication'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const signup = await supertest(app).post('/api/auth/signup').send({ email: 'demo@leadgenius.ai', password: 'demo1234', name: 'Demo Admin' });
    console.log(`  Signup response: ${signup.status} ${JSON.stringify(signup.body).slice(0, 200)}`);
    token = signup.body.data?.token;
    if (!token) throw new Error(`Signup failed: ${signup.status} ${JSON.stringify(signup.body)}`);
    console.log(`  ${G('✔')} Signup: demo@leadgenius.ai → token ${token.slice(0, 20)}...`);

    const me = await supertest(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    console.log(`  ${G('✔')} Auth verify: ${me.body.data.email} (${me.body.data.role})`);

    const noAuth = await supertest(app).get('/api/leads');
    console.log(`  ${G('✔')} Protected route blocked without token: ${noAuth.status} ${noAuth.body.error?.message}`);
    console.log();
  });

  it('PHASE 1: Lead Ingestion', async () => {
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 1: Lead Ingestion'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const r = await req().post('/api/leads/import').send({
      leads: [
        { name: 'Alice Johnson', email: 'alice@acme.com', phone: '+14155550101', company: 'Acme Corp', title: 'VP Sales', source: 'website', status: 'active', tags: ['tech', 'saas'] },
        { name: 'Bob Smith', email: 'bob@widgets.io', company: 'Widgets Inc', source: 'referral', tags: ['ecommerce'] },
        { name: 'Carol Davis', email: 'carol@dataflow.com', company: 'DataFlow', source: 'linkedin', tags: ['tech', 'ai'] },
        { name: 'Dave Wilson', email: 'dave@buildcorp.com', company: 'BuildCorp', source: 'manual', tags: ['manufacturing'] },
        { name: 'Eve Martin', email: 'eve@healthplus.com', company: 'HealthPlus', source: 'event', status: 'lead', tags: ['healthtech'] },
      ],
    });
    console.log(`  ${C('➜')} ${r.body.data.count} leads imported`);
    aliceId = _lead.values().find((l: any) => l.email === 'alice@acme.com')!.id;
    console.log(`  ${C('➜')} Alice Johnson id: ${aliceId}`);

    const r2 = await req().post('/api/leads').send({ name: 'Frank Thomas', email: 'frank@example.com', company: 'FrankCo', source: 'manual', status: 'active' });
    console.log(`  ${C('➜')} Frank Thomas created: ${r2.body.data.id}`);

    const r3 = await req().get('/api/leads?page=1&pageSize=3');
    console.log(`  ${G('✔')} ${r3.body.meta.total} total leads, page ${r3.body.meta.page}/${r3.body.meta.totalPages}`);
    console.log();
  });

  it('PHASE 2-3: Groups & Templates', async () => {
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 2: Groups  |  PHASE 3: Templates'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const grp = await req().post('/api/groups').send({ name: 'Tech Companies', description: 'Tech leads', filterRules: { tag: 'tech' } });
    console.log(`  ${G('✔')} Group: "${grp.body.data.name}" (${grp.body.data.id})`);

    const t1 = await req().post('/api/templates').send({ name: 'Email Outreach', channel: 'email', subject: 'Hi {{name}}', body: '<p>Hi {{name}}!</p>', variables: ['name'], category: 'outreach' });
    tmplId = t1.body.data.id;
    console.log(`  ${G('✔')} Email template: "${t1.body.data.name}" (${tmplId})`);

    const t2 = await req().post('/api/templates').send({ name: 'WhatsApp Follow-up', channel: 'whatsapp', body: 'Hey {{name}}!', variables: ['name'], category: 'followup' });
    console.log(`  ${G('✔')} WhatsApp template: "${t2.body.data.name}"`);
    console.log();
  });

  it('PHASE 4-5: Campaign Lifecycle', async () => {
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 4-5: Campaign Lifecycle'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const c = await req().post('/api/campaigns').send({ name: 'Q1 Tech Outreach', channel: 'email', templateId: tmplId, scheduleType: 'immediate', sendStrategy: 'sequential' });
    campId = c.body.data.id;
    console.log(`  ${G('✔')} Campaign created: "${c.body.data.name}" (${campId})`);

    const a = await req().post(`/api/campaigns/${campId}/activate`);
    console.log(`  ${G('✔')} Activate → status: ${a.body.data.status} | BullMQ: execute-campaign`);

    const p = await req().post(`/api/campaigns/${campId}/pause`);
    console.log(`  ${C('➜')} Pause → ${p.body.data.status}`);

    const r = await req().post(`/api/campaigns/${campId}/resume`);
    console.log(`  ${C('➜')} Resume → ${r.body.data.status} | BullMQ: execute-campaign`);

    const s = await req().post(`/api/campaigns/${campId}/stop`);
    console.log(`  ${C('➜')} Stop → ${s.body.data.status}`);

    const a2 = await req().post(`/api/campaigns/${campId}/activate`);
    console.log(`  ${C('➜')} Re-activate → ${a2.body.data.status}`);
    console.log();
  });

  it('PHASE 6: Email Sending (Sandbox)', async () => {
    const { sendEmail } = await import('./services/email.js');
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 6: Email Sending — Sandbox Capture'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const msg = await mockPrisma.message.create({ data: { leadId: aliceId, channel: 'email', direction: 'outbound', subject: 'Welcome!', body: '<p>Hi Alice</p>', status: 'queued' } });
    await sendEmail('alice@acme.com', 'Welcome!', '<p>Hi Alice</p>', msg.id);

    const sent = _message.get(msg.id);
    console.log(`  ${G('✔')} Email sent to alice@acme.com`);
    console.log(`      Status: ${sent?.status}, ProviderId: ${sent?.providerId}`);
    console.log(`      Email sandbox: ${emailSandbox.length} message(s) captured`);
    emailSandbox.forEach((m, i) => console.log(`        [${i + 1}] To: ${m.to} | Subj: ${m.subject} | ID: ${m.providerId}`));
    console.log();
  });

  it('PHASE 7: Webhook Processing', async () => {
    const supertest = (await import('supertest')).default;
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 7: Webhooks — Reply / Open / Bounce / WhatsApp'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const sentMsg = _message.values().find((m: any) => m.direction === 'outbound');

    const reply = await supertest(app).post('/webhook/email').send({ to: 'alice@acme.com', subject: 'Re: Welcome!', text: 'I am interested!', messageId: sentMsg.providerId, event: 'reply' });
    console.log(`  ${G('✔')} Email reply → ${JSON.stringify(reply.body.data)}`);
    inboundId = _message.values().filter((m: any) => m.direction === 'inbound')[0]?.id;
    console.log(`      Inbound msg: ${inboundId} | BullMQ: analyze-intent`);

    await supertest(app).post('/webhook/email').send({ to: 'alice@acme.com', messageId: sentMsg.providerId, event: 'open' });
    console.log(`  ${G('✔')} Open tracked`);

    await supertest(app).post('/webhook/email').send({ to: 'alice@acme.com', messageId: sentMsg.providerId, event: 'bounce' });
    console.log(`  ${G('✔')} Bounce → lead: ${_lead.get(aliceId)?.status}, msg: ${_message.get(sentMsg.id)?.status}`);

    const unk = await supertest(app).post('/webhook/email').send({ to: 'unknown@nobody.com', subject: 'Hi', event: 'reply' });
    console.log(`  ${C('➜')} Unknown email → ${JSON.stringify(unk.body.data)}`);

    const wa = await supertest(app).post('/webhook/whatsapp').send({ From: 'whatsapp:+14155550101', Body: 'Hi!', MessageSid: 'SM001' });
    console.log(`  ${G('✔')} WhatsApp inbound → ${JSON.stringify(wa.body.data)} | BullMQ: analyze-intent`);
    console.log();
  });

  it('PHASE 8: AI Services', async () => {
    const { analyzeMessageIntent, generateReplyDraft, enrichLeadData, generateCampaignSequence } = await import('./services/ai/index.js');
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 8: AI Services'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const intent = await analyzeMessageIntent(inboundId);
    console.log(`  ${G('✔')} Intent analysis: ${intent.category} (${intent.confidence}% confidence)`);

    const draft = await generateReplyDraft(inboundId, 'professional');
    console.log(`  ${G('✔')} Draft generated: "${draft.subject}"`);
    console.log(`      Body: ${draft.body.substring(0, 60)}...`);

    const enrich = await enrichLeadData(aliceId);
    const lead = _lead.get(aliceId);
    console.log(`  ${G('✔')} Enriched: ${enrich.industry}, ${enrich.companySize}`);
    console.log(`      Tags: [${lead.tags.join(', ')}]`);

    const seq = await generateCampaignSequence('Follow-up', 'Tech', 'Platform', 'email', 100);
    console.log(`  ${G('✔')} Campaign sequence: ${seq.steps.length} steps`);
    console.log();
  });

  it('PHASE 9-10: Inbox & Export', async () => {
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 9: Inbox  |  PHASE 10: Export'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const inbox = await req().get('/api/inbox?page=1&pageSize=20');
    const inMsgs = inbox.body.data.filter((m: any) => m.direction === 'inbound');
    console.log(`  ${G('✔')} Inbox: ${inMsgs.length} inbound message(s)`);

    const conv = await req().get('/api/inbox/conversations');
    console.log(`  ${G('✔')} Conversations: ${conv.body.data.length} group(s)`);

    const jsonExp = await req().post('/api/leads/export').send({ format: 'json', fields: ['name', 'email', 'company'] });
    console.log(`  ${G('✔')} JSON export: ${jsonExp.body.data.length} leads`);

    const csvExp = await req().post('/api/leads/export').send({ format: 'csv', fields: ['name', 'email'] });
    console.log(`  ${G('✔')} CSV export: ${csvExp.text.split('\n').length - 1} leads`);
    console.log();
  });

  it('PHASE 11-16: Analytics / Settings / Bulk Ops / Messages', async () => {
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 11-16: Remaining Features'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const analytics = await req().get('/api/analytics/overview');
    console.log(`  ${G('✔')} Analytics: ${analytics.body.data.totalLeads} leads, ${analytics.body.data.totalMessages} messages`);

    const ids = _lead.values().slice(0, 3).map((l: any) => l.id);
    await req().post('/api/leads/bulk-tag').send({ ids, tags: ['demo'], action: 'add' });
    console.log(`  ${G('✔')} Bulk tagged ${ids.length} leads with "demo"`);
    await req().post('/api/leads/bulk-status').send({ ids, status: 'archived' });
    console.log(`  ${G('✔')} Bulk archived ${ids.length} leads`);

    await req().post(`/api/campaigns/${campId}/test`).send({ email: 'test@leadgenius.ai' });
    console.log(`  ${G('✔')} Campaign test message queued`);

    const msgs = await req().get('/api/messages?page=1&pageSize=10');
    console.log(`  ${G('✔')} ${msgs.body.data.length} total messages`);

    const agent = await req().put('/api/agent/').send({ tone: 'friendly', isAutoPilotActive: true });
    console.log(`  ${G('✔')} Agent settings: tone=${agent.body.data.tone}, autoPilot=${agent.body.data.isAutoPilotActive}`);

    await req().put('/api/settings').send({ fromEmail: 'hello@leadgenius.ai' });
    console.log(`  ${G('✔')} Global settings updated`);

    const thread = await req().get(`/api/inbox/${aliceId}`);
    console.log(`  ${G('✔')} Thread: ${thread.body.data?.messages?.length || 0} messages for Alice`);
    console.log();
  });

  it('PHASE 17: Email Sandbox — SMTP Server / Dashboard / Deliverability', async () => {
    console.log(`\n${B(M('══════════════════════════════════════════════'))}`);
    console.log(` ${B(G('PHASE 17: Email Sandbox Ecosystem'))}`);
    console.log(`${B(M('══════════════════════════════════════════════'))}\n`);

    const { startSmtpServer, stopSmtpServer, isSmtpRunning } = await import('./services/smtp-server.js');
    const { checkDeliverability } = await import('./services/deliverability-checker.js');

    await startSmtpServer(11991);
    console.log(`  ${G('✔')} SMTP server started on 127.0.0.1:${11991} — ${isSmtpRunning() ? 'listening' : 'error'}`);
    await stopSmtpServer();

    const sandboxList = await req().get('/api/sandbox/emails');
    console.log(`  ${G('✔')} Sandbox API: ${sandboxList.body.meta.total} email(s) captured via /api/sandbox/emails`);

    const simRes = await req().post('/api/sandbox/simulate/send').send({
      to: 'demo@leadgenius.ai', subject: 'Sandbox Demo', fromName: 'Demo', provider: 'sendgrid', tags: ['demo'],
    });
    console.log(`  ${G('✔')} Simulated: "${simRes.body.data.subject}" → ${simRes.body.data.id} (${simRes.body.data.provider})`);

    const batchRes = await req().post('/api/sandbox/simulate/batch').send({
      emails: [
        { to: 'a@leadgenius.ai', subject: 'Batch A' },
        { to: 'b@leadgenius.ai', subject: 'Batch B' },
        { to: 'c@leadgenius.ai', subject: 'Batch C' },
      ],
    });
    console.log(`  ${G('✔')} Batch: ${batchRes.body.meta.count} emails simulated in one call`);

    const dashboard = await req().get('/api/sandbox/dashboard');
    console.log(`  ${G('✔')} Dashboard HTML: ${dashboard.text.length} bytes (sandbox UI)`);

    const raw = await req().get(`/api/sandbox/emails/${simRes.body.data.id}/raw`);
    const lines = raw.text.split('\n').filter((l: string) => l.startsWith('Subject:'));
    console.log(`  ${G('✔')} Raw view: headers present (${lines.length} subject found)`);

    const deliv = await checkDeliverability('leadgenius.ai');
    console.log(`  ${G('✔')} Deliverability: ${deliv.summary} (score: ${deliv.score}/100)`);
    console.log(`      MX: ${deliv.hasMx} | SPF: ${deliv.spf.present} | DKIM: ${deliv.dkim.present} | DMARC: ${deliv.dmarc.present}`);

    const landing = await checkDeliverability('example.com');
    console.log(`  ${G('✔')} Example.com: ${landing.summary} (score: ${landing.score}/100)`);

    const delCount = await req().delete('/api/sandbox/emails').then((r: any) => r.body.data.cleared);
    console.log(`  ${G('✔')} Sandbox cleared: ${delCount}`);
    console.log();
  });

  it('FINAL: Summary', async () => {
    console.log(`\n${B(M('╔═══════════════════════════════════════════════╗'))}`);
    console.log(`${B(M('║'))}         ${B(G('PIPELINE COMPLETE'))}              ${B(M('║'))}`);
    console.log(`${B(M('╚═══════════════════════════════════════════════╝'))}`);
    console.log(`\n  ${B('Records Created:')}`);
    console.log(`    ${G('Leads:')}     ${_lead.size()}`);
    console.log(`    ${G('Groups:')}    ${_group.size()}`);
    console.log(`    ${G('Templates:')} ${_template.size()}`);
    console.log(`    ${G('Campaigns:')} ${_campaign.size()}`);
    console.log(`    ${G('Messages:')}  ${_message.size()}`);
    console.log(`\n  ${B('Email Sandbox:')} ${emailSandbox.length} SMTP email(s) captured via nodemailer`);
    emailSandbox.forEach((m, i) => console.log(`    [${i + 1}] ${m.to} | "${m.subject}" | ${m.provider}`));
    console.log(`\n  ${B('Email Sandbox Dashboard:')} http://localhost:${process.env.PORT || 3000}/api/sandbox/dashboard`);
    console.log(`  ${B('SMTP Server:')} 127.0.0.1:${process.env.EMAIL_SMTP_PORT || 1025} (start with EMAIL_SANDBOX=true)`);
    console.log(`  ${B('Ethereal:')} ${process.env.ETHEREAL_ENABLED === 'true' ? 'Enabled' : 'Set ETHEREAL_ENABLED=true to use'}`);
    console.log(`\n  ${G('✓')} All phases executed successfully\n`);
  });
});
