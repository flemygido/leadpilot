import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import type { StateTransition } from '@/lib/types';

export function StateTimeline({ transitions }: { transitions: StateTransition[] }) {
  if (transitions.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No state transitions yet.</p>;
  }
  return (
    <ol className="relative border-l border-slate-200 ml-2">
      {transitions.map((t) => (
        <li key={t.id} className="mb-4 ml-5">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-400" />
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span className="font-normal text-slate-500">{t.fromState.replace(/_/g, ' ')}</span>
            <ArrowRight size={11} className="shrink-0 text-slate-400" />
            <span>{t.toState.replace(/_/g, ' ')}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {format(new Date(t.createdAt), 'dd MMM HH:mm')}
            {t.reason && <span className="ml-1 italic">· {t.reason}</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}
