import { describe, it, expect } from 'vitest';
import {
  LeadState,
  LeadClassification,
  MessageRole,
  MessageDirection,
  FollowUpStatus,
  SiteVisitStatus,
  NotificationType,
} from '@prisma/client';

// Verifies that the Prisma-generated enums match the requirements in §5.3

describe('LeadState enum', () => {
  const requiredStates: string[] = [
    'NEW',
    'GREETED',
    'QUALIFYING',
    'QUALIFIED_HOT',
    'QUALIFIED_COLD',
    'NURTURING',
    'VISIT_OFFERED',
    'VISIT_SCHEDULED',
    'HANDED_OFF',
    'CLOSED_WON',
    'CLOSED_LOST',
  ];

  it('contains all states required by §5.3', () => {
    for (const state of requiredStates) {
      expect(LeadState).toHaveProperty(state);
    }
  });

  it('has exactly the states required (no extras)', () => {
    expect(Object.keys(LeadState)).toEqual(requiredStates);
  });
});

describe('LeadClassification enum', () => {
  it('contains HOT, NURTURE, UNSCORED', () => {
    expect(LeadClassification).toHaveProperty('HOT');
    expect(LeadClassification).toHaveProperty('NURTURE');
    expect(LeadClassification).toHaveProperty('UNSCORED');
  });
});

describe('MessageRole enum', () => {
  it('contains all required roles', () => {
    expect(MessageRole).toHaveProperty('lead');
    expect(MessageRole).toHaveProperty('assistant');
    expect(MessageRole).toHaveProperty('agent');
    expect(MessageRole).toHaveProperty('system');
  });
});

describe('MessageDirection enum', () => {
  it('contains inbound and outbound', () => {
    expect(MessageDirection).toHaveProperty('inbound');
    expect(MessageDirection).toHaveProperty('outbound');
  });
});

describe('FollowUpStatus enum', () => {
  it('contains all lifecycle states', () => {
    expect(FollowUpStatus).toHaveProperty('pending');
    expect(FollowUpStatus).toHaveProperty('sent');
    expect(FollowUpStatus).toHaveProperty('skipped');
    expect(FollowUpStatus).toHaveProperty('failed');
  });
});

describe('SiteVisitStatus enum', () => {
  it('contains all visit states', () => {
    expect(SiteVisitStatus).toHaveProperty('offered');
    expect(SiteVisitStatus).toHaveProperty('confirmed');
    expect(SiteVisitStatus).toHaveProperty('cancelled');
    expect(SiteVisitStatus).toHaveProperty('completed');
  });
});

describe('NotificationType enum', () => {
  it('contains all notification types', () => {
    expect(NotificationType).toHaveProperty('hot_lead');
    expect(NotificationType).toHaveProperty('handoff');
    expect(NotificationType).toHaveProperty('daily_summary');
    expect(NotificationType).toHaveProperty('site_visit_booked');
  });
});

describe('packages/db exports', () => {
  it('re-exports all required items from index', async () => {
    const dbModule = await import('../index.js');
    expect(dbModule).toHaveProperty('prisma');
    expect(dbModule).toHaveProperty('LeadState');
    expect(dbModule).toHaveProperty('LeadClassification');
    expect(dbModule).toHaveProperty('MessageRole');
    expect(dbModule).toHaveProperty('MessageDirection');
    expect(dbModule).toHaveProperty('FollowUpStatus');
    expect(dbModule).toHaveProperty('SiteVisitStatus');
    expect(dbModule).toHaveProperty('NotificationType');
  });
});
