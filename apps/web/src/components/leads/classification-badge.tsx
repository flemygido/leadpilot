import { Badge } from '@/components/ui/badge';
import type { LeadClassification } from '@/lib/types';

export function ClassificationBadge({ classification }: { classification: LeadClassification }) {
  if (classification === 'HOT') return <Badge variant="hot">🔥 HOT</Badge>;
  if (classification === 'NURTURE') return <Badge variant="nurture">🌱 NURTURE</Badge>;
  return <Badge variant="unscored">UNSCORED</Badge>;
}
