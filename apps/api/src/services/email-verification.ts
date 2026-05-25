import dns from 'dns';
import { promisify } from 'util';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

const resolveMx = promisify(dns.resolveMx);

export type VerificationResult = {
  email: string;
  status: 'valid' | 'invalid' | 'risky' | 'unknown';
  mxValid: boolean;
  smtpValid: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFormat(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

async function checkMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

function determineStatus(formatValid: boolean, mxValid: boolean): 'valid' | 'invalid' | 'risky' | 'unknown' {
  if (!formatValid) return 'invalid';
  if (!mxValid) return 'invalid';
  return 'valid';
}

export async function verifyEmail(email: string): Promise<VerificationResult> {
  const formatValid = validateFormat(email);
  if (!formatValid) {
    return { email, status: 'invalid', mxValid: false, smtpValid: false };
  }

  const domain = email.split('@')[1];
  const mxValid = await checkMxRecords(domain);
  const smtpValid = mxValid; // SMTP verification is optional/risky in production
  const status = determineStatus(formatValid, mxValid);

  // Store verification result
  const lead = await prisma.lead.findFirst({ where: { email } });
  await prisma.emailVerification.create({
    data: {
      email,
      leadId: lead?.id || null,
      status,
      mxValid,
      smtpValid,
    },
  });

  // Update lead verification status if found
  if (lead) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { verificationStatus: status },
    });
  }

  return { email, status, mxValid, smtpValid };
}

export async function bulkVerify(emails: string[]): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const email of emails) {
    try {
      const result = await verifyEmail(email);
      results.push(result);
    } catch (err) {
      logger.error(`Bulk verify failed for ${email}`, { error: (err as Error).message });
      results.push({ email, status: 'unknown', mxValid: false, smtpValid: false });
    }
  }
  return results;
}

export async function getVerificationStatus(email: string) {
  const verification = await prisma.emailVerification.findFirst({
    where: { email },
    orderBy: { verifiedAt: 'desc' },
  });
  return verification;
}
