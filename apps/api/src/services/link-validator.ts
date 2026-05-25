export interface LinkCheckResult {
  url: string;
  status: 'valid' | 'invalid';
  reason?: string;
}

export function extractLinks(html: string): string[] {
  const hrefPattern = /href=["']([^"']+)["']/gi;
  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html)) !== null) {
    const url = match[1];
    if (url && !url.startsWith('#') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
      urls.push(url);
    }
  }

  return urls;
}

export function validateLinks(urls: string[]): LinkCheckResult[] {
  return urls.map((url) => {
    // Check for valid protocol
    if (!/^https?:\/\//i.test(url)) {
      return { url, status: 'invalid' as const, reason: 'Missing or invalid protocol (must be http or https)' };
    }

    // Extract domain part
    let domain: string;
    try {
      const parsed = new URL(url);
      domain = parsed.hostname;
    } catch {
      return { url, status: 'invalid' as const, reason: 'Malformed URL structure' };
    }

    // Check domain has at least one dot (e.g., example.com)
    if (!domain.includes('.')) {
      return { url, status: 'invalid' as const, reason: 'Invalid domain structure (missing TLD)' };
    }

    // Check domain doesn't start or end with a dot/hyphen
    if (domain.startsWith('.') || domain.startsWith('-') || domain.endsWith('.') || domain.endsWith('-')) {
      return { url, status: 'invalid' as const, reason: 'Invalid domain format' };
    }

    // Check for valid domain characters
    const domainParts = domain.split('.');
    for (const part of domainParts) {
      if (part.length === 0) {
        return { url, status: 'invalid' as const, reason: 'Empty domain label' };
      }
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(part)) {
        return { url, status: 'invalid' as const, reason: 'Invalid characters in domain' };
      }
    }

    // Check TLD is at least 2 characters
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2) {
      return { url, status: 'invalid' as const, reason: 'Invalid TLD (too short)' };
    }

    return { url, status: 'valid' as const };
  });
}
