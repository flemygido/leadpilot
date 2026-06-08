import type { LeadClassification } from '@leadpilot/db';

export interface ScoringInput {
  intent?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  timeline?: string | null;
  propertyType?: string | null;
  bhk?: number | null;
  preferredLocations?: string[] | null;
  name?: string | null;
  financing?: string | null;
  preferredContactTime?: string | null;
}

/**
 * Deterministic 0–100 lead score per ADR-003.
 *
 * COMPLETENESS (30):
 *   name present=5, intent known=5, propertyType known=5, bhk=3, budget present=7, locations=5
 * TIMELINE_URGENCY (30):
 *   immediate=30, 1_3_months=20, 3_6_months=10, exploring=5
 * INTENT_CLARITY (20):
 *   buy=20, rent=10  — rental commission is ~5-10x lower than sale commission
 * FINANCING (10):
 *   cash=10, loan_preapproved=10, loan=5  — confirmed financing separates real buyers from window-shoppers
 * CONTACT_TIME (10):
 *   preferredContactTime present=10
 */
export function computeLeadScore(q: ScoringInput): number {
  let score = 0;

  // COMPLETENESS (max 30)
  if (q.name) score += 5;
  if (q.intent && q.intent !== 'unknown') score += 5;
  if (q.propertyType && q.propertyType !== 'unknown') score += 5;
  if (q.bhk != null && q.bhk > 0) score += 3;
  if ((q.budgetMin != null && q.budgetMin > 0) || (q.budgetMax != null && q.budgetMax > 0))
    score += 7;
  if (q.preferredLocations && q.preferredLocations.length > 0) score += 5;

  // TIMELINE_URGENCY (max 30)
  if (q.timeline === 'immediate') score += 30;
  else if (q.timeline === '1_3_months') score += 20;
  else if (q.timeline === '3_6_months') score += 10;
  else if (q.timeline === 'exploring') score += 5;

  // INTENT_CLARITY (max 20)
  // Rent earns 10 — rental commissions are far lower than sale commissions.
  // A rental HOT lead needs a score boost from timeline+financing to cross the HOT threshold.
  if (q.intent === 'buy') score += 20;
  else if (q.intent === 'rent') score += 10;

  // FINANCING (max 10)
  // Cash and pre-approved loan = 10 (can transact immediately).
  // Plain "loan" (no pre-approval confirmed) = 5 (still 30-60 days from closing).
  if (q.financing === 'cash' || q.financing === 'loan_preapproved') score += 10;
  else if (q.financing === 'loan') score += 5;

  // CONTACT_TIME (max 10)
  if (q.preferredContactTime) score += 10;

  return Math.min(100, score);
}

export function classifyLead(score: number): LeadClassification {
  if (score === 0) return 'UNSCORED';
  if (score >= 70) return 'HOT';
  return 'NURTURE';
}
