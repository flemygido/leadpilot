import Link from 'next/link';
import { Phone, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { ClassificationBadge } from './classification-badge';
import type { Lead } from '@/lib/types';

/** What the agent should do next, mapped from lead state. */
function nextAction(state: string): { label: string; color: string } {
  switch (state) {
    case 'NEW':
    case 'GREETED':
      return { label: 'Awaiting reply', color: 'text-slate-500' };
    case 'QUALIFYING':
      return { label: 'Qualifying in progress', color: 'text-blue-600' };
    case 'QUALIFIED_HOT':
      return { label: 'Book site visit', color: 'text-green-700' };
    case 'QUALIFIED_COLD':
      return { label: 'Nurture — follow up', color: 'text-amber-600' };
    case 'NURTURING':
      return { label: 'In nurture sequence', color: 'text-amber-600' };
    case 'VISIT_OFFERED':
      return { label: 'Awaiting slot choice', color: 'text-blue-600' };
    case 'VISIT_SCHEDULED':
      return { label: 'Visit confirmed ✓', color: 'text-green-700' };
    case 'HANDED_OFF':
      return { label: 'Call lead now', color: 'text-red-600' };
    case 'CLOSED_WON':
      return { label: 'Deal closed 🎉', color: 'text-green-700' };
    case 'CLOSED_LOST':
      return { label: 'Closed — not interested', color: 'text-slate-400' };
    default:
      return { label: state, color: 'text-slate-500' };
  }
}

export function LeadCard({ lead, from }: { lead: Lead; from?: string }) {
  const href = from ? `/leads/${lead.id}?from=${from}` : `/leads/${lead.id}`;
  const action = nextAction(lead.state);
  const isHandedOff = lead.state === 'HANDED_OFF';

  return (
    <Link href={href}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isHandedOff ? 'border-red-200' : ''}`}>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate">{lead.name ?? 'Unknown'}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <Phone size={11} />
                {lead.phone}
              </p>
            </div>
            <ClassificationBadge classification={lead.classification} />
          </div>

          {/* Next action — the most important thing on the card */}
          <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${action.color}`}>
            {isHandedOff && <AlertTriangle size={11} />}
            <ArrowRight size={11} />
            {action.label}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              Score: <strong className="text-slate-700">{lead.score}/100</strong>
            </span>
            {lead.qualificationResult?.intent && lead.qualificationResult.intent !== 'unknown' && (
              <span className="capitalize">{lead.qualificationResult.intent}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
            </span>
          </div>

          {lead.aiPaused && (
            <p className="mt-2 text-[11px] font-medium text-orange-600 bg-orange-50 rounded px-2 py-0.5 inline-block">
              AI Paused
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
