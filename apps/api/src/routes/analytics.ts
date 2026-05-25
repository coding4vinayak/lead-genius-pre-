import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

const router = Router();

router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalLeads, activeCampaigns, totalSent, totalDelivered,
      totalFailed, totalBounced, totalReplied,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.campaign.count({ where: { status: 'running' } }),
      prisma.message.count(),
      prisma.message.count({ where: { status: 'delivered' } }),
      prisma.message.count({ where: { status: 'failed' } }),
      prisma.message.count({ where: { status: 'bounced' } }),
      prisma.message.count({ where: { status: 'replied' } }),
    ]);
    res.json({
      data: {
        totalLeads, activeCampaigns, totalSent, totalDelivered,
        totalFailed, totalBounced, totalReplied,
        deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
      },
    });
  } catch (err) { next(err); }
});

router.get('/by-campaign', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      select: { id: true, name: true, sentCount: true, failedCount: true, replyCount: true, openedCount: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: campaigns });
  } catch (err) { next(err); }
});

router.get('/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { days = '7' } = req.query as Record<string, string>;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    const messages = await prisma.message.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true, channel: true },
      orderBy: { createdAt: 'asc' },
    });

    const timeline: Record<string, { sent: number; delivered: number; failed: number }> = {};
    for (const msg of messages) {
      const date = msg.createdAt.toISOString().slice(0, 10);
      if (!timeline[date]) timeline[date] = { sent: 0, delivered: 0, failed: 0 };
      timeline[date].sent++;
      if (msg.status === 'delivered') timeline[date].delivered++;
      if (msg.status === 'failed') timeline[date].failed++;
    }
    res.json({
      data: Object.entries(timeline).map(([date, counts]) => ({ date, ...counts })),
    });
  } catch (err) { next(err); }
});

router.get('/channel-breakdown', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [email, whatsapp] = await Promise.all([
      prisma.message.count({ where: { channel: 'email' } }),
      prisma.message.count({ where: { channel: 'whatsapp' } }),
    ]);
    res.json({ data: { email, whatsapp } });
  } catch (err) { next(err); }
});

router.get('/sequences', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sequences = await prisma.sequence.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'desc' },
    });

    const sequenceStats = await Promise.all(
      sequences.map(async (seq) => {
        const [total, completed, active, exited] = await Promise.all([
          prisma.sequenceEnrollment.count({ where: { sequenceId: seq.id } }),
          prisma.sequenceEnrollment.count({ where: { sequenceId: seq.id, status: 'completed' } }),
          prisma.sequenceEnrollment.count({ where: { sequenceId: seq.id, status: 'active' } }),
          prisma.sequenceEnrollment.count({ where: { sequenceId: seq.id, status: 'exited' } }),
        ]);
        return {
          ...seq,
          totalEnrollments: total,
          completedEnrollments: completed,
          activeEnrollments: active,
          exitedEnrollments: exited,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      })
    );

    res.json({ data: sequenceStats });
  } catch (err) { next(err); }
});

export default router;
