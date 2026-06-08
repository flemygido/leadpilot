import { describe, it, expect } from 'vitest';
import { assertConsent, isWithin24hWindow, ConsentError } from '../consent.js';
import type { Lead } from '@leadpilot/db';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead_test',
    agentId: 'agent_1',
    phone: '+911234567890',
    name: null,
    state: 'NEW',
    classification: 'UNSCORED',
    score: 0,
    aiPaused: false,
    consent: false,
    consentSource: null,
    consentAt: null,
    lastInboundAt: null,
    source: 'inbound',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Lead;
}

describe('assertConsent', () => {
  it('throws ConsentError when consent is false', () => {
    const lead = makeLead({ consent: false });
    expect(() => assertConsent(lead)).toThrow(ConsentError);
  });

  it('does not throw when consent is true', () => {
    const lead = makeLead({ consent: true });
    expect(() => assertConsent(lead)).not.toThrow();
  });

  it('ConsentError message includes lead id', () => {
    const lead = makeLead({ id: 'lead_abc', consent: false });
    expect(() => assertConsent(lead)).toThrowError(/lead_abc/);
  });
});

describe('isWithin24hWindow', () => {
  it('returns false when lastInboundAt is null', () => {
    expect(isWithin24hWindow(makeLead({ lastInboundAt: null }))).toBe(false);
  });

  it('returns true when lastInboundAt is within 24 hours', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    expect(isWithin24hWindow(makeLead({ lastInboundAt: recent }))).toBe(true);
  });

  it('returns true for lastInboundAt exactly at boundary (23:59)', () => {
    const almostExpired = new Date(Date.now() - (24 * 60 * 60 * 1000 - 60000)); // 23h59m ago
    expect(isWithin24hWindow(makeLead({ lastInboundAt: almostExpired }))).toBe(true);
  });

  it('returns false when lastInboundAt is older than 24 hours', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    expect(isWithin24hWindow(makeLead({ lastInboundAt: old }))).toBe(false);
  });
});
