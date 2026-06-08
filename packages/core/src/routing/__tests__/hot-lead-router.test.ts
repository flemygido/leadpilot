import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HotLeadRouter } from '../hot-lead-router.js';

const logger = {
  child: vi.fn().mockReturnThis(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const agent = { id: 'agent-1', name: 'Ravi', phone: '+919876543210' };
const lead = {
  id: 'lead-1',
  phone: '+911234567890',
  name: 'Priya',
  score: 77,
  classification: 'HOT',
  agentId: 'agent-1',
  agent,
  qualificationResult: {
    intent: 'buy',
    propertyType: 'apartment',
    bhk: 3,
    budgetMin: 5000000,
    budgetMax: 8000000,
    preferredLocations: ['Baner'],
    timeline: 'immediate',
    financing: 'cash',
  },
};

function buildDb(agentLead: object | null = null) {
  return {
    lead: {
      findUnique: vi.fn().mockResolvedValue(lead),
      findFirst: vi.fn().mockResolvedValue(agentLead),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
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

describe('HotLeadRouter.notifyAgent', () => {
  let db: ReturnType<typeof buildDb>;
  let whatsapp: ReturnType<typeof buildWhatsApp>;
  let router: HotLeadRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildDb();
    whatsapp = buildWhatsApp();
    router = new HotLeadRouter({
      db: db as never,
      whatsapp: whatsapp as never,
      logger: logger as never,
    });
  });

  it('creates a notification record', async () => {
    await router.notifyAgent('lead-1');
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentId: 'agent-1',
          leadId: 'lead-1',
          type: 'hot_lead',
        }),
      }),
    );
  });

  it('notification body includes lead name and score', async () => {
    await router.notifyAgent('lead-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (
      (db.notification.create as ReturnType<typeof vi.fn>).mock.calls[0] as any[]
    )[0] as { data: { body: string } };
    expect(call.data.body).toContain('Priya');
    expect(call.data.body).toContain('77/100');
  });

  it('sends WhatsApp to agent if agent has a lead record', async () => {
    const agentLeadRecord = { id: 'al-1', phone: '+919876543210' };
    db = buildDb(agentLeadRecord);
    router = new HotLeadRouter({
      db: db as never,
      whatsapp: whatsapp as never,
      logger: logger as never,
    });
    await router.notifyAgent('lead-1');
    expect(whatsapp.sendMessage).toHaveBeenCalledWith(
      agent.phone,
      expect.stringContaining('HOT LEAD'),
      agentLeadRecord,
    );
  });

  it('skips WhatsApp but still creates notification when agent has no lead record', async () => {
    db = buildDb(null); // agent has no lead record
    router = new HotLeadRouter({
      db: db as never,
      whatsapp: whatsapp as never,
      logger: logger as never,
    });
    await router.notifyAgent('lead-1');
    expect(db.notification.create).toHaveBeenCalled();
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it('creates notification even if WhatsApp send fails', async () => {
    const agentLeadRecord = { id: 'al-1', phone: '+919876543210' };
    db = buildDb(agentLeadRecord);
    whatsapp.sendMessage = vi.fn().mockRejectedValue(new Error('WA error'));
    router = new HotLeadRouter({
      db: db as never,
      whatsapp: whatsapp as never,
      logger: logger as never,
    });
    await router.notifyAgent('lead-1');
    expect(db.notification.create).toHaveBeenCalled();
  });

  it('returns early if lead not found', async () => {
    db.lead.findUnique = vi.fn().mockResolvedValue(null);
    await router.notifyAgent('bad-id');
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});
