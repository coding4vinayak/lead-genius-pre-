export interface DomainLookupResult {
  company: string;
  domain: string;
  isPersonalEmail: boolean;
  industry?: string;
}

const PERSONAL_EMAIL_DOMAINS: Record<string, boolean> = {
  'gmail.com': true,
  'yahoo.com': true,
  'hotmail.com': true,
  'outlook.com': true,
  'aol.com': true,
  'icloud.com': true,
  'mail.com': true,
  'protonmail.com': true,
  'zoho.com': true,
  'yandex.com': true,
  'live.com': true,
  'msn.com': true,
  'me.com': true,
  'gmx.com': true,
};

const KNOWN_DOMAINS: Record<string, { company: string; industry: string }> = {
  'google.com': { company: 'Google', industry: 'technology' },
  'microsoft.com': { company: 'Microsoft', industry: 'technology' },
  'apple.com': { company: 'Apple', industry: 'technology' },
  'amazon.com': { company: 'Amazon', industry: 'e-commerce' },
  'facebook.com': { company: 'Facebook', industry: 'social media' },
  'meta.com': { company: 'Meta', industry: 'social media' },
  'salesforce.com': { company: 'Salesforce', industry: 'saas' },
  'hubspot.com': { company: 'HubSpot', industry: 'marketing' },
  'stripe.com': { company: 'Stripe', industry: 'fintech' },
  'slack.com': { company: 'Slack', industry: 'technology' },
};

export function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  return parts[1].toLowerCase();
}

export function inferCompanyFromDomain(domain: string): string {
  const known = KNOWN_DOMAINS[domain];
  if (known) return known.company;

  const name = domain.split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function isPersonalEmail(domain: string): boolean {
  return !!PERSONAL_EMAIL_DOMAINS[domain];
}

export function domainLookup(email: string): DomainLookupResult | null {
  const domain = extractDomain(email);
  if (!domain) return null;

  const personal = isPersonalEmail(domain);
  const known = KNOWN_DOMAINS[domain];

  return {
    company: personal ? '' : inferCompanyFromDomain(domain),
    domain,
    isPersonalEmail: personal,
    industry: known?.industry,
  };
}
