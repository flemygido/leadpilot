import type { FastifyInstance } from 'fastify';
import { prisma } from '@leadpilot/db';

export async function agentsRoutes(fastify: FastifyInstance) {
  // Create agent
  fastify.post('/api/agents', async (req, reply) => {
    const { name, email, phone } = req.body as { name: string; email: string; phone: string };
    if (!name || !email || !phone) {
      return reply.status(400).send({ error: 'name, email and phone are required' });
    }
    const agent = await prisma.agent.create({ data: { name, email, phone } });
    return reply.status(201).send(agent);
  });

  // List all agents with availability + stats
  fastify.get('/api/agents', async (req, reply) => {
    const agents = await prisma.agent.findMany({
      include: {
        availabilities: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        _count: { select: { leads: true, properties: true } },
      },
    });
    return reply.send(agents);
  });

  // Single agent
  fastify.get<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        availabilities: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        _count: { select: { leads: true, properties: true } },
      },
    });
    if (!agent) return reply.status(404).send({ error: 'Agent not found' });
    return reply.send(agent);
  });

  // Add availability slot
  fastify.post<{ Params: { id: string } }>('/api/agents/:id/availability', async (req, reply) => {
    const { dayOfWeek, startTime, endTime } = req.body as {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    };
    const slot = await prisma.agentAvailability.create({
      data: { agentId: req.params.id, dayOfWeek, startTime, endTime },
    });
    return reply.status(201).send(slot);
  });

  // Delete agent (blocked if they have leads or site visits)
  fastify.delete<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    const id = req.params.id;

    const [leadCount, visitCount] = await Promise.all([
      prisma.lead.count({ where: { agentId: id } }),
      prisma.siteVisit.count({ where: { agentId: id } }),
    ]);

    if (leadCount > 0) {
      return reply.status(409).send({
        error: `This agent has ${leadCount} lead${leadCount !== 1 ? 's' : ''}. Reassign them before removing.`,
      });
    }
    if (visitCount > 0) {
      return reply.status(409).send({
        error: `This agent has ${visitCount} site visit${visitCount !== 1 ? 's' : ''} on record. Reassign them before removing.`,
      });
    }

    // Clear nullable FK on properties, delete availabilities, then delete agent
    await prisma.property.updateMany({ where: { agentId: id }, data: { agentId: null } });
    await prisma.agentAvailability.deleteMany({ where: { agentId: id } });
    await prisma.notification.deleteMany({ where: { agentId: id } });

    try {
      await prisma.agent.delete({ where: { id } });
    } catch (err: unknown) {
      // P2025 = record not found — already deleted or never existed
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return reply.status(404).send({ error: 'Agent not found. The page may be stale — please refresh.' });
      }
      throw err;
    }

    return reply.send({ status: 'deleted', agentId: id });
  });

  // Delete availability slot
  fastify.delete<{ Params: { id: string; slotId: string } }>(
    '/api/agents/:id/availability/:slotId',
    async (req, reply) => {
      await prisma.agentAvailability.delete({ where: { id: req.params.slotId } });
      return reply.send({ status: 'deleted', slotId: req.params.slotId });
    },
  );
}
