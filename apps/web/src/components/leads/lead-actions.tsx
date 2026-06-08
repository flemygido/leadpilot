'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, Loader2, Trophy, XCircle, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Lead } from '@/lib/types';

const PROXY = '/api/proxy';

export function LeadActions({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmWon, setConfirmWon] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'enrolling' | 'done' | 'already'>('idle');

  async function takeover() {
    setError(null);
    try {
      await api.leads.takeover(lead.id);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function resumeAI() {
    setError(null);
    try {
      await api.leads.resumeAI(lead.id);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function enrollFollowUp() {
    setEnrollStatus('enrolling');
    try {
      const res = await fetch(`${PROXY}/api/leads/${lead.id}/enroll-followup`, { method: 'POST' });
      const body = await res.json() as { status?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setEnrollStatus(body.status === 'already_enrolled' ? 'already' : 'done');
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setEnrollStatus('idle');
    }
  }

  async function markWon() {
    setError(null);
    setConfirmWon(false);
    try {
      const res = await fetch(`${PROXY}/api/leads/${lead.id}/close-won`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  const isTerminal = lead.state === 'CLOSED_WON' || lead.state === 'CLOSED_LOST';
  const hasActiveFollowUp = lead.followUpJobs?.some((j) => j.status === 'pending');

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {isPending && <Loader2 size={14} className="animate-spin text-slate-400" />}

        {/* Enroll in follow-up nurture sequence */}
        {!isTerminal && !hasActiveFollowUp && lead.state !== 'HANDED_OFF' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void enrollFollowUp()}
            disabled={isPending || enrollStatus === 'enrolling' || enrollStatus === 'done' || enrollStatus === 'already'}
          >
            <Bell size={13} />
            {enrollStatus === 'enrolling' ? 'Enrolling…'
              : enrollStatus === 'done' ? 'Enrolled ✓'
              : enrollStatus === 'already' ? 'Already enrolled'
              : 'Enroll in Follow-up'}
          </Button>
        )}

        {/* Mark as Won — only from HANDED_OFF */}
        {lead.state === 'HANDED_OFF' && !confirmWon && (
          <Button variant="primary" size="sm" onClick={() => setConfirmWon(true)} disabled={isPending}>
            <Trophy size={13} /> Mark as Won
          </Button>
        )}
        {confirmWon && (
          <>
            <span className="text-xs text-slate-500">Mark deal closed?</span>
            <Button variant="primary" size="sm" onClick={() => void markWon()} disabled={isPending}>
              Yes, won!
            </Button>
            <button
              onClick={() => setConfirmWon(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              Cancel
            </button>
          </>
        )}

        {/* AI pause / resume */}
        {!isTerminal && (
          lead.aiPaused ? (
            <Button variant="primary" size="sm" onClick={() => void resumeAI()} disabled={isPending}>
              <Play size={13} /> Resume AI
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={() => void takeover()} disabled={isPending}>
              <Pause size={13} /> Take Over
            </Button>
          )
        )}

        {lead.state === 'CLOSED_WON' && (
          <span className="flex items-center gap-1 text-sm font-semibold text-green-700">
            <Trophy size={14} /> Deal Closed
          </span>
        )}
        {lead.state === 'CLOSED_LOST' && (
          <span className="flex items-center gap-1 text-sm text-slate-400">
            <XCircle size={14} /> Closed Lost
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
