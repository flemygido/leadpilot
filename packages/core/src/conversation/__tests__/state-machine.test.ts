import { describe, it, expect } from 'vitest';
import {
  assertTransition,
  allowedTransitions,
  InvalidTransitionError,
  TRANSITIONS,
} from '../state-machine.js';

describe('TRANSITIONS map', () => {
  it('covers all 11 states', () => {
    const states = Object.keys(TRANSITIONS);
    expect(states).toHaveLength(11);
  });

  it('HANDED_OFF is reachable from every non-terminal state', () => {
    const nonTerminal = [
      'NEW',
      'GREETED',
      'QUALIFYING',
      'QUALIFIED_HOT',
      'QUALIFIED_COLD',
      'NURTURING',
      'VISIT_OFFERED',
      'VISIT_SCHEDULED',
    ];
    for (const state of nonTerminal) {
      expect(TRANSITIONS[state as keyof typeof TRANSITIONS]).toContain('HANDED_OFF');
    }
  });

  it('terminal states have no outgoing transitions', () => {
    expect(TRANSITIONS.CLOSED_WON).toHaveLength(0);
    expect(TRANSITIONS.CLOSED_LOST).toHaveLength(0);
  });
});

describe('assertTransition', () => {
  it('does not throw for valid transitions', () => {
    expect(() => assertTransition('NEW', 'GREETED')).not.toThrow();
    expect(() => assertTransition('GREETED', 'QUALIFYING')).not.toThrow();
    expect(() => assertTransition('QUALIFYING', 'QUALIFIED_HOT')).not.toThrow();
    expect(() => assertTransition('QUALIFYING', 'QUALIFIED_COLD')).not.toThrow();
    expect(() => assertTransition('QUALIFIED_HOT', 'VISIT_OFFERED')).not.toThrow();
    expect(() => assertTransition('VISIT_OFFERED', 'VISIT_SCHEDULED')).not.toThrow();
    expect(() => assertTransition('VISIT_SCHEDULED', 'HANDED_OFF')).not.toThrow();
    expect(() => assertTransition('HANDED_OFF', 'CLOSED_WON')).not.toThrow();
    expect(() => assertTransition('HANDED_OFF', 'CLOSED_LOST')).not.toThrow();
  });

  it('throws InvalidTransitionError for invalid transitions', () => {
    expect(() => assertTransition('NEW', 'QUALIFIED_HOT')).toThrow(InvalidTransitionError);
    expect(() => assertTransition('CLOSED_WON', 'GREETED')).toThrow(InvalidTransitionError);
    expect(() => assertTransition('CLOSED_LOST', 'NEW')).toThrow(InvalidTransitionError);
    expect(() => assertTransition('VISIT_SCHEDULED', 'QUALIFYING')).toThrow(InvalidTransitionError);
  });

  it('error message contains from and to states', () => {
    let caught: InvalidTransitionError | null = null;
    try {
      assertTransition('NEW', 'QUALIFIED_HOT');
    } catch (e) {
      caught = e as InvalidTransitionError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('NEW');
    expect(caught!.message).toContain('QUALIFIED_HOT');
    expect(caught!.fromState).toBe('NEW');
    expect(caught!.toState).toBe('QUALIFIED_HOT');
  });

  it('HANDED_OFF reachable from all non-terminal states via assertTransition', () => {
    const nonTerminal = [
      'NEW',
      'GREETED',
      'QUALIFYING',
      'QUALIFIED_HOT',
      'QUALIFIED_COLD',
      'NURTURING',
      'VISIT_OFFERED',
      'VISIT_SCHEDULED',
    ] as const;
    for (const state of nonTerminal) {
      expect(() => assertTransition(state, 'HANDED_OFF')).not.toThrow();
    }
  });
});

describe('allowedTransitions', () => {
  it('returns correct next states for NEW', () => {
    expect(allowedTransitions('NEW')).toEqual(['GREETED', 'HANDED_OFF']);
  });

  it('returns empty for terminal states', () => {
    expect(allowedTransitions('CLOSED_WON')).toHaveLength(0);
    expect(allowedTransitions('CLOSED_LOST')).toHaveLength(0);
  });
});
