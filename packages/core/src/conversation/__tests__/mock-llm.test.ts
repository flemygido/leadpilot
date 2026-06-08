import { describe, it, expect } from 'vitest';
import { MockLLM } from '../../llm/mock-llm.js';

const mockLlm = new MockLLM();

const baseContext = {
  id: 'lead-1',
  name: null,
  state: 'NEW' as const,
  phone: '+911234567890',
};

describe('MockLLM', () => {
  it('has name="mock"', () => {
    expect(mockLlm.name).toBe('mock');
  });

  it('is deterministic — same input returns same output', async () => {
    const params = {
      leadContext: baseContext,
      history: [],
      incomingMessage: 'I want to buy a 3 BHK apartment',
    };
    const r1 = await mockLlm.call(params);
    const r2 = await mockLlm.call(params);
    expect(r1.reply).toBe(r2.reply);
    expect(r1.nextAction).toBe(r2.nextAction);
  });

  it('extracts intent=buy', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'I want to buy a flat',
    });
    expect(r.qualificationUpdate.intent).toBe('buy');
  });

  it('extracts intent=rent', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'Looking to rent a place',
    });
    expect(r.qualificationUpdate.intent).toBe('rent');
  });

  it('extracts propertyType=apartment from "flat"', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'need a 2 BHK flat',
    });
    expect(r.qualificationUpdate.propertyType).toBe('apartment');
  });

  it('extracts propertyType=villa', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'looking for a villa',
    });
    expect(r.qualificationUpdate.propertyType).toBe('villa');
  });

  it('extracts bhk from message', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: '3 BHK apartment in Pune',
    });
    expect(r.qualificationUpdate.bhk).toBe(3);
  });

  it('returns handoff nextAction when user asks to speak to an agent', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'I want to speak to a human agent',
    });
    expect(r.nextAction).toBe('handoff');
  });

  it('returns close_lost when user says not interested', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'not interested, stop messaging me',
    });
    expect(r.nextAction).toBe('close_lost');
  });

  it('returns offer_visit when fully qualified with immediate timeline', async () => {
    const r = await mockLlm.call({
      leadContext: { ...baseContext, state: 'QUALIFYING' },
      history: [],
      incomingMessage: 'I want to buy an apartment immediate timeline budget 80 lakh',
    });
    expect(r.nextAction).toBe('offer_visit');
  });

  it('extracts name from "my name is Rahul"', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'Hi, my name is Rahul',
    });
    expect(r.qualificationUpdate.name).toBe('Rahul');
  });

  it('returns a non-empty reply', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'Hello',
    });
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it('extracts crore budget', async () => {
    const r = await mockLlm.call({
      leadContext: baseContext,
      history: [],
      incomingMessage: 'my budget is 1.5 crore',
    });
    expect(r.qualificationUpdate.budgetMin).toBeCloseTo(13_500_000, 0); // 1.5Cr * 0.9 in rupees
    expect(r.qualificationUpdate.budgetMax).toBeCloseTo(16_500_000, 0); // 1.5Cr * 1.1 in rupees
  });
});
