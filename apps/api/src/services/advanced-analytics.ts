import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export async function getSequenceFunnel(sequenceId: string) {
  const sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) throw AppError.notFound('Sequence');

  const [enrolled, completed, exited] = await Promise.all([
    prisma.sequenceEnrollment.count({ where: { sequenceId } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId, status: 'completed' } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId, status: 'exited' } }),
  ]);

  // Get message stats for this sequence's executions
  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId },
    select: { id: true, leadId: true },
  });

  const leadIds = enrollments.map((e) => e.leadId);

  const [opened, clicked, replied, converted] = await Promise.all([
    prisma.message.count({
      where: { leadId: { in: leadIds }, status: 'delivered' },
    }),
    prisma.message.count({
      where: { leadId: { in: leadIds }, status: 'delivered' },
    }),
    prisma.message.count({
      where: { leadId: { in: leadIds }, status: 'replied' },
    }),
    prisma.sequenceEnrollment.count({
      where: { sequenceId, status: 'completed' },
    }),
  ]);

  return {
    sequenceId,
    funnel: {
      enrolled,
      opened: Math.min(opened, enrolled),
      clicked: Math.min(clicked, enrolled),
      replied: Math.min(replied, enrolled),
      converted,
    },
    rates: {
      openRate: enrolled > 0 ? Math.round((Math.min(opened, enrolled) / enrolled) * 100) : 0,
      clickRate: enrolled > 0 ? Math.round((Math.min(clicked, enrolled) / enrolled) * 100) : 0,
      replyRate: enrolled > 0 ? Math.round((Math.min(replied, enrolled) / enrolled) * 100) : 0,
      conversionRate: enrolled > 0 ? Math.round((converted / enrolled) * 100) : 0,
      completionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
      exitRate: enrolled > 0 ? Math.round((exited / enrolled) * 100) : 0,
    },
  };
}

export async function getCohortAnalysis(sequenceId: string, period: 'week' | 'month' = 'week') {
  const sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) throw AppError.notFound('Sequence');

  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId },
    orderBy: { createdAt: 'asc' },
  });

  // Group enrollments by period
  const cohorts: Record<string, { total: number; completed: number; exited: number; active: number }> = {};

  for (const enrollment of enrollments) {
    const date = enrollment.createdAt;
    let key: string;
    if (period === 'week') {
      const weekStart = new Date(date);
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      key = weekStart.toISOString().slice(0, 10);
    } else {
      key = date.toISOString().slice(0, 7);
    }

    if (!cohorts[key]) {
      cohorts[key] = { total: 0, completed: 0, exited: 0, active: 0 };
    }
    cohorts[key].total++;
    if (enrollment.status === 'completed') cohorts[key].completed++;
    else if (enrollment.status === 'exited') cohorts[key].exited++;
    else cohorts[key].active++;
  }

  return {
    sequenceId,
    period,
    cohorts: Object.entries(cohorts).map(([periodKey, stats]) => ({
      period: periodKey,
      ...stats,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    })),
  };
}

export async function getRevenueAttribution(sequenceId: string) {
  const sequence = await prisma.sequence.findUnique({ where: { id: sequenceId } });
  if (!sequence) throw AppError.notFound('Sequence');

  // Find leads that completed the sequence
  const completedEnrollments = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId, status: 'completed' },
    select: { leadId: true },
  });

  const leadIds = completedEnrollments.map((e) => e.leadId);

  // Look for leads with enrichment data that might contain deal values
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, enrichmentData: true, customFields: true },
  });

  let totalRevenue = 0;
  let attributedDeals = 0;

  for (const lead of leads) {
    const enrichment = lead.enrichmentData as Record<string, unknown> | null;
    const custom = lead.customFields as Record<string, unknown> | null;
    const dealValue = Number(enrichment?.dealValue ?? custom?.dealValue ?? 0);
    if (dealValue > 0) {
      totalRevenue += dealValue;
      attributedDeals++;
    }
  }

  return {
    sequenceId,
    totalRevenue,
    attributedDeals,
    totalConverted: completedEnrollments.length,
    averageDealValue: attributedDeals > 0 ? Math.round(totalRevenue / attributedDeals) : 0,
  };
}

export async function exportAnalyticsCSV(type: string, filters: { sequenceId?: string; startDate?: string; endDate?: string }) {
  let rows: string[][] = [];
  let headers: string[] = [];

  if (type === 'funnel' && filters.sequenceId) {
    const funnel = await getSequenceFunnel(filters.sequenceId);
    headers = ['Stage', 'Count', 'Rate (%)'];
    rows = [
      ['Enrolled', String(funnel.funnel.enrolled), '100'],
      ['Opened', String(funnel.funnel.opened), String(funnel.rates.openRate)],
      ['Clicked', String(funnel.funnel.clicked), String(funnel.rates.clickRate)],
      ['Replied', String(funnel.funnel.replied), String(funnel.rates.replyRate)],
      ['Converted', String(funnel.funnel.converted), String(funnel.rates.conversionRate)],
    ];
  } else if (type === 'cohort' && filters.sequenceId) {
    const cohort = await getCohortAnalysis(filters.sequenceId);
    headers = ['Period', 'Total', 'Completed', 'Exited', 'Active', 'Completion Rate (%)'];
    rows = cohort.cohorts.map((c) => [
      c.period, String(c.total), String(c.completed), String(c.exited), String(c.active), String(c.completionRate),
    ]);
  } else if (type === 'revenue' && filters.sequenceId) {
    const revenue = await getRevenueAttribution(filters.sequenceId);
    headers = ['Metric', 'Value'];
    rows = [
      ['Total Revenue', String(revenue.totalRevenue)],
      ['Attributed Deals', String(revenue.attributedDeals)],
      ['Total Converted', String(revenue.totalConverted)],
      ['Average Deal Value', String(revenue.averageDealValue)],
    ];
  } else {
    throw AppError.validation('Invalid export type or missing sequenceId');
  }

  const csvLines = [headers.join(','), ...rows.map((r) => r.join(','))];
  return csvLines.join('\n');
}
