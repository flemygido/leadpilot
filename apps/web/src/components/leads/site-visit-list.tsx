import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SiteVisit } from '@/lib/types';

const STATUS_VARIANT = {
  offered: 'warning',
  confirmed: 'success',
  cancelled: 'muted',
  completed: 'info',
} as const;

export function SiteVisitList({ visits }: { visits: SiteVisit[] }) {
  if (visits.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No site visits yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {visits.map((v) => (
        <li
          key={v.id}
          className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 bg-slate-50"
        >
          <Calendar size={16} className="mt-0.5 shrink-0 text-blue-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">
              {format(new Date(v.scheduledAt), 'EEEE, d MMM yyyy · HH:mm')}
            </p>
            <p className="text-xs text-slate-500">{v.durationMinutes} min</p>
          </div>
          <Badge variant={STATUS_VARIANT[v.status]}>{v.status}</Badge>
        </li>
      ))}
    </ul>
  );
}
