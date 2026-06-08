'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dayName } from '@/lib/format';
import type { AgentDetail, AgentAvailability } from '@/lib/types';

interface Props {
  agent: AgentDetail;
}

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const PROXY = '/api/proxy';

export function AvailabilityManager({ agent: initialAgent }: Props) {
  const [agent, setAgent] = useState(initialAgent);
  const [showForm, setShowForm] = useState(false);
  const [formDay, setFormDay] = useState(1);
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('18:00');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const slotsByDay = DAYS.reduce<Record<number, AgentAvailability[]>>((acc, d) => {
    acc[d] = agent.availabilities.filter((a) => a.dayOfWeek === d);
    return acc;
  }, {});

  function addSlot() {
    if (formStart >= formEnd) {
      setError('End time must be after start time.');
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        const res = await fetch(`${PROXY}/api/agents/${agent.id}/availability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayOfWeek: formDay, startTime: formStart, endTime: formEnd }),
        });
        if (!res.ok) throw new Error(await res.text());
        const slot = (await res.json()) as AgentAvailability;
        setAgent((prev) => ({
          ...prev,
          availabilities: [...prev.availabilities, slot].sort(
            (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
          ),
        }));
        setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add slot');
      }
    });
  }

  function deleteSlot(slotId: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`${PROXY}/api/agents/${agent.id}/availability/${slotId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(await res.text());
        setAgent((prev) => ({
          ...prev,
          availabilities: prev.availabilities.filter((a) => a.id !== slotId),
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete slot');
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Availability Schedule</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            The AI uses this schedule to generate site visit time slots for customers.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus size={14} />
          Add Slot
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Add slot form */}
      {showForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-5">
          <p className="text-xs font-semibold text-blue-700 mb-3">Add Availability Slot</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Day</label>
              <select
                className={INPUT}
                value={formDay}
                onChange={(e) => setFormDay(Number(e.target.value))}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{dayName(d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">From</label>
              <input
                type="time"
                className={INPUT}
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">To</label>
              <input
                type="time"
                className={INPUT}
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
              />
            </div>
            <Button variant="primary" size="sm" onClick={addSlot} disabled={isPending}>
              {isPending ? '…' : 'Add'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Slots by day */}
      <div className="space-y-2">
        {DAYS.map((day) => {
          const slots = slotsByDay[day] ?? [];
          if (slots.length === 0) return null;
          return (
            <div key={day} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
              <span className="w-24 text-sm font-medium text-slate-700">{dayName(day)}</span>
              <div className="flex flex-wrap gap-2 flex-1">
                {slots.map((slot) => (
                  <span
                    key={slot.id}
                    className="inline-flex items-center gap-2 text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg"
                  >
                    <Clock size={11} className="text-slate-400" />
                    {slot.startTime} – {slot.endTime}
                    <button
                      onClick={() => deleteSlot(slot.id)}
                      disabled={isPending}
                      className="text-slate-400 hover:text-red-500 transition-colors ml-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {agent.availabilities.length === 0 && !showForm && (
          <p className="text-sm text-slate-400 italic py-4 text-center">
            No availability set. Add slots so the AI can offer visit times to customers.
          </p>
        )}
      </div>
    </div>
  );
}

const INPUT =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';
