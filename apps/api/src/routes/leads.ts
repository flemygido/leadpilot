import type { FastifyInstance } from 'fastify';
import { prisma } from '@leadpilot/db';
import { generateAvailableSlots } from '@leadpilot/core';

function agentId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const v = req.headers['x-agent-id'];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function leadsRoutes(fastify: FastifyInstance) {
  // List all leads
  fastify.get('/api/leads', async (req, reply) => {
    const aid = agentId(req);
    const leads = await prisma.lead.findMany({
      where: aid ? { agentId: aid } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
        qualificationResult: true,
        stateTransitions: { orderBy: { createdAt: 'asc' } },
        siteVisits: { orderBy: { scheduledAt: 'asc' } },
        followUpJobs: { orderBy: { runAt: 'asc' } },
        _count: { select: { notifications: true } },
      },
    });
    return reply.send(leads);
  });

  // Get single lead with full conversation
  fastify.get<{ Params: { id: string } }>('/api/leads/:id', async (req, reply) => {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        agent: true,
        qualificationResult: true,
        stateTransitions: { orderBy: { createdAt: 'asc' } },
        siteVisits: { orderBy: { scheduledAt: 'asc' } },
        followUpJobs: { orderBy: { runAt: 'asc' } },
        notifications: { orderBy: { createdAt: 'desc' }, take: 20 },
        conversationFlags: { where: { resolvedAt: null }, orderBy: { createdAt: 'desc' } },
        conversation: {
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    return reply.send(lead);
  });

  // Take over — pauses AI for this lead
  fastify.post<{ Params: { id: string } }>('/api/leads/:id/takeover', async (req, reply) => {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { aiPaused: true },
    });
    return reply.send({ status: 'taken_over', leadId: lead.id, aiPaused: lead.aiPaused });
  });

  // Resume AI for this lead
  fastify.post<{ Params: { id: string } }>('/api/leads/:id/resume-ai', async (req, reply) => {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { aiPaused: false },
    });
    return reply.send({ status: 'resumed', leadId: lead.id, aiPaused: lead.aiPaused });
  });

  // Manually enroll a lead in the follow-up nurture sequence
  fastify.post<{ Params: { id: string } }>('/api/leads/:id/enroll-followup', async (req, reply) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });

    const existing = await prisma.followUpJob.findFirst({
      where: { leadId: lead.id, status: 'pending' },
    });
    if (existing) return reply.status(200).send({ status: 'already_enrolled' });

    const now = new Date();
    const schedule = [
      { step: 1, daysFromNow: 1 },
      { step: 2, daysFromNow: 3 },
      { step: 3, daysFromNow: 7 },
      { step: 4, daysFromNow: 14 },
    ];
    await prisma.followUpJob.createMany({
      data: schedule.map(({ step, daysFromNow }) => ({
        leadId: lead.id,
        sequenceStep: step,
        runAt: new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000),
        status: 'pending',
      })),
    });

    return reply.status(201).send({ status: 'enrolled', steps: schedule.length });
  });

  // Mark deal as won (agent action after closing) — only from HANDED_OFF
  fastify.post<{ Params: { id: string } }>('/api/leads/:id/close-won', async (req, reply) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    if (lead.state !== 'HANDED_OFF') {
      return reply.status(400).send({ error: 'Can only mark as won from HANDED_OFF state' });
    }
    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: { state: 'CLOSED_WON', aiPaused: true },
    });
    await prisma.stateTransition.create({
      data: { leadId: lead.id, fromState: 'HANDED_OFF', toState: 'CLOSED_WON', reason: 'agent_closed_won' },
    });
    await prisma.notification.create({
      data: {
        agentId: lead.agentId,
        leadId: lead.id,
        type: 'handoff',
        title: `Deal Closed: ${lead.name ?? lead.phone}`,
        body: `🏆 ${lead.name ?? lead.phone} marked as CLOSED_WON. Great work!`,
      },
    });
    return reply.send({ status: 'closed_won', leadId: updated.id });
  });

  // Resolve a conversation flag
  fastify.post<{ Params: { id: string; flagId: string } }>(
    '/api/leads/:id/flags/:flagId/resolve',
    async (req, reply) => {
      const flag = await prisma.conversationFlag.update({
        where: { id: req.params.flagId },
        data: { resolvedAt: new Date() },
      });
      return reply.send({ status: 'resolved', flagId: flag.id });
    },
  );

  // Get available visit slots for a lead
  fastify.get<{ Params: { id: string } }>('/api/leads/:id/visit-slots', async (req, reply) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });
    const slots = await generateAvailableSlots(lead.agentId, prisma);
    return reply.send({
      leadId: lead.id,
      slots: slots.map((s) => ({ label: s.label, scheduledAt: s.scheduledAt })),
    });
  });

  // Book a specific visit slot (dashboard action)
  fastify.post<{ Params: { id: string }; Body: { scheduledAt: string; notes?: string } }>(
    '/api/leads/:id/book-visit',
    async (req, reply) => {
      const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });

      const scheduledAt = new Date(req.body.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        return reply.status(400).send({ error: 'Invalid scheduledAt date' });
      }

      // Cancel existing offered visits
      await prisma.siteVisit.updateMany({
        where: { leadId: lead.id, status: 'offered' },
        data: { status: 'cancelled' },
      });

      const visit = await prisma.siteVisit.create({
        data: {
          leadId: lead.id,
          agentId: lead.agentId,
          scheduledAt,
          status: 'confirmed',
          confirmedAt: new Date(),
          notes: req.body.notes,
        },
      });

      await prisma.lead.update({ where: { id: lead.id }, data: { state: 'VISIT_SCHEDULED' } });
      await prisma.notification.create({
        data: {
          agentId: lead.agentId,
          leadId: lead.id,
          type: 'site_visit_booked',
          title: `Visit Booked: ${lead.name ?? lead.phone}`,
          body: `📅 Visit booked for ${scheduledAt.toLocaleString('en-IN')}`,
        },
      });

      return reply.send({
        visitId: visit.id,
        scheduledAt: visit.scheduledAt,
        status: visit.status,
      });
    },
  );

  // Manual lead import — alternative to portal webhooks
  // Accepts an array of leads; deduplicates by phone + source.
  fastify.post<{ Body: unknown }>('/api/leads/import', async (req, reply) => {
    const { z } = await import('zod');
    const schema = z.array(
      z.object({
        phone: z.string().min(5),
        name: z.string().optional(),
        source: z.string().optional().default('manual'),
        agentId: z.string().optional(),
        portalLeadId: z.string().optional(),
      })
    );
    const result = schema.safeParse(req.body);
    if (!result.success) return reply.status(400).send({ error: result.error.flatten() });

    const agents = await prisma.agent.findMany({ select: { id: true }, take: 1 });
    const fallbackAgentId = agents[0]?.id;
    if (!fallbackAgentId) return reply.status(500).send({ error: 'No agents configured' });

    const created: string[] = [];
    const skipped: string[] = [];

    for (const row of result.data) {
      const src = row.source ?? 'manual';
      const existing = await prisma.lead.findFirst({ where: { phone: row.phone, source: src } });
      if (existing) { skipped.push(row.phone); continue; }
      const lead = await prisma.lead.create({
        data: {
          phone: row.phone,
          name: row.name,
          agentId: row.agentId ?? fallbackAgentId,
          source: src,
          portalLeadId: row.portalLeadId,
          conversation: { create: {} },
        },
      });
      created.push(lead.id);
    }

    return reply.status(201).send({ created: created.length, skipped: skipped.length });
  });

  // Daily summary + ROI metrics
  fastify.get('/api/summary/daily', async (req, reply) => {
    const aid = agentId(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const agentFilter = aid ? { agentId: aid } : {};

    const [newLeads, hotLeads, upcomingVisits, pendingFollowUps, dealsWon, totalLeads] =
      await Promise.all([
        prisma.lead.count({ where: { ...agentFilter, createdAt: { gte: today } } }),
        prisma.lead.count({ where: { ...agentFilter, classification: 'HOT' } }),
        prisma.siteVisit.findMany({
          where: { ...agentFilter, status: 'confirmed', scheduledAt: { gte: today } },
          include: { lead: { select: { name: true, phone: true } } },
          orderBy: { scheduledAt: 'asc' },
        }),
        prisma.followUpJob.count({ where: { lead: { ...agentFilter }, status: 'pending', runAt: { gte: today } } }),
        prisma.lead.count({ where: { ...agentFilter, state: 'CLOSED_WON' } }),
        prisma.lead.count({ where: agentFilter }),
      ]);

    const conversionRate = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100) : 0;

    return reply.send({
      date: today.toISOString().split('T')[0],
      newLeads,
      hotLeads,
      upcomingVisits: upcomingVisits.length,
      pendingFollowUps,
      dealsWon,
      conversionRate,
      visits: upcomingVisits,
    });
  });
}
