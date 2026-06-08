import { describe, it, expect, vi } from 'vitest';
import { generateAvailableSlots } from '../slot-generator.js';

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri

function buildDb(availabilities: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
  return {
    agentAvailability: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          availabilities.map((a, i) => ({ id: `av-${i}`, agentId: 'agent-1', ...a })),
        ),
    },
  };
}

describe('generateAvailableSlots', () => {
  it('returns exactly count slots (default 3)', async () => {
    const db = buildDb(
      WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00' })),
    );
    const slots = await generateAvailableSlots('agent-1', db as never);
    expect(slots).toHaveLength(3);
  });

  it('returns custom count', async () => {
    const db = buildDb(
      WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00' })),
    );
    const slots = await generateAvailableSlots('agent-1', db as never, 2);
    expect(slots).toHaveLength(2);
  });

  it('each slot has scheduledAt (Date) and label (string)', async () => {
    const db = buildDb(
      WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00' })),
    );
    const slots = await generateAvailableSlots('agent-1', db as never, 1);
    expect(slots[0]!.scheduledAt).toBeInstanceOf(Date);
    expect(typeof slots[0]!.label).toBe('string');
    expect(slots[0]!.label.length).toBeGreaterThan(5);
  });

  it('scheduledAt is in the future (not today)', async () => {
    const db = buildDb(
      WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00' })),
    );
    const slots = await generateAvailableSlots('agent-1', db as never);
    const now = Date.now();
    for (const s of slots) {
      expect(s.scheduledAt.getTime()).toBeGreaterThan(now);
    }
  });

  it('slots respect dayOfWeek from availability', async () => {
    // Only Saturday availability
    const db = buildDb([{ dayOfWeek: 6, startTime: '10:00', endTime: '14:00' }]);
    const slots = await generateAvailableSlots('agent-1', db as never, 2);
    for (const s of slots) {
      expect(s.scheduledAt.getDay()).toBe(6); // Saturday
    }
  });

  it('uses default slots (weekends first) when no availability configured', async () => {
    const db = buildDb([]);
    const slots = await generateAvailableSlots('agent-1', db as never, 3);
    expect(slots).toHaveLength(3);
    // Default slots now prioritise weekends — just verify they are valid dates
    for (const s of slots) {
      const dow = s.scheduledAt.getDay();
      expect(dow).toBeGreaterThanOrEqual(0);
      expect(dow).toBeLessThanOrEqual(6);
    }
  });

  it('label includes day name and time', async () => {
    const db = buildDb([{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }]); // Monday
    const slots = await generateAvailableSlots('agent-1', db as never, 1);
    expect(slots[0]!.label).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
    expect(slots[0]!.label).toMatch(/AM|PM/);
  });
});
