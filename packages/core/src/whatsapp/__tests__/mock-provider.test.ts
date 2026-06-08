import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockWhatsAppProvider } from '../mock-provider.js';
import { ConsentError } from '../consent.js';
import type { Lead, PrismaClient } from '@leadpilot/db';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead_test',
    agentId: 'agent_1',
    phone: '+911234567890',
    name: 'Test Lead',
    state: 'NEW',
    classification: 'UNSCORED',
    score: 0,
    aiPaused: false,
    consent: true,
    consentSource: 'inbound_message',
    consentAt: new Date(),
    lastInboundAt: new Date(), // within 24h window
    source: 'inbound',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Lead;
}

function makeMockDb() {
  const messageCreate = vi.fn().mockResolvedValue({ id: 'msg_1' });
  const conversationFindUnique = vi.fn().mockResolvedValue({ id: 'conv_1', leadId: 'lead_test' });

  return {
    conversation: { findUnique: conversationFindUnique },
    message: { create: messageCreate },
    _messageCreate: messageCreate,
    _conversationFindUnique: conversationFindUnique,
  } as unknown as PrismaClient & {
    _messageCreate: ReturnType<typeof vi.fn>;
    _conversationFindUnique: ReturnType<typeof vi.fn>;
  };
}

function makeMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('MockWhatsAppProvider', () => {
  let db: ReturnType<typeof makeMockDb>;
  let logger: ReturnType<typeof makeMockLogger>;
  let provider: MockWhatsAppProvider;

  beforeEach(() => {
    db = makeMockDb();
    logger = makeMockLogger();
    provider = new MockWhatsAppProvider(db, logger);
  });

  it('has name "mock"', () => {
    expect(provider.name).toBe('mock');
  });

  describe('sendMessage', () => {
    it('does NOT write to DB (engine persists outbound messages at step 16)', async () => {
      const lead = makeLead();
      await provider.sendMessage('+911234567890', 'Hello!', lead);
      expect(db._messageCreate).not.toHaveBeenCalled();
    });

    it('logs the outbound message via logger.info', async () => {
      const lead = makeLead();
      await provider.sendMessage('+911234567890', 'Hello!', lead);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+911234567890', body: 'Hello!' }),
        expect.stringContaining('OUTBOUND'),
      );
    });

    it('throws ConsentError when isProactive=true and consent=false', async () => {
      const lead = makeLead({ consent: false });
      await expect(
        provider.sendMessage('+911234567890', 'Nudge!', lead, { isProactive: true }),
      ).rejects.toThrow(ConsentError);
    });

    it('does NOT throw for reply (isProactive=false) even when consent=false', async () => {
      const lead = makeLead({ consent: false });
      await expect(
        provider.sendMessage('+911234567890', 'Reply!', lead, { isProactive: false }),
      ).resolves.not.toThrow();
    });

    it('warns when sending proactive message outside 24h window', async () => {
      const lead = makeLead({
        lastInboundAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
      });
      await provider.sendMessage('+911234567890', 'Nudge!', lead, { isProactive: true });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: 'lead_test' }),
        expect.stringContaining('24h window'),
      );
    });

    it('does NOT warn when sending within 24h window', async () => {
      const lead = makeLead({ lastInboundAt: new Date() }); // just now
      await provider.sendMessage('+911234567890', 'Hello!', lead, { isProactive: true });
      expect(logger.warn).not.toHaveBeenCalled();
    });

  });

  describe('parseInboundWebhook', () => {
    it('returns ParsedInboundMessage for valid mock payload', () => {
      const result = provider.parseInboundWebhook({ from: '+919876543210', body: 'Hello!' });
      expect(result).not.toBeNull();
      expect(result?.from).toBe('+919876543210');
      expect(result?.body).toBe('Hello!');
      expect(result?.timestamp).toBeInstanceOf(Date);
    });

    it('returns null for missing "from" field', () => {
      expect(provider.parseInboundWebhook({ body: 'Hello!' })).toBeNull();
    });

    it('returns null for missing "body" field', () => {
      expect(provider.parseInboundWebhook({ from: '+91xxx' })).toBeNull();
    });

    it('returns null for null input', () => {
      expect(provider.parseInboundWebhook(null)).toBeNull();
    });

    it('returns null for non-object input', () => {
      expect(provider.parseInboundWebhook('not an object')).toBeNull();
    });

    it('returns null for empty object', () => {
      expect(provider.parseInboundWebhook({})).toBeNull();
    });

    it('includes a providerMessageId starting with "mock_"', () => {
      const result = provider.parseInboundWebhook({ from: '+91x', body: 'hi' });
      expect(result?.providerMessageId).toMatch(/^mock_/);
    });
  });
});
