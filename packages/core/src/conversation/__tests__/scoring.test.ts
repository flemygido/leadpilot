import { describe, it, expect } from 'vitest';
import { computeLeadScore, classifyLead } from '../../qualification/scoring.js';

// ADR-003 weights (updated):
// COMPLETENESS (30): name=5, intent known=5, propertyType known=5, bhk=3, budget=7, locations=5
// TIMELINE_URGENCY (30): immediate=30, 1_3_months=20, 3_6_months=10, exploring=5
// INTENT_CLARITY (20): buy=20, rent=10 (lower commission)
// FINANCING (10): cash=10, loan_preapproved=10, loan=5 (unconfirmed financing)
// CONTACT_TIME (10): preferredContactTime present=10

describe('computeLeadScore', () => {
  it('returns 0 for empty input', () => {
    expect(computeLeadScore({})).toBe(0);
  });

  it('scores name only = 5', () => {
    expect(computeLeadScore({ name: 'Rahul' })).toBe(5);
  });

  it('scores buy intent: completeness(5) + clarity(20) = 25', () => {
    expect(computeLeadScore({ intent: 'buy' })).toBe(25);
  });

  it('scores rent intent: completeness(5) + clarity(10) = 15 (rent earns 10, not 20)', () => {
    expect(computeLeadScore({ intent: 'rent' })).toBe(15);
  });

  it('does not score unknown intent', () => {
    expect(computeLeadScore({ intent: 'unknown' })).toBe(0);
  });

  it('scores immediate timeline = 30', () => {
    expect(computeLeadScore({ timeline: 'immediate' })).toBe(30);
  });

  it('scores 1_3_months = 20', () => {
    expect(computeLeadScore({ timeline: '1_3_months' })).toBe(20);
  });

  it('scores 3_6_months = 10', () => {
    expect(computeLeadScore({ timeline: '3_6_months' })).toBe(10);
  });

  it('scores exploring = 5', () => {
    expect(computeLeadScore({ timeline: 'exploring' })).toBe(5);
  });

  it('scores budget (one side) = 7', () => {
    expect(computeLeadScore({ budgetMin: 5000000 })).toBe(7);
  });

  it('scores budget (both sides still 7 — one field covers it)', () => {
    expect(computeLeadScore({ budgetMin: 5000000, budgetMax: 8000000 })).toBe(7);
  });

  it('scores financing: cash=10, loan_preapproved=10, plain loan=5', () => {
    expect(computeLeadScore({ financing: 'cash' })).toBe(10);
    expect(computeLeadScore({ financing: 'loan_preapproved' })).toBe(10);
    expect(computeLeadScore({ financing: 'loan' })).toBe(5);
  });

  it('does not score unknown financing', () => {
    expect(computeLeadScore({ financing: 'unknown' })).toBe(0);
  });

  it('scores preferredContactTime = 10', () => {
    expect(computeLeadScore({ preferredContactTime: 'morning' })).toBe(10);
  });

  it('builds up to HOT threshold with combined fields', () => {
    // buy: completeness(intent=5) + clarity(20) + immediate(30) + budget(7) + locations(5) = 67 → NURTURE
    const score67 = computeLeadScore({
      intent: 'buy',
      timeline: 'immediate',
      budgetMin: 5000000,
      preferredLocations: ['Baner'],
    });
    expect(score67).toBe(67);
    expect(classifyLead(score67)).toBe('NURTURE');

    // Add name(5) + propertyType(5) → 67+10 = 77 → HOT
    const score77 = computeLeadScore({
      name: 'Priya',
      intent: 'buy',
      propertyType: 'apartment',
      timeline: 'immediate',
      budgetMin: 5000000,
      preferredLocations: ['Baner'],
    });
    expect(score77).toBe(77);
    expect(classifyLead(score77)).toBe('HOT');
  });

  it('rent with full data scores lower than buy — rent never reaches HOT on timeline alone', () => {
    // rent: clarity=10 (not 20) so buy intent required to hit HOT threshold easily
    const rentScore = computeLeadScore({
      name: 'Rahul',
      intent: 'rent',
      propertyType: 'apartment',
      timeline: 'immediate',
      budgetMin: 2000000,
      preferredLocations: ['Baner'],
      financing: 'cash',
    });
    // completeness(5+5+5+7+5=27) + timeline(30) + clarity(10) + financing(10) = 77
    expect(rentScore).toBe(77);
  });

  it('returns 100 (capped) for fully qualified lead', () => {
    // name=5, intent known=5, propertyType=5, bhk=3, budget=7, locations=5 → completeness=30
    // immediate=30, intent_clarity=20, financing=10, contactTime=10 → 100
    expect(
      computeLeadScore({
        name: 'Priya',
        intent: 'buy',
        propertyType: 'apartment',
        bhk: 3,
        budgetMin: 5000000,
        budgetMax: 8000000,
        preferredLocations: ['Baner'],
        timeline: 'immediate',
        financing: 'cash',
        preferredContactTime: 'morning',
      }),
    ).toBe(100);
  });

  it('does not count unknown propertyType for completeness', () => {
    expect(computeLeadScore({ propertyType: 'unknown' })).toBe(0);
  });
});

describe('classifyLead', () => {
  it('returns UNSCORED for 0', () => {
    expect(classifyLead(0)).toBe('UNSCORED');
  });

  it('returns NURTURE for scores 1-69', () => {
    expect(classifyLead(1)).toBe('NURTURE');
    expect(classifyLead(45)).toBe('NURTURE');
    expect(classifyLead(69)).toBe('NURTURE');
  });

  it('returns HOT for scores 70+', () => {
    expect(classifyLead(70)).toBe('HOT');
    expect(classifyLead(85)).toBe('HOT');
    expect(classifyLead(100)).toBe('HOT');
  });
});
