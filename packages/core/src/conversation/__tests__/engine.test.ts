import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { ConversationEngine } from '../engine.js';
import type { LLMClient, LLMResponse } from '../../llm/llm.interface.js';
import type { WhatsAppProvider } from '../../whatsapp/provider.interface.js';

// ─── Minimal Prisma mock ─────────────────────────────────────────────────────

// Most tests simulate a lead who has already granted consent, so the engine
// proceeds directly to the LLM. Consent-flow tests use consent: false explicitly.
const fakeLead = {
  id: 'lead-1',
  phone: '+911234567890',
  name: null,
  state: 'NEW',
  classification: 'UNSCORED',
  score: 0,
  aiPaused: false,
  consent: true,
  consentSource: 'explicit_optin',
  consentAt: new Date(),
  lastInboundAt: null,
  agentId: 'agent-1',
  source: 'inbound',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeConversation = {
  id: 'conv-1',
  leadId: 'lead-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildPrismaStub(overrides: Partial<typeof fakeLead> = {}) {
  const lead = { ...fakeLead, ...overrides };
  const updatedLead = { ...lead }; // returned after update

  return {
    lead: {
      findUnique: vi.fn().mockResolvedValue(lead),
      findUniqueOrThrow: vi.fn().mockResolvedValue(updatedLead),
      update: vi.fn().mockResolvedValue(updatedLead),
    },
    conversation: {
      findUnique: vi.fn().mockResolvedValue(fakeConversation),
      create: vi.fn().mockResolvedValue(fakeConversation),
    },
    message: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    },
    qualificationResult: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'qual-1' }),
      update: vi.fn().mockResolvedValue({ id: 'qual-1' }),
    },
    stateTransition: {
      create: vi.fn().mockResolvedValue({ id: 'st-1' }),
    },
  };
}

// ─── Mock LLM ────────────────────────────────────────────────────────────────

function buildLLMStub(response: LLMResponse): LLMClient {
  return {
    name: 'test-llm',
    call: vi.fn().mockResolvedValue(response) as LLMClient['call'],
  };
}

// ─── Mock WhatsApp ────────────────────────────────────────────────────────────

function buildWhatsAppStub(): WhatsAppProvider {
  return {
    name: 'test-wa',
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendTemplate: vi.fn().mockResolvedValue(undefined),
    parseInboundWebhook: vi.fn().mockReturnValue(null),
  };
}

// ─── Logger stub ──────────────────────────────────────────────────────────────

const logger = {
  child: vi.fn().mockReturnThis(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConversationEngine.process', () => {
  let db: ReturnType<typeof buildPrismaStub>;
  let llm: LLMClient;
  let whatsapp: WhatsAppProvider;
  let engine: ConversationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildPrismaStub();
    llm = buildLLMStub({
      reply: 'Hi there! Are you looking to buy or rent?',
      nextAction: 'continue',
      qualificationUpdate: {},
    });
    whatsapp = buildWhatsAppStub();
    engine = new ConversationEngine({ db: db as never, llm, whatsapp, logger: logger as never });
  });

  it('throws if lead not found', async () => {
    db.lead.findUnique.mockResolvedValue(null);
    await expect(engine.process('bad-id', 'hello')).rejects.toThrow('Lead not found');
  });

  it('returns early without calling LLM if aiPaused=true', async () => {
    db = buildPrismaStub({ aiPaused: true });
    engine = new ConversationEngine({ db: db as never, llm, whatsapp, logger: logger as never });
    await engine.process('lead-1', 'hello');
    expect(llm.call).not.toHaveBeenCalled();
  });

  it('creates conversation if none exists', async () => {
    db.conversation.findUnique.mockResolvedValue(null);
    await engine.process('lead-1', 'hello');
    expect(db.conversation.create).toHaveBeenCalledWith({ data: { leadId: 'lead-1' } });
  });

  it('persists inbound message', async () => {
    await engine.process('lead-1', 'hello');
    expect(db.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'lead', direction: 'inbound', body: 'hello' }),
      }),
    );
  });

  it('sends consent opt-in request and returns early when lead has no consent', async () => {
    db = buildPrismaStub({ consent: false });
    engine = new ConversationEngine({ db: db as never, llm, whatsapp, logger: logger as never });
    // Message is not an opt-in confirmation
    await engine.process('lead-1', 'I want to buy a flat');
    // LLM should NOT be called — we stop at the consent gate
    expect(llm.call).not.toHaveBeenCalled();
    // WhatsApp should have been called with the consent message
    expect(whatsapp.sendMessage).toHaveBeenCalledWith(
      '+911234567890',
      expect.stringContaining('YES'),
      expect.anything(),
    );
  });

  it('grants explicit consent when lead replies YES, then proceeds normally', async () => {
    db = buildPrismaStub({ consent: false });
    engine = new ConversationEngine({ db: db as never, llm, whatsapp, logger: logger as never });
    await engine.process('lead-1', 'YES');
    // Consent should be written
    expect(db.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consent: true, consentSource: 'explicit_optin' }),
      }),
    );
    // LLM should be called after consent granted
    expect(llm.call).toHaveBeenCalled();
  });

  it('calls LLM with correct params', async () => {
    await engine.process('lead-1', 'I want to buy a flat');
    expect(llm.call).toHaveBeenCalledWith(
      expect.objectContaining({
        incomingMessage: 'I want to buy a flat',
        leadContext: expect.objectContaining({ id: 'lead-1' }),
      }),
    );
  });

  it('transitions NEW→GREETED on nextAction=continue', async () => {
    await engine.process('lead-1', 'hello');
    expect(db.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'GREETED' }),
      }),
    );
  });

  it('transitions to HANDED_OFF on nextAction=handoff', async () => {
    llm = buildLLMStub({
      reply: 'Connecting you now',
      nextAction: 'handoff',
      qualificationUpdate: {},
    });
    engine = new ConversationEngine({ db: db as never, llm, whatsapp, logger: logger as never });
    await engine.process('lead-1', 'speak to agent');
    const calls = (db.lead.update as Mock).mock.calls;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastStateUpdate = (calls[calls.length - 1] as any[])[0] as {
      data: Record<string, unknown>;
    };
    expect(lastStateUpdate.data['state']).toBe('HANDED_OFF');
  });

  it('sends WhatsApp message with LLM reply', async () => {
    await engine.process('lead-1', 'hello');
    expect(whatsapp.sendMessage).toHaveBeenCalledWith(
      '+911234567890',
      'Hi there! Are you looking to buy or rent?',
      expect.any(Object),
    );
  });

  it('continues gracefully when LLM throws', async () => {
    (llm.call as Mock).mockRejectedValue(new Error('LLM timeout'));
    await expect(engine.process('lead-1', 'hello')).resolves.toBeUndefined();
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it('continues gracefully when WhatsApp send fails', async () => {
    (whatsapp.sendMessage as Mock).mockRejectedValue(new Error('WA error'));
    await expect(engine.process('lead-1', 'hello')).resolves.toBeUndefined();
  });

  it('upserts qualification when update has data', async () => {
    llm = buildLLMStub({
      reply: 'Thanks!',
      nextAction: 'qualify',
      qualificationUpdate: { intent: 'buy', propertyType: 'apartment' },
    });
    engine = new ConversationEngine({ db: db as never, llm, whatsapp, logger: logger as never });
    await engine.process('lead-1', 'buying an apartment');
    expect(db.qualificationResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ intent: 'buy', propertyType: 'apartment' }),
      }),
    );
  });

  it('updates name from qualificationUpdate if lead has no name', async () => {
    llm = buildLLMStub({
      reply: 'Nice to meet you!',
      nextAction: 'continue',
      qualificationUpdate: { name: 'Priya' },
    });
    engine = new ConversationEngine({ db: db as never, llm, whatsapp, logger: logger as never });
    await engine.process('lead-1', 'my name is Priya');
    const calls = (db.lead.update as Mock).mock.calls;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastStateUpdate = (calls[calls.length - 1] as any[])[0] as {
      data: Record<string, unknown>;
    };
    expect(lastStateUpdate.data['name']).toBe('Priya');
  });
});
