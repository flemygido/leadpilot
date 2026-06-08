'use client';

import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { ConversationFlag } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = {
  wrong_action: 'Wrong Action',
  repeated_question: 'Repeated Question',
  state_jump: 'State Jump',
  missing_context: 'Missing Context',
  tone: 'Tone Issue',
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'high') return <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />;
  if (severity === 'medium') return <AlertCircle size={13} className="text-orange-500 shrink-0 mt-0.5" />;
  return <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />;
}

function severityBorder(s: string) {
  if (s === 'high') return 'border-red-200 bg-red-50';
  if (s === 'medium') return 'border-orange-200 bg-orange-50';
  return 'border-blue-200 bg-blue-50';
}

export function ConversationFlagsPanel({
  leadId,
  flags: initialFlags,
}: {
  leadId: string;
  flags: ConversationFlag[];
}) {
  const [flags, setFlags] = useState(initialFlags);
  const [resolving, setResolving] = useState<string | null>(null);

  if (flags.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 py-1">
        <CheckCircle2 size={13} />
        No issues detected
      </div>
    );
  }

  async function resolve(flagId: string) {
    setResolving(flagId);
    try {
      await api.leads.resolveFlag(leadId, flagId);
      setFlags((prev) => prev.filter((f) => f.id !== flagId));
    } finally {
      setResolving(null);
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {flags.map((flag) => (
        <li
          key={flag.id}
          className={`rounded-lg border p-2.5 text-xs ${severityBorder(flag.severity)}`}
        >
          <div className="flex items-start gap-1.5">
            <SeverityIcon severity={flag.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-semibold text-slate-700">
                  {CATEGORY_LABELS[flag.category] ?? flag.category}
                </span>
                <button
                  onClick={() => void resolve(flag.id)}
                  disabled={resolving === flag.id}
                  className="text-[10px] text-slate-400 hover:text-slate-600 shrink-0 disabled:opacity-50"
                >
                  {resolving === flag.id ? '…' : 'Dismiss'}
                </button>
              </div>
              <p className="text-slate-600 leading-snug">{flag.description}</p>
              {flag.snippet && (
                <p className="mt-1 text-[10px] text-slate-400 italic truncate">{flag.snippet}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
