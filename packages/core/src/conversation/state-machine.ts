import type { LeadState } from '@leadpilot/db';

// ADR-010: HANDED_OFF reachable from any state. Terminal states have no outgoing transitions.
export const TRANSITIONS: Readonly<Record<LeadState, readonly LeadState[]>> = {
  NEW: ['GREETED', 'HANDED_OFF'],
  GREETED: ['QUALIFYING', 'HANDED_OFF'],
  QUALIFYING: ['QUALIFIED_HOT', 'QUALIFIED_COLD', 'NURTURING', 'HANDED_OFF'],
  QUALIFIED_HOT: ['VISIT_OFFERED', 'HANDED_OFF'],
  QUALIFIED_COLD: ['NURTURING', 'QUALIFYING', 'HANDED_OFF'],
  NURTURING: ['QUALIFYING', 'VISIT_OFFERED', 'CLOSED_LOST', 'HANDED_OFF'],
  VISIT_OFFERED: ['VISIT_SCHEDULED', 'NURTURING', 'CLOSED_LOST', 'HANDED_OFF'],
  VISIT_SCHEDULED: ['HANDED_OFF', 'CLOSED_LOST'],
  HANDED_OFF: ['CLOSED_WON', 'CLOSED_LOST'],
  CLOSED_WON: [],
  CLOSED_LOST: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly fromState: LeadState,
    public readonly toState: LeadState,
  ) {
    super(`Invalid transition: ${fromState} → ${toState}`);
    this.name = 'InvalidTransitionError';
  }
}

/** Validates a transition; throws InvalidTransitionError if not allowed. */
export function assertTransition(from: LeadState, to: LeadState): void {
  const allowed = TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/** Returns the allowed next states for a given state. */
export function allowedTransitions(from: LeadState): readonly LeadState[] {
  return TRANSITIONS[from];
}
