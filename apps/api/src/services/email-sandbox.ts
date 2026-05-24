import { Router, Request, Response } from 'express';

export interface CapturedEmail {
  id: string;
  to: string;
  from: string;
  fromName: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  providerId: string;
  provider: 'smtp' | 'sendgrid' | 'ethereal' | 'mailtrap';
  receivedAt: Date;
  tags: string[];
}

const captured: CapturedEmail[] = [];
let idCounter = 0;

export function captureEmail(data: {
  to: string; from: string; fromName: string; subject: string;
  html: string; text?: string; headers?: Record<string, string>;
  provider?: 'smtp' | 'sendgrid' | 'ethereal' | 'mailtrap'; tags?: string[];
}): CapturedEmail {
  idCounter++;
  const email: CapturedEmail = {
    id: `sandbox_${idCounter}`,
    to: data.to,
    from: data.from,
    fromName: data.fromName,
    subject: data.subject,
    html: data.html,
    text: data.text || data.html.replace(/<[^>]*>/g, ''),
    headers: data.headers || {},
    providerId: `sbx-${Date.now()}-${idCounter}`,
    provider: data.provider || 'smtp',
    receivedAt: new Date(),
    tags: data.tags || [],
  };
  captured.unshift(email);
  return email;
}

export function getAllEmails(): CapturedEmail[] {
  return captured;
}

export function getEmail(id: string): CapturedEmail | undefined {
  return captured.find((e) => e.id === id);
}

export function clearEmails(): void {
  captured.length = 0;
  idCounter = 0;
}

export function deleteEmail(id: string): boolean {
  const idx = captured.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  captured.splice(idx, 1);
  return true;
}

export function getRouter(): Router {
  const router = Router();

  router.get('/emails', (_req: Request, res: Response) => {
    res.json({ data: captured, meta: { total: captured.length } });
  });

  router.get('/emails/:id', (req: Request, res: Response) => {
    const email = getEmail(req.params.id);
    if (!email) return res.status(404).json({ error: { code: 404, message: 'Email not found' } });
    res.json({ data: email });
  });

  router.get('/emails/:id/raw', (req: Request, res: Response) => {
    const email = getEmail(req.params.id);
    if (!email) return res.status(404).send('Email not found');
    const raw = [
      `From: "${email.fromName}" <${email.from}>`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      `X-Provider-Id: ${email.providerId}`,
      `X-Provider: ${email.provider}`,
      `X-Received: ${email.receivedAt.toISOString()}`,
      '',
      email.text,
    ].join('\n');
    res.set('Content-Type', 'text/plain').send(raw);
  });

  router.delete('/emails', (_req: Request, res: Response) => {
    clearEmails();
    res.json({ data: { cleared: true } });
  });

  router.delete('/emails/:id', (req: Request, res: Response) => {
    if (!deleteEmail(req.params.id)) {
      return res.status(404).json({ error: { code: 404, message: 'Email not found' } });
    }
    res.json({ data: { deleted: true } });
  });

  router.post('/simulate/send', (req: Request, res: Response) => {
    const { to, from, fromName, subject, html, text, provider, tags } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ error: { code: 400, message: 'to and subject required' } });
    }
    const email = captureEmail({
      to,
      from: from || 'sandbox@leadgenius.ai',
      fromName: fromName || 'LeadGenius Sandbox',
      subject,
      html: html || '<p>No content</p>',
      text: text || '',
      provider: provider || 'smtp',
      tags: tags || ['simulated'],
    });
    res.status(201).json({ data: email });
  });

  router.post('/simulate/batch', (req: Request, res: Response) => {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: { code: 400, message: 'emails array required' } });
    }
    const results = emails.map((e: any) => captureEmail({
      to: e.to, from: e.from || 'batch@leadgenius.ai',
      fromName: e.fromName || '', subject: e.subject,
      html: e.html || '', text: e.text || '',
      provider: e.provider || 'smtp',
      tags: e.tags || ['batch'],
    }));
    res.status(201).json({ data: results, meta: { count: results.length } });
  });

  router.get('/dashboard', (_req: Request, res: Response) => {
    const providers = [...new Set(captured.map((e) => e.provider))];
    const rows = captured.map((e) => `
      <tr>
        <td><span class="badge">${esc(e.provider)}</span></td>
        <td>${e.id}</td>
        <td>${esc(e.to)}</td>
        <td>${esc(e.subject)}</td>
        <td>${e.receivedAt.toLocaleString()}</td>
        <td><a href="/api/sandbox/emails/${e.id}">JSON</a> | <a href="/api/sandbox/emails/${e.id}/raw">Raw</a></td>
      </tr>`).join('');

    res.set('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html><head><title>Email Sandbox</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#f5f5f5; color:#333; }
  .header { background:#6366f1; color:#fff; padding:20px 30px; }
  .header h1 { font-size:22px; }
  .header p { opacity:.8; font-size:13px; margin-top:4px; }
  .content { max-width:1100px; margin:20px auto; padding:0 20px; }
  .stats { display:flex; gap:15px; margin-bottom:20px; flex-wrap:wrap; }
  .stat { background:#fff; border-radius:8px; padding:15px 20px; flex:1; min-width:120px; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  .stat .num { font-size:28px; font-weight:700; color:#6366f1; }
  .stat .label { font-size:12px; color:#888; margin-top:2px; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  th { background:#f0f0f0; text-align:left; padding:10px 15px; font-size:12px; color:#666; text-transform:uppercase; }
  td { padding:10px 15px; border-top:1px solid #eee; font-size:13px; }
  tr:hover td { background:#fafaff; }
  a { color:#6366f1; text-decoration:none; }
  .empty { text-align:center; padding:40px; color:#999; }
  .badge { display:inline-block; background:#e0e7ff; color:#4338ca; font-size:11px; padding:2px 8px; border-radius:4px; }
  .actions { margin-bottom:15px; display:flex; gap:10px; }
  .btn { background:#6366f1; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px; }
  .btn:hover { background:#4f46e5; }
  .btn-danger { background:#ef4444; }
  .btn-danger:hover { background:#dc2626; }
  .form-row { display:flex; gap:10px; align-items:end; margin-bottom:10px; flex-wrap:wrap; }
  .form-row label { font-size:12px; color:#888; display:block; margin-bottom:2px; }
  .form-row input { padding:6px 10px; border:1px solid #ddd; border-radius:4px; font-size:13px; }
  .toast { position:fixed; bottom:20px; right:20px; background:#333; color:#fff; padding:10px 20px; border-radius:6px; display:none; }
</style></head><body>
<div class="header"><h1>Email Sandbox</h1>
<p>
  <strong>SMTP Server:</strong> 127.0.0.1:1025 |
  <a href="/api/sandbox/emails" style="color:#fff;text-decoration:underline;">API</a> |
  <a href="#" onclick="clearAll()" style="color:#fff;text-decoration:underline;">Clear All</a>
</p></div>
<div class="content">
  <div class="stats">
    <div class="stat"><div class="num">${captured.length}</div><div class="label">Total Emails</div></div>
    <div class="stat"><div class="num">${new Set(captured.map(e=>e.to)).size}</div><div class="label">Recipients</div></div>
    <div class="stat"><div class="num">${providers.length}</div><div class="label">Providers</div></div>
    <div class="stat"><div class="num">${captured.filter(e => e.provider === 'smtp-captured' || e.tags.includes('smtp-captured')).length}</div><div class="label">Via SMTP</div></div>
  </div>

  <details style="margin-bottom:15px;background:#fff;border-radius:8px;padding:15px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
    <summary style="cursor:pointer;font-weight:600;font-size:14px;">Simulate a test email</summary>
    <div style="margin-top:10px;">
      <div class="form-row"><label>To<input id="sim-to" value="test@example.com"></label>
      <label>Subject<input id="sim-subj" value="Test Email"></label>
      <label>From Name<input id="sim-fname" value="Sandbox"></label>
      <label>Provider<select id="sim-prov"><option>smtp</option><option>sendgrid</option><option>ethereal</option></select></label>
      <button class="btn" onclick="simulateSend()">Send</button></div>
    </div>
  </details>

  ${captured.length === 0
    ? '<div class="empty">No emails captured yet. Send an email via SMTP (port 1025), API, or click "Simulate" above.</div>'
    : `<table><tr><th>Provider</th><th>ID</th><th>To</th><th>Subject</th><th>Time</th><th></th></tr>${rows}</table>`}
</div>
<div id="toast" class="toast"></div>
<script>
async function clearAll() { if(!confirm('Clear all emails?'))return; await fetch('/api/sandbox/emails',{method:'DELETE'}); location.reload(); }
async function simulateSend() {
  const r=await fetch('/api/sandbox/simulate/send',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({to:sim_to.value,subject:sim_subj.value,fromName:sim_fname.value,provider:sim_prov.value})});
  const d=await r.json(); showToast('Captured: '+d.data.id); setTimeout(()=>location.reload(),500);
}
function showToast(m){const t=document.getElementById('toast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',3000);}
</script></body></html>`);
  });

  return router;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
