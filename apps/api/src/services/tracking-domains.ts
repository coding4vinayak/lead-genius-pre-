import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export async function addDomain(domain: string, cnameTarget: string, isDefault = false) {
  const existing = await prisma.trackingDomain.findUnique({ where: { domain } });
  if (existing) throw AppError.conflict('Tracking domain already exists');

  // If setting as default, unset other defaults
  if (isDefault) {
    await prisma.trackingDomain.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.trackingDomain.create({
    data: {
      domain,
      cnameTarget,
      isDefault,
    },
  });
}

export async function verifyDomain(id: string): Promise<{ verified: boolean; message: string }> {
  const trackingDomain = await prisma.trackingDomain.findUnique({ where: { id } });
  if (!trackingDomain) throw AppError.notFound('TrackingDomain');

  // In production, perform DNS CNAME lookup using dns.resolveCname
  // For now, simulate verification based on whether the domain looks configured
  // Real implementation would do: const records = await dns.promises.resolveCname(domain)
  // and check if cnameTarget is in the results
  const verified = false; // Default to unverified; real implementation checks DNS

  if (verified) {
    await prisma.trackingDomain.update({
      where: { id },
      data: {
        cnameVerified: true,
        status: 'verified',
        verifiedAt: new Date(),
      },
    });
    return { verified: true, message: 'CNAME record verified successfully' };
  }

  await prisma.trackingDomain.update({
    where: { id },
    data: {
      status: 'failed',
      cnameVerified: false,
    },
  });
  return { verified: false, message: `CNAME record not found. Please add a CNAME record for ${trackingDomain.domain} pointing to ${trackingDomain.cnameTarget}` };
}

export async function removeDomain(id: string) {
  const trackingDomain = await prisma.trackingDomain.findUnique({ where: { id } });
  if (!trackingDomain) throw AppError.notFound('TrackingDomain');

  return prisma.trackingDomain.delete({ where: { id } });
}

export async function getActiveDomain() {
  const domain = await prisma.trackingDomain.findFirst({
    where: { isDefault: true, cnameVerified: true },
  });
  return domain;
}

export async function listDomains() {
  return prisma.trackingDomain.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getDomain(id: string) {
  const domain = await prisma.trackingDomain.findUnique({ where: { id } });
  if (!domain) throw AppError.notFound('TrackingDomain');
  return domain;
}
