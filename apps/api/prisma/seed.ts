import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANIES = [
  { name: 'Acme Corp', domain: 'acme.com', industry: 'tech' },
  { name: 'Globex Inc', domain: 'globex.com', industry: 'finance' },
  { name: 'Initech', domain: 'initech.com', industry: 'tech' },
  { name: 'Massive Dynamic', domain: 'massive-dynamic.com', industry: 'biotech' },
  { name: 'Wayne Enterprises', domain: 'wayne.com', industry: 'manufacturing' },
  { name: 'Stark Industries', domain: 'stark.com', industry: 'defense' },
  { name: 'Cyberdyne Systems', domain: 'cyberdyne.com', industry: 'ai' },
  { name: 'Soylent Corp', domain: 'soylent.com', industry: 'food' },
  { name: 'Wonka Industries', domain: 'wonka.com', industry: 'food' },
  { name: 'Hooli', domain: 'hooli.com', industry: 'tech' },
  { name: 'Pied Piper', domain: 'piedpiper.com', industry: 'tech' },
  { name: 'Dunder Mifflin', domain: 'dundermifflin.com', industry: 'paper' },
  { name: 'Sterling Cooper', domain: 'sterlingcooper.com', industry: 'advertising' },
  { name: 'Los Pollos Hermanos', domain: 'lospollos.com', industry: 'food' },
  { name: 'Vandelay Industries', domain: 'vandelay.com', industry: 'import-export' },
];

const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Ruth', 'Sam', 'Tina', 'Uma', 'Victor', 'Wendy', 'Xander', 'Yara', 'Zack'];
const LAST_NAMES = ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Moore', 'Allen', 'Scott'];

const TAGS = ['tech', 'saas', 'finance', 'enterprise', 'startup', 'healthcare', 'ecommerce', 'manufacturing', 'biotech', 'ai', 'warm-lead', 'hot-lead', 'cold-outreach', 'conference-2026', 'webinar-signup', 'trial-user', 'partner', 'vip'];
const SOURCES = ['website', 'referral', 'linkedin', 'conference', 'webinar', 'cold-outreach', 'partner', 'advertisement', 'trial-signup'];
const STATUSES: Array<'active' | 'unsubscribed' | 'bounced' | 'invalid'> = ['active', 'active', 'active', 'active', 'unsubscribed', 'bounced', 'invalid'];
const TEMPLATE_CATEGORIES = ['onboarding', 'follow-up', 're-engagement', 'newsletter', 'meeting-request', 'product-update', 'case-study'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysAgo));
  return d;
}

function generateEmail(name: string, domain: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '.')}@${domain}`;
}

async function main() {
  const existingUser = await prisma.user.findUnique({ where: { email: 'admin@leadgenius.ai' } });
  if (!existingUser) {
    const bcrypt = await import('bcryptjs');
    await prisma.user.create({
      data: { email: 'admin@leadgenius.ai', name: 'Admin', password: await bcrypt.hash('admin1234', 12), role: 'admin' },
    });
    console.log('Admin user created (admin@leadgenius.ai / admin1234).');
  }

  const existingSettings = await prisma.settings.findUnique({ where: { id: 'global' } });
  if (!existingSettings) {
    await prisma.settings.create({
      data: { fromEmail: 'hello@leadgenius.ai', fromName: 'LeadGenius', dailyGlobalLimit: 500, defaultMinDelayMs: 30000 },
    });
    console.log('Default settings created.');
  }

  const leadCount = await prisma.lead.count();
  if (leadCount === 0) {
    const leads = [];
    for (let i = 0; i < 50; i++) {
      const company = pick(COMPANIES);
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const name = `${firstName} ${lastName}`;
      const score = Math.random() > 0.6 ? randomInt(0, 100) : null;
      leads.push({
        email: generateEmail(`${firstName}${lastName}`, company.domain),
        name,
        phone: `+1${String(randomInt(200, 999))}${String(randomInt(100, 999))}${String(randomInt(1000, 9999))}`,
        company: company.name,
        title: pick(['CEO', 'CTO', 'VP Engineering', 'Head of Product', 'Director of Sales', 'Founder', 'Engineering Manager', 'Product Manager', 'Marketing Director', 'Data Scientist']),
        source: pick(SOURCES),
        status: pick(STATUSES),
        tags: [pick(TAGS), Math.random() > 0.5 ? pick(TAGS) : ''].filter(Boolean),
        score,
        customFields: Math.random() > 0.5 ? { industry: company.industry, employees: randomInt(10, 5000) } : undefined,
        lastContactedAt: Math.random() > 0.5 ? randomDate(90) : undefined,
        createdAt: randomDate(180),
      });
    }
    await prisma.lead.createMany({ data: leads });
    console.log(`50 seed leads created.`);

    const allLeads = await prisma.lead.findMany();
    const groups = [
      { name: 'Tech Leaders', description: 'CEOs and CTOs from tech companies', filterRules: { tags: ['tech'] } },
      { name: 'Enterprise Accounts', description: 'Companies with 500+ employees', filterRules: { score: { gte: 70 } } },
      { name: 'Warm Prospects', description: 'Recently engaged leads with high scores', filterRules: { status: 'active', score: { gte: 50 } } },
      { name: 'Conference 2026', description: 'Leads from the 2026 conference circuit', filterRules: { source: 'conference' } },
      { name: 'Newsletter Subscribers', description: 'Leads from website signups', filterRules: { source: 'website' } },
    ];
    for (const group of groups) {
      const created = await prisma.leadGroup.create({ data: group });
      const members = allLeads.filter(() => Math.random() > 0.6).slice(0, randomInt(3, 10));
      if (members.length > 0) {
        await prisma.groupMember.createMany({
          data: members.map((l) => ({ leadId: l.id, groupId: created.id })),
          skipDuplicates: true,
        });
      }
    }
    console.log('5 groups created with members.');
  }

  const templateCount = await prisma.template.count();
  if (templateCount === 0) {
    const templates = [
      { name: 'Welcome Email', channel: 'email' as const, subject: 'Welcome to LeadGenius!', body: '<h1>Welcome {{name}}!</h1><p>We are thrilled to have you on board. Here is what you can expect...</p>', variables: ['name'], category: 'onboarding' },
      { name: 'Follow-up Sequence A', channel: 'email' as const, subject: 'Following up', body: '<p>Hi {{name}},</p><p>I wanted to follow up on our conversation last week. Are you available for a quick call?</p>', variables: ['name'], category: 'follow-up' },
      { name: 'Re-engagement Campaign', channel: 'email' as const, subject: 'We miss you, {{name}}!', body: '<p>Hi {{name}},</p><p>It has been a while since we last connected. Here is what you missed...</p>', variables: ['name'], category: 're-engagement' },
      { name: 'Monthly Newsletter', channel: 'email' as const, subject: 'Your Monthly Update - {{month}}', body: '<div style="font-family:sans-serif"><h2>{{title}}</h2><p>{{content}}</p></div>', variables: ['month', 'title', 'content'], category: 'newsletter' },
      { name: 'Meeting Request', channel: 'email' as const, subject: 'Quick chat about {{topic}}?', body: '<p>Hi {{name}},</p><p>Would you have 15 minutes this week to discuss {{topic}}?</p>', variables: ['name', 'topic'], category: 'meeting-request' },
      { name: 'Product Update v2.0', channel: 'email' as const, subject: 'Big news: v2.0 is here!', body: '<p>Hi {{name}},</p><p>We just shipped v2.0 with exciting new features...</p><ul>{{features}}</ul>', variables: ['name', 'features'], category: 'product-update' },
      { name: 'WhatsApp Welcome', channel: 'whatsapp' as const, subject: null, body: 'Hi {{name}}! Welcome to LeadGenius 🎉 Reply STOP to opt out.', variables: ['name'], category: 'onboarding' },
      { name: 'WhatsApp Follow-up', channel: 'whatsapp' as const, subject: null, body: 'Hey {{name}}, just checking in. Would you like to schedule a demo?', variables: ['name'], category: 'follow-up' },
    ];
    for (const t of templates) {
      await prisma.template.create({ data: t });
    }
    console.log('8 templates created.');
  }

  const campaignCount = await prisma.campaign.count();
  if (campaignCount === 0) {
    const template = await prisma.template.findFirst({ where: { channel: 'email' } });
    const groups = await prisma.leadGroup.findMany({ take: 2 });
    if (template) {
      await prisma.campaign.create({
        data: {
          name: 'Q2 Outreach Blast',
          description: 'Mass outreach to all tech leads for Q2 product launch',
          status: 'running',
          channel: 'email',
          templateId: template.id,
          leadGroupIds: groups.map((g) => g.id),
          sendStrategy: 'sequential',
          dailyLimit: 100,
          minDelayMs: 60000,
          sentCount: 24,
          failedCount: 2,
          replyCount: 3,
          openedCount: 15,
          createdAt: randomDate(30),
        },
      });
      await prisma.campaign.create({
        data: {
          name: 'Onboarding Series',
          description: 'Automated onboarding for new trial signups',
          status: 'running',
          channel: 'email',
          templateId: template.id,
          leadGroupIds: [],
          scheduleType: 'recurring',
          sendStrategy: 'sequential',
          dailyLimit: 50,
          minDelayMs: 120000,
          sentCount: 156,
          failedCount: 5,
          replyCount: 12,
          openedCount: 89,
          createdAt: randomDate(60),
        },
      });
      await prisma.campaign.create({
        data: {
          name: 'Conference Follow-ups',
          description: 'Follow-up sequence for 2026 conference leads',
          status: 'completed',
          channel: 'email',
          templateId: template.id,
          leadGroupIds: [],
          sendStrategy: 'burst',
          sentCount: 200,
          failedCount: 8,
          replyCount: 25,
          openedCount: 145,
          createdAt: randomDate(90),
        },
      });
      console.log('3 campaigns created.');
    }
  }

  const messageCount = await prisma.message.count();
  if (messageCount === 0) {
    const leads = await prisma.lead.findMany({ take: 20 });
    const campaigns = await prisma.campaign.findMany();
    for (let i = 0; i < 30; i++) {
      const lead = pick(leads);
      const campaign = Math.random() > 0.3 ? pick(campaigns) : undefined;
      const direction = Math.random() > 0.7 ? 'inbound' : 'outbound';
      const msg = await prisma.message.create({
        data: {
          leadId: lead.id,
          campaignId: campaign?.id,
          channel: 'email',
          direction: direction as any,
          subject: direction === 'outbound' ? pick(['Welcome!', 'Follow-up', 'Quick question', 'Great news!']) : 'Re: Your email',
          body: direction === 'outbound'
            ? `<p>Hi ${lead.name}, thanks for your interest!</p>`
            : `<p>Thanks for reaching out! I would love to learn more.</p>`,
          status: direction === 'inbound' ? 'replied' : pick(['sent', 'delivered', 'failed']),
          isAiGenerated: Math.random() > 0.8,
          createdAt: randomDate(60),
          deliveredAt: Math.random() > 0.2 ? randomDate(30) : undefined,
        },
      });
      if (direction === 'inbound') {
        await prisma.message.update({
          where: { id: msg.id },
          data: { intentAnalysis: { category: pick(['interested', 'pricing_question', 'feature_question', 'meeting_request']), confidence: randomInt(60, 98), sentiment: pick(['positive', 'neutral']), urgency: pick(['low', 'medium', 'high']) } },
        });
      }
    }
    console.log('30 sample messages created.');
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
