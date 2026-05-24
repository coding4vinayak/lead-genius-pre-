import { promises as dns } from 'dns';
import { logger } from '../lib/logger.js';

export interface DnsRecord {
  type: string;
  value: string;
}

export interface DeliverabilityReport {
  domain: string;
  hasMx: boolean;
  mxRecords: DnsRecord[];
  spf: { present: boolean; record?: string; issues: string[] };
  dkim: { present: boolean; records: DnsRecord[]; issues: string[] };
  dmarc: { present: boolean; record?: string; issues: string[] };
  blacklisted: boolean;
  blacklistChecks: { name: string; listed: boolean }[];
  score: number;
  summary: string;
}

async function resolveTxt(domain: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(domain);
    return records.map((r) => r.join(''));
  } catch {
    return [];
  }
}

async function resolveMx(domain: string): Promise<string[]> {
  try {
    const records = await dns.resolveMx(domain);
    return records.sort((a, b) => a.priority - b.priority).map((r) => `${r.priority} ${r.exchange}`);
  } catch {
    return [];
  }
}

async function checkBlacklist(ip: string, list: string): Promise<boolean> {
  try {
    const reversed = ip.split('.').reverse().join('.');
    await dns.resolve4(`${reversed}.${list}`);
    return true;
  } catch {
    return false;
  }
}

export async function checkDeliverability(domain: string): Promise<DeliverabilityReport> {
  const issues: string[] = [];

  const mxRecords = await resolveMx(domain);
  const hasMx = mxRecords.length > 0;
  if (!hasMx) issues.push('No MX records found — email delivery will fail');

  const txtRecords = await resolveTxt(domain);

  let spfRecord: string | undefined;
  let dmarcRecord: string | undefined;
  const dkimRecords: string[] = [];
  const spfIssues: string[] = [];
  const dkimIssues: string[] = [];
  const dmarcIssues: string[] = [];

  for (const txt of txtRecords) {
    if (txt.startsWith('v=spf1')) {
      spfRecord = txt;
      if (!txt.includes('~all') && !txt.includes('-all')) {
        spfIssues.push('SPF record missing ~all or -all qualifier');
      }
    }
    if (txt.startsWith('v=DMARC1')) {
      dmarcRecord = txt;
      if (!txt.includes('p=')) dmarcIssues.push('DMARC record missing policy (p=)');
      else if (txt.includes('p=none')) dmarcIssues.push('DMARC policy is p=none — monitoring only, no enforcement');
    }
    if (txt.includes('dkim')) dkimRecords.push(txt);
  }

  if (!spfRecord) spfIssues.push('No SPF record found — recipients may reject or flag as spam');
  if (!dmarcRecord) dmarcIssues.push('No DMARC record found — domain spoofing not protected');
  if (dkimRecords.length === 0) dkimIssues.push('No DKIM records found — email signing not configured');

  const blacklistChecks = await Promise.all(
    ['zen.spamhaus.org', 'bl.spamcop.net', 'dnsbl.sorbs.net', 'b.barracudacentral.org'].map(async (list) => {
      const listed = await checkBlacklist('127.0.0.1' as string, list);
      return { name: list, listed };
    }),
  );

  const totalIssues = spfIssues.length + dkimIssues.length + dmarcIssues.length + (hasMx ? 0 : 1);
  const score = Math.max(0, Math.round(100 - totalIssues * 15));
  const summary =
    score >= 80 ? 'Good deliverability' :
    score >= 50 ? 'Moderate — improvements recommended' :
    'Poor — significant deliverability issues';

  return {
    domain,
    hasMx,
    mxRecords: mxRecords.map((r) => ({ type: 'MX', value: r })),
    spf: { present: !!spfRecord, record: spfRecord, issues: spfIssues },
    dkim: { present: dkimRecords.length > 0, records: dkimRecords.map((r) => ({ type: 'TXT', value: r })), issues: dkimIssues },
    dmarc: { present: !!dmarcRecord, record: dmarcRecord, issues: dmarcIssues },
    blacklisted: blacklistChecks.some((c) => c.listed),
    blacklistChecks,
    score,
    summary,
  };
}

export async function checkLandingPage(url: string): Promise<{
  url: string;
  reachable: boolean;
  statusCode?: number;
  responseTime?: number;
  hasSsl: boolean;
  dnsResolves: boolean;
  ip?: string;
  issues: string[];
}> {
  const issues: string[] = [];
  let hostname: string;

  try {
    hostname = new URL(url).hostname;
  } catch {
    return { url, reachable: false, hasSsl: false, dnsResolves: false, issues: ['Invalid URL'] };
  }

  let ip: string | undefined;
  try {
    const addresses = await dns.resolve4(hostname);
    ip = addresses[0];
  } catch {
    issues.push('DNS resolution failed');
    return { url, reachable: false, hasSsl: false, dnsResolves: false, ip, issues };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'LeadGenius-Deliverability-Checker/1.0' },
    });
    clearTimeout(timeout);

    const responseTime = Date.now() - start;

    const hasSsl = url.startsWith('https');

    return {
      url,
      reachable: res.ok,
      statusCode: res.status,
      responseTime,
      hasSsl,
      dnsResolves: true,
      ip,
      issues,
    };
  } catch (err: any) {
    issues.push(`HTTP request failed: ${err.message}`);
    return { url, reachable: false, hasSsl: url.startsWith('https'), dnsResolves: true, ip, issues };
  }
}
