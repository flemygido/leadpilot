import { Badge } from '@/components/ui/badge';
import type { LeadState } from '@/lib/types';

const STATE_CONFIG: Record<
  LeadState,
  {
    label: string;
    variant: 'default' | 'hot' | 'nurture' | 'success' | 'info' | 'warning' | 'muted' | 'unscored';
  }
> = {
  NEW: { label: 'New', variant: 'muted' },
  GREETED: { label: 'Greeted', variant: 'muted' },
  QUALIFYING: { label: 'Qualifying', variant: 'info' },
  QUALIFIED_HOT: { label: 'Qualified Hot', variant: 'hot' },
  QUALIFIED_COLD: { label: 'Qualified Cold', variant: 'nurture' },
  NURTURING: { label: 'Nurturing', variant: 'nurture' },
  VISIT_OFFERED: { label: 'Visit Offered', variant: 'warning' },
  VISIT_SCHEDULED: { label: 'Visit Scheduled', variant: 'success' },
  HANDED_OFF: { label: 'Handed Off', variant: 'info' },
  CLOSED_WON: { label: 'Closed Won', variant: 'success' },
  CLOSED_LOST: { label: 'Closed Lost', variant: 'muted' },
};

export function StateBadge({ state }: { state: LeadState }) {
  const cfg = STATE_CONFIG[state] ?? { label: state, variant: 'default' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
