import type { FastifyInstance } from 'fastify';
import { prisma } from '@leadpilot/db';

function agentId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const v = req.headers['x-agent-id'];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export async function propertiesRoutes(fastify: FastifyInstance) {
  // List all properties (optionally filtered by status)
  fastify.get('/api/properties', async (req, reply) => {
    const aid = agentId(req);
    const { status } = req.query as { status?: string };
    const where: Record<string, unknown> = {};
    if (aid) where['agentId'] = aid;
    if (status) where['status'] = status;
    const properties = await prisma.property.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
        _count: { select: { siteVisits: { where: { status: { in: ['confirmed', 'completed'] } } } } },
      },
    });
    return reply.send(properties);
  });

  // Create property
  fastify.post('/api/properties', async (req, reply) => {
    const b = req.body as Record<string, unknown>;
    const property = await prisma.property.create({
      data: {
        title: String(b['title'] ?? ''),
        description: b['description'] ? String(b['description']) : null,
        propertyType: String(b['propertyType'] ?? 'apartment'),
        bhk: b['bhk'] ? Number(b['bhk']) : null,
        areaSqft: b['areaSqft'] ? Number(b['areaSqft']) : null,
        priceMin: Number(b['priceMin'] ?? 0),
        priceMax: Number(b['priceMax'] ?? 0),
        location: String(b['location'] ?? ''),
        address: b['address'] ? String(b['address']) : null,
        status: String(b['status'] ?? 'available'),
        isAvailable: b['status'] !== 'sold',
        amenities: Array.isArray(b['amenities']) ? (b['amenities'] as string[]) : [],
        ownerName: b['ownerName'] ? String(b['ownerName']) : null,
        ownerPhone: b['ownerPhone'] ? String(b['ownerPhone']) : null,
        ownerEmail: b['ownerEmail'] ? String(b['ownerEmail']) : null,
        agentId: b['agentId'] ? String(b['agentId']) : null,
      },
    });
    return reply.status(201).send(property);
  });

  // Get single property — includes site visits + matching leads
  fastify.get<{ Params: { id: string } }>('/api/properties/:id', async (req, reply) => {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        agent: { select: { id: true, name: true, phone: true, email: true } },
        siteVisits: {
          where: { status: { not: 'cancelled' } },
          orderBy: { scheduledAt: 'asc' },
          include: {
            lead: { select: { id: true, name: true, phone: true, state: true, score: true } },
            agent: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!property) return reply.status(404).send({ error: 'Property not found' });

    // Find leads whose qualification matches this property type & budget
    const interestedLeads = await prisma.lead.findMany({
      where: {
        state: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
        qualificationResult: {
          propertyType: property.propertyType,
          OR: [
            { budgetMin: null },
            {
              budgetMax: { gte: property.priceMin },
              budgetMin: { lte: property.priceMax },
            },
          ],
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        state: true,
        score: true,
        qualificationResult: {
          select: { intent: true, timeline: true, budgetMin: true, budgetMax: true, bhk: true },
        },
      },
      orderBy: { score: 'desc' },
      take: 20,
    });

    return reply.send({ ...property, interestedLeads });
  });

  // Update property
  fastify.patch<{ Params: { id: string } }>('/api/properties/:id', async (req, reply) => {
    const b = req.body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if (b['title'] !== undefined) data['title'] = String(b['title']);
    if (b['description'] !== undefined) data['description'] = b['description'] ? String(b['description']) : null;
    if (b['propertyType'] !== undefined) data['propertyType'] = String(b['propertyType']);
    if (b['bhk'] !== undefined) data['bhk'] = b['bhk'] ? Number(b['bhk']) : null;
    if (b['areaSqft'] !== undefined) data['areaSqft'] = b['areaSqft'] ? Number(b['areaSqft']) : null;
    if (b['priceMin'] !== undefined) data['priceMin'] = Number(b['priceMin']);
    if (b['priceMax'] !== undefined) data['priceMax'] = Number(b['priceMax']);
    if (b['location'] !== undefined) data['location'] = String(b['location']);
    if (b['address'] !== undefined) data['address'] = b['address'] ? String(b['address']) : null;
    if (b['status'] !== undefined) {
      data['status'] = String(b['status']);
      data['isAvailable'] = b['status'] !== 'sold';
    }
    if (b['amenities'] !== undefined) data['amenities'] = Array.isArray(b['amenities']) ? b['amenities'] : [];
    if (b['ownerName'] !== undefined) data['ownerName'] = b['ownerName'] ? String(b['ownerName']) : null;
    if (b['ownerPhone'] !== undefined) data['ownerPhone'] = b['ownerPhone'] ? String(b['ownerPhone']) : null;
    if (b['ownerEmail'] !== undefined) data['ownerEmail'] = b['ownerEmail'] ? String(b['ownerEmail']) : null;
    if (b['agentId'] !== undefined) data['agentId'] = b['agentId'] ? String(b['agentId']) : null;

    const property = await prisma.property.update({
      where: { id: req.params.id },
      data,
    });
    return reply.send(property);
  });

  // Delete property (hard delete — propertyId on visits set to null via onDelete: SetNull)
  fastify.delete<{ Params: { id: string } }>('/api/properties/:id', async (req, reply) => {
    await prisma.property.delete({ where: { id: req.params.id } });
    return reply.send({ status: 'deleted', propertyId: req.params.id });
  });
}
