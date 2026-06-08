import type { QualificationResult } from '@/lib/types';

const TIMELINE_LABELS: Record<string, string> = {
  immediate: 'Immediate',
  '1_3_months': '1–3 months',
  '3_6_months': '3–6 months',
  exploring: 'Just exploring',
  unknown: 'Unknown',
};

const FINANCING_LABELS: Record<string, string> = {
  loan: 'Home loan',
  loan_preapproved: 'Loan pre-approved',
  cash: 'Cash',
  unknown: 'Unknown',
};

function formatValue(field: string, value: string | number): string {
  if (field === 'timeline') return TIMELINE_LABELS[String(value)] ?? String(value);
  if (field === 'financing') return FINANCING_LABELS[String(value)] ?? String(value);
  return String(value).replace(/_/g, ' ');
}

function Row({ label, value, field }: { label: string; field?: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-800 capitalize">
        {formatValue(field ?? '', value)}
      </span>
    </div>
  );
}

function budget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `₹${(n / 100_000).toFixed(0)}L`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return min ? `${fmt(min)}+` : max ? `up to ${fmt(max)}` : null;
}

export function QualificationPanel({ qual }: { qual: QualificationResult | null }) {
  if (!qual) {
    return <p className="text-sm text-slate-400 py-4 text-center">No qualification data yet.</p>;
  }
  const budgetStr = budget(qual.budgetMin, qual.budgetMax);
  return (
    <div>
      <Row label="Intent" field="intent" value={qual.intent} />
      <Row label="Property type" field="propertyType" value={qual.propertyType} />
      <Row label="BHK" field="bhk" value={qual.bhk} />
      <Row label="Budget" field="budget" value={budgetStr} />
      <Row label="Timeline" field="timeline" value={qual.timeline} />
      <Row label="Financing" field="financing" value={qual.financing} />
      <Row label="Locations" field="locations" value={qual.preferredLocations?.join(', ') || null} />
      <Row label="Contact time" field="preferredContactTime" value={qual.preferredContactTime} />
      {qual.notes && (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {qual.notes}
        </div>
      )}
    </div>
  );
}
