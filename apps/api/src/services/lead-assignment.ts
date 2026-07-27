import { prisma } from '../db.js';
import { logActivity } from './lead-activity.js';
import { createNotification } from './notification.js';

export async function assignLead(leadId: string, userId: string) {
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId: userId },
  });

  await logActivity(leadId, userId, 'assigned', `Lead assigned to user`, { userId }).catch(() => {});

  await createNotification(
    userId,
    'system',
    'Lead Assigned',
    'A lead has been assigned to you',
    { leadId },
  ).catch(() => {});

  return lead;
}

export async function unassignLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  const previousUserId = lead?.assignedToId;

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId: null },
  });

  await logActivity(leadId, previousUserId || null, 'unassigned', 'Lead unassigned').catch(() => {});

  return updated;
}

export async function autoAssignLead(leadId: string, workspaceId: string) {
  const rules = await prisma.assignmentRule.findMany({
    where: { workspaceId, isActive: true },
    orderBy: { priority: 'asc' },
  });

  for (const rule of rules) {
    let assigneeId: string | null = null;

    if (rule.type === 'round_robin') {
      assigneeId = await roundRobinAssign(workspaceId, rule.id, rule.config as Record<string, unknown>);
    } else if (rule.type === 'territory') {
      assigneeId = await territoryAssign(leadId, workspaceId, rule.config as Record<string, unknown>);
    } else if (rule.type === 'load_balanced') {
      assigneeId = await loadBalancedAssign(workspaceId);
    }

    if (assigneeId) {
      return assignLead(leadId, assigneeId);
    }
  }

  return null;
}

export async function roundRobinAssign(
  workspaceId: string,
  ruleId?: string,
  config?: Record<string, unknown>,
): Promise<string | null> {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { joinedAt: 'asc' },
  });

  if (members.length === 0) return null;

  const lastIndex = (config?.lastIndex as number) ?? -1;
  const nextIndex = (lastIndex + 1) % members.length;

  if (ruleId) {
    await prisma.assignmentRule.update({
      where: { id: ruleId },
      data: { config: { ...(config || {}), lastIndex: nextIndex } },
    }).catch(() => {});
  }

  return members[nextIndex].userId;
}

export async function territoryAssign(
  leadId: string,
  workspaceId: string,
  config: Record<string, unknown>,
): Promise<string | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;

  const territories = (config?.territories as Array<{ country?: string; company?: string; userId: string }>) || [];

  const customFields = (lead.customFields as Record<string, unknown>) || {};
  const leadCountry = (customFields.country as string)?.toLowerCase() || '';
  const leadCompany = (lead.company || '').toLowerCase();

  for (const territory of territories) {
    if (territory.country && leadCountry === territory.country.toLowerCase()) {
      return territory.userId;
    }
    if (territory.company && leadCompany.includes(territory.company.toLowerCase())) {
      return territory.userId;
    }
  }

  return null;
}

export async function loadBalancedAssign(workspaceId: string): Promise<string | null> {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
  });

  if (members.length === 0) return null;

  const counts = await Promise.all(
    members.map(async (m) => {
      const count = await prisma.lead.count({
        where: { assignedToId: m.userId, status: 'active' },
      });
      return { userId: m.userId, count };
    }),
  );

  counts.sort((a, b) => a.count - b.count);
  return counts[0].userId;
}
