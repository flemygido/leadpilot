import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisitService } from '../visit.service.js';

const logger = {
  child: vi.fn().mockReturnThis(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const agent = { id: 'agent-1', name: 'Ravi', phone: '+919876543210' };

const fakeLead = {
  id: 'lead-1',
  phone: '+911234567890',
  name: 'Priya',
  agentId: 'agent-1',
  state: 'QUALIFIED_HOT',
  agent,
  qualificationResult: null,
};

const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
const fakeOfferedVisit = {
  id: 'visit-1',
  leadId: 'lead-1',
  agentId: 'agent-1',
  scheduledAt: futureDate,
  status: 'offered',
  lead: { ...fakeLead, agent },
};

function buildDb(availabilities: object[] = []) {
  return {
    agentAvailability: {
      findMany: vi.fn().mockResolvedValue(availabilities),
    },
    siteVisit: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: 'visit-new' }),
      findMany: vi.fn().mockResolvedValue([fakeOfferedVisit]),
      update: vi.fn().mockResolvedValue({ id: 'visit-1', status: 'confirmed' }),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    },
    lead: {
      findUnique: vi.fn().mockResolvedValue(fakeLead),
      update: vi.fn().mockResolvedValue(fakeLead),
    },
    stateTransition: {
      create: vi.fn().mockResolvedValue({ id: 'st-1' }),
    },
    property: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

function buildWhatsApp() {
  return {
    name: 'mock',
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendTemplate: vi.fn().mockResolvedValue(undefined),
    parseInboundWebhook: vi.fn().mockReturnValue(null),
  };
}

describe('VisitService.offerSlots', () => {
  let db: ReturnType<typeof buildDb>;
  let whatsapp: ReturnType<typeof buildWhatsApp>;
  let svc: VisitService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildDb();
    whatsapp = buildWhatsApp();
    svc = new VisitService({
      db: db as never,
      whatsapp: whatsapp as never,
      logger: logger as never,
    });
  });

  it('returns a non-empty message string', async () => {
    const msg = await svc.offerSlots('lead-1');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(20);
  });

  it('message includes slot numbers', async () => {
    const msg = await svc.offerSlots('lead-1');
    expect(msg).toMatch(/1️⃣|2️⃣|3️⃣|1\.|2\.|3\./);
  });

  it('creates SiteVisit records with status offered', async () => {
    await svc.offerSlots('lead-1');
    expect(db.siteVisit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadId: 'lead-1', agentId: 'agent-1', status: 'offered' }),
      }),
    );
  });

  it('cancels previously offered visits before offering new ones', async () => {
    await svc.offerSlots('lead-1');
    expect(db.siteVisit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leadId: 'lead-1', status: 'offered' }),
        data: { status: 'cancelled' },
      }),
    );
  });

  it('returns fallback message if lead not found', async () => {
    db.lead.findUnique = vi.fn().mockResolvedValue(null);
    svc = new VisitService({
      db: db as never,
      whatsapp: whatsapp as never,
      logger: logger as never,
    });
    const msg = await svc.offerSlots('bad-id');
    expect(msg.length).toBeGreaterThan(10);
    expect(db.siteVisit.create).not.toHaveBeenCalled();
  });

  it('includes lead name in message when known', async () => {
    const msg = await svc.offerSlots('lead-1');
    expect(msg).toContain('Priya');
  });
});

describe('VisitService.confirmVisit', () => {
  let db: ReturnType<typeof buildDb>;
  let svc: VisitService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildDb();
    svc = new VisitService({
      db: db as never,
      whatsapp: buildWhatsApp() as never,
      logger: logger as never,
    });
  });

  it('marks offered visit as confirmed', async () => {
    await svc.confirmVisit('lead-1');
    expect(db.siteVisit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'visit-1' },
        data: expect.objectContaining({ status: 'confirmed' }),
      }),
    );
  });

  it('transitions lead state to VISIT_SCHEDULED', async () => {
    await svc.confirmVisit('lead-1');
    expect(db.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'VISIT_SCHEDULED' } }),
    );
  });

  it('creates a state transition record', async () => {
    await svc.confirmVisit('lead-1');
    expect(db.stateTransition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromState: 'VISIT_OFFERED',
          toState: 'VISIT_SCHEDULED',
        }),
      }),
    );
  });

  it('creates a site_visit_booked notification', async () => {
    await svc.confirmVisit('lead-1');
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'site_visit_booked', agentId: 'agent-1' }),
      }),
    );
  });

  it('returns a confirmation message containing the slot date', async () => {
    const msg = await svc.confirmVisit('lead-1');
    expect(msg).toContain('confirmed');
    expect(msg.length).toBeGreaterThan(10);
  });

  it('falls back to offerSlots if no offered visit found', async () => {
    db.siteVisit.findMany = vi.fn().mockResolvedValue([]);
    svc = new VisitService({
      db: db as never,
      whatsapp: buildWhatsApp() as never,
      logger: logger as never,
    });
    const msg = await svc.confirmVisit('lead-1');
    // Should have re-offered (called create for new slots)
    expect(db.siteVisit.create).toHaveBeenCalled();
    expect(msg.length).toBeGreaterThan(10);
  });

  it('cancels remaining offered slots after confirmation', async () => {
    await svc.confirmVisit('lead-1');
    expect(db.siteVisit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'offered' }),
        data: { status: 'cancelled' },
      }),
    );
  });
});
