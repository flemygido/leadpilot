import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { WhatsAppProvider } from '../whatsapp/provider.interface.js';
import { generateAvailableSlots } from './slot-generator.js';

export interface VisitServiceOptions {
  db: PrismaClient;
  whatsapp: WhatsAppProvider;
  logger: Logger;
}

export class VisitService {
  private db: PrismaClient;
  private whatsapp: WhatsAppProvider;
  private logger: Logger;

  constructor({ db, whatsapp, logger }: VisitServiceOptions) {
    this.db = db;
    this.whatsapp = whatsapp;
    this.logger = logger;
  }

  /**
   * Generate slot options for a lead, create SiteVisit records with status='offered',
   * and return the message body to send to the lead.
   */
  async offerSlots(leadId: string): Promise<string> {
    const log = this.logger.child({ leadId, module: 'VisitService.offerSlots' });

    const lead = await this.db.lead.findUnique({
      where: { id: leadId },
      include: { agent: true, qualificationResult: true },
    });
    if (!lead) {
      log.warn('Lead not found — cannot offer slots');
      return "I'd love to arrange a site visit! Let me check availability and get back to you.";
    }

    // Find the best matching property for this lead (location-aware)
    const property = await findMatchingProperty(this.db, lead.qualificationResult
      ? {
          propertyType: lead.qualificationResult.propertyType,
          bhk: lead.qualificationResult.bhk,
          budgetMin: lead.qualificationResult.budgetMin,
          budgetMax: lead.qualificationResult.budgetMax,
          preferredLocations: lead.qualificationResult.preferredLocations,
        }
      : null);
    const propertyNote = property
      ? `${property.title}\n${property.location}`
      : null;

    const slots = await generateAvailableSlots(lead.agentId, this.db);

    // Cancel any previously offered (not yet confirmed) visits before creating new ones
    await this.db.siteVisit.updateMany({
      where: { leadId, status: 'offered' },
      data: { status: 'cancelled' },
    });

    // Create one SiteVisit per slot with the matched property stored in notes
    for (const slot of slots) {
      await this.db.siteVisit.create({
        data: {
          leadId,
          agentId: lead.agentId,
          scheduledAt: slot.scheduledAt,
          status: 'offered',
          notes: propertyNote ?? undefined,
        },
      });
    }

    const leadName = lead.name ? `, ${lead.name}` : '';
    const slotLines = slots.map((s, i) => `${i + 1}️⃣ ${s.label}`).join('\n');

    log.info({ slotCount: slots.length, property: property?.title }, 'Visit slots offered');

    const propertyLines = property
      ? [`🏠 *${property.title}*`, `📍 ${property.location}`, ``]
      : [];

    return [
      `Great news${leadName}! I'd love to arrange a site visit for you. 🏡`,
      ``,
      ...propertyLines,
      `Here are some available slots:`,
      ``,
      slotLines,
      ``,
      `Which one works best for you? Just reply with the number (1, 2, or 3)! 😊`,
    ].join('\n');
  }

  /**
   * Confirm a site visit for a lead.
   * slotIndex (1-based) is the slot the lead picked. Defaults to first offered slot.
   */
  async confirmVisit(leadId: string, slotIndex = 1): Promise<string> {
    const log = this.logger.child({ leadId, module: 'VisitService.confirmVisit' });

    // Load all offered visits in chronological order then pick the chosen one
    const offeredVisits = await this.db.siteVisit.findMany({
      where: { leadId, status: 'offered' },
      orderBy: { scheduledAt: 'asc' },
      include: { lead: { include: { agent: true } } },
    });

    // Pick the slot the user chose (1-based index, clamp to valid range)
    const idx = Math.min(Math.max(slotIndex, 1), offeredVisits.length) - 1;
    const visit = offeredVisits[idx] ?? offeredVisits[0] ?? null;

    if (!visit) {
      log.warn('No offered visit found to confirm — re-offering');
      return await this.offerSlots(leadId);
    }

    // Mark as confirmed
    await this.db.siteVisit.update({
      where: { id: visit.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });

    // Cancel remaining offered slots
    await this.db.siteVisit.updateMany({
      where: { leadId, status: 'offered' },
      data: { status: 'cancelled' },
    });

    // Transition lead state
    await this.db.lead.update({
      where: { id: leadId },
      data: { state: 'VISIT_SCHEDULED' },
    });

    await this.db.stateTransition.create({
      data: {
        leadId,
        fromState: 'VISIT_OFFERED',
        toState: 'VISIT_SCHEDULED',
        reason: 'visit_confirmed',
      },
    });

    const label = formatDateTime(visit.scheduledAt);
    const agent = visit.lead.agent;
    const leadName = visit.lead.name;

    // notes holds "Property Title\nLocation" written by offerSlots
    const [propertyTitle, propertyLocation] = (visit.notes ?? '').split('\n');
    const hasLocation = !!propertyLocation?.trim();

    // Notify agent
    await this.db.notification.create({
      data: {
        agentId: agent.id,
        leadId,
        type: 'site_visit_booked',
        title: `Visit Booked: ${leadName ?? visit.lead.phone}`,
        body: [
          `📅 SITE VISIT BOOKED`,
          `Lead: ${leadName ?? visit.lead.phone}`,
          `Phone: ${visit.lead.phone}`,
          `Slot: ${label}`,
          ...(hasLocation ? [`Property: ${propertyTitle ?? ''}`, `Location: ${propertyLocation}`] : []),
        ].join('\n'),
      },
    });

    log.info(
      { visitId: visit.id, scheduledAt: visit.scheduledAt, location: propertyLocation },
      'Visit confirmed',
    );

    return [
      `Your site visit is confirmed! 🎉`,
      ``,
      `📅 ${label}`,
      ...(hasLocation
        ? [`🏠 ${propertyTitle ?? ''}`, `📍 ${propertyLocation}`, ``]
        : [``]),
      `Our agent ${agent.name} will meet you at the property. They'll call you an hour before to confirm directions. See you then! 🏡`,
    ].join('\n');
  }
}

/**
 * Finds the best matching available property for a lead.
 *
 * Priority:
 *   1. location + type + budget all match
 *   2. location + type (relax budget)
 *   3. type + budget (relax location)
 *   4. type only
 *   5. any available property
 *
 * Location match uses a case-insensitive substring check against each preferred location.
 */
async function findMatchingProperty(
  db: PrismaClient,
  qual: {
    propertyType?: string | null;
    bhk?: number | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    preferredLocations?: string[] | null;
  } | null,
) {
  const hasType = !!qual?.propertyType && qual.propertyType !== 'unknown';
  const hasBudget = qual?.budgetMin != null && qual?.budgetMax != null;
  const hasLocations = !!qual?.preferredLocations && qual.preferredLocations.length > 0;

  const typeFilter = hasType ? { propertyType: qual!.propertyType as string } : {};
  const budgetFilter = hasBudget
    ? { priceMin: { lte: qual!.budgetMax as number }, priceMax: { gte: qual!.budgetMin as number } }
    : {};

  // Build OR clause for each preferred location substring
  const locationOrFilters = hasLocations
    ? qual!.preferredLocations!.map((loc) => ({
        location: { contains: loc, mode: 'insensitive' as const },
      }))
    : null;

  // 1. Full match: location + type + budget
  if (locationOrFilters && hasType && hasBudget) {
    const p = await db.property.findFirst({
      where: { AND: [{ isAvailable: true }, typeFilter, budgetFilter, { OR: locationOrFilters }] },
    });
    if (p) return p;
  }

  // 2. Location + type (no budget constraint)
  if (locationOrFilters && hasType) {
    const p = await db.property.findFirst({
      where: { AND: [{ isAvailable: true }, typeFilter, { OR: locationOrFilters }] },
    });
    if (p) return p;
  }

  // 3. Type + budget (ignore location)
  if (hasType && hasBudget) {
    const p = await db.property.findFirst({
      where: { AND: [{ isAvailable: true }, typeFilter, budgetFilter] },
    });
    if (p) return p;
  }

  // 4. Type only
  if (hasType) {
    const p = await db.property.findFirst({ where: { isAvailable: true, ...typeFilter } });
    if (p) return p;
  }

  // 5. Any available property
  return db.property.findFirst({ where: { isAvailable: true } });
}

function formatDateTime(d: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const dow = days[d.getDay()] ?? '';
  const month = months[d.getMonth()] ?? '';
  const date = d.getDate();
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  return `${dow}, ${date} ${month} at ${timeStr}`;
}
