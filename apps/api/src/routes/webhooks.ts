import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@leadpilot/db';
import type { WhatsAppProvider } from '@leadpilot/core';

const LeadWebhookSchema = z.object({
  phone: z.string().min(5),
  name: z.string().optional(),
  source: z.string().optional().default('webhook'),
  agentId: z.string().optional(),
});

/**
 * Round-robin agent selection.
 * Picks the agent with the fewest leads currently assigned, falling back to
 * the provided defaultAgentId if no agents exist.
 */
async function pickAgent(defaultAgentId: string): Promise<string> {
  const agents = await prisma.agent.findMany({
    select: { id: true, _count: { select: { leads: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (agents.length === 0) return defaultAgentId;
  const leastLoaded = agents.reduce((a, b) =>
    (a._count.leads <= b._count.leads ? a : b)
  );
  return leastLoaded.id;
}

const SimulateInboundSchema = z.object({
  from: z.string().min(5),
  body: z.string().min(1),
});

// eslint-disable-next-line @typescript-eslint/require-await
export async function webhookRoutes(
  fastify: FastifyInstance,
  opts: {
    provider: WhatsAppProvider;
    defaultAgentId: string;
    onInbound: (leadId: string, text: string) => Promise<void>;
  },
) {
  const { provider, defaultAgentId, onInbound } = opts;

  // ── POST /webhooks/whatsapp ─────────────────────────────────────────────
  // Receives inbound messages from WhatsApp providers (Meta / Twilio / Mock).
  // Meta also sends a GET for webhook verification.
  fastify.get('/webhooks/whatsapp', async (req, reply) => {
    // Meta webhook verification handshake
    const query = req.query as Record<string, string>;
    if (query['hub.mode'] === 'subscribe') {
      const verifyToken = process.env['META_VERIFY_TOKEN'] ?? 'leadpilot_webhook_verify';
      if (query['hub.verify_token'] === verifyToken) {
        return reply.send(query['hub.challenge']);
      }
      return reply.status(403).send({ error: 'Invalid verify token' });
    }
    return reply.send({ status: 'ok' });
  });

  fastify.post('/webhooks/whatsapp', async (req, reply) => {
    const parsed = provider.parseInboundWebhook(req.body);
    if (!parsed) {
      return reply.status(200).send({ status: 'ignored' });
    }

    const { from, body, timestamp } = parsed;

    // Find or create lead — phone is no longer unique (same number may come from multiple portals)
    const assignedAgentId = await pickAgent(defaultAgentId);
    let lead = await prisma.lead.findFirst({
      where: { phone: from, source: 'inbound' },
      orderBy: { createdAt: 'desc' },
    });
    if (lead) {
      lead = await prisma.lead.update({ where: { id: lead.id }, data: { lastInboundAt: timestamp } });
    } else {
      lead = await prisma.lead.create({
        data: {
          phone: from,
          agentId: assignedAgentId,
          source: 'inbound',
          lastInboundAt: timestamp,
          conversation: { create: {} },
        },
      });
    }

    // Persist inbound message
    const conversation = await prisma.conversation.findUnique({ where: { leadId: lead.id } });
    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'lead',
          direction: 'inbound',
          body,
          providerMessageId: parsed.providerMessageId,
        },
      });
    }

    // Trigger conversation engine asynchronously (fire-and-forget)
    void onInbound(lead.id, body);

    return reply.status(200).send({ status: 'accepted' });
  });

  // ── POST /webhooks/lead ─────────────────────────────────────────────────
  // Portal/website webhook to create a new lead record.
  fastify.post('/webhooks/lead', async (req, reply) => {
    const result = LeadWebhookSchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.flatten() });
    }

    const { phone, name, source } = result.data;
    const agentId = result.data.agentId ?? await pickAgent(defaultAgentId);
    const leadSource = source ?? 'webhook';

    // Deduplicate by phone + source so the same portal can't create the same lead twice,
    // but the same number from 99acres and MagicBricks creates two separate records.
    const existing = await prisma.lead.findFirst({ where: { phone, source: leadSource } });
    if (existing) {
      return reply.status(200).send({ status: 'exists', leadId: existing.id });
    }

    const lead = await prisma.lead.create({
      data: {
        phone,
        name,
        agentId,
        source: leadSource,
        conversation: { create: {} },
      },
    });

    // Trigger greeting asynchronously
    void onInbound(lead.id, '');

    return reply.status(201).send({ status: 'created', leadId: lead.id });
  });

  // ── POST /dev/simulate-inbound ──────────────────────────────────────────
  // Mock-only endpoint to simulate an inbound WhatsApp message in local dev.
  if (process.env['WHATSAPP_PROVIDER'] === 'mock' || process.env['NODE_ENV'] !== 'production') {
    fastify.post('/dev/simulate-inbound', async (req, reply) => {
      const result = SimulateInboundSchema.safeParse(req.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.flatten() });
      }

      const { from, body } = result.data;
      const now = new Date();

      const simAgentId = await pickAgent(defaultAgentId);
      let lead = await prisma.lead.findFirst({
        where: { phone: from },
        orderBy: { createdAt: 'desc' },
      });
      if (lead) {
        lead = await prisma.lead.update({ where: { id: lead.id }, data: { lastInboundAt: now } });
      } else {
        lead = await prisma.lead.create({
          data: {
            phone: from,
            agentId: simAgentId,
            source: 'inbound',
            lastInboundAt: now,
            conversation: { create: {} },
          },
        });
      }

      const conversation = await prisma.conversation.findUnique({ where: { leadId: lead.id } });
      if (conversation) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'lead',
            direction: 'inbound',
            body,
            providerMessageId: `mock_${Date.now()}`,
          },
        });
      }

      void onInbound(lead.id, body);

      return reply.status(200).send({ status: 'simulated', leadId: lead.id, from, body });
    });
  }
}
