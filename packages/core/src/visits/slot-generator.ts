import type { PrismaClient } from '@prisma/client';

export interface Slot {
  scheduledAt: Date;
  label: string; // "Saturday, 14 Jun at 9:00 AM"
}

/**
 * Generate the next N available visit slots for an agent.
 * Looks up AgentAvailability records and produces concrete DateTimes
 * within the next 14 days, skipping today.
 */
export async function generateAvailableSlots(
  agentId: string,
  db: PrismaClient,
  count = 3,
): Promise<Slot[]> {
  const availabilities = await db.agentAvailability.findMany({
    where: { agentId },
    orderBy: { dayOfWeek: 'asc' },
  });

  if (availabilities.length === 0) return defaultSlots(count);

  // Map dayOfWeek → [startTime, …]
  const byDay = new Map<number, string[]>();
  for (const av of availabilities) {
    const existing = byDay.get(av.dayOfWeek) ?? [];
    // Offer start-time AND midpoint of the window
    existing.push(av.startTime);
    const mid = midpointTime(av.startTime, av.endTime);
    if (mid !== av.startTime) existing.push(mid);
    byDay.set(av.dayOfWeek, existing);
  }

  const slots: Slot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let daysAhead = 1; daysAhead <= 14 && slots.length < count; daysAhead++) {
    const day = new Date(today.getTime() + daysAhead * 86_400_000);
    const dow = day.getDay();
    const times = byDay.get(dow);
    if (!times) continue;

    for (const timeStr of times) {
      if (slots.length >= count) break;
      const [hh, mm] = timeStr.split(':').map(Number);
      const slotDate = new Date(day);
      slotDate.setHours(hh ?? 9, mm ?? 0, 0, 0);
      slots.push({ scheduledAt: slotDate, label: formatSlot(slotDate) });
    }
  }

  // Fall back to defaults if no availability found in window
  return slots.length > 0 ? slots : defaultSlots(count);
}

function midpointTime(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = (sh ?? 9) * 60 + (sm ?? 0);
  const endMins = (eh ?? 18) * 60 + (em ?? 0);
  const mid = Math.floor((startMins + endMins) / 2);
  const h = Math.floor(mid / 60);
  const m = mid % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatSlot(d: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const dow = days[d.getDay()] ?? '';
  const month = months[d.getMonth()] ?? '';
  const date = d.getDate();
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  return `${dow}, ${date} ${month} at ${timeStr}`;
}

/**
 * Fallback when no AgentAvailability is configured.
 * Prioritises weekends (Saturday=10 AM, Sunday=11 AM) since those are peak
 * site-visit days in Indian RE, then fills remaining slots from weekday mornings.
 */
function defaultSlots(count: number): Slot[] {
  const slots: Slot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Weekend slots first (higher priority)
  for (let d = 1; d <= 14 && slots.length < count; d++) {
    const day = new Date(today.getTime() + d * 86_400_000);
    const dow = day.getDay();
    if (dow !== 6 && dow !== 0) continue; // only weekends
    const hour = dow === 6 ? 10 : 11; // Saturday 10 AM, Sunday 11 AM
    day.setHours(hour, 0, 0, 0);
    slots.push({ scheduledAt: new Date(day), label: formatSlot(day) });
  }

  // Fill remaining with weekday mornings
  for (let d = 1; d <= 21 && slots.length < count; d++) {
    const day = new Date(today.getTime() + d * 86_400_000);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    day.setHours(10, 0, 0, 0);
    slots.push({ scheduledAt: new Date(day), label: formatSlot(day) });
  }

  // Sort chronologically
  slots.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return slots.slice(0, count);
}
