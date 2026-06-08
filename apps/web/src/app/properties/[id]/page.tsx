import Link from 'next/link';
import { ChevronLeft, Phone, Mail, MapPin, Building2, Users, CalendarCheck } from 'lucide-react';
import { auth } from '@/auth';
import { makeApi } from '@/lib/api';
import { formatPriceRange, formatDateTime } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  negotiating: 'bg-amber-100 text-amber-700',
  sold: 'bg-slate-100 text-slate-500',
};

const VISIT_STATUS_STYLES: Record<string, string> = {
  offered: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
};

const STATE_COLORS: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-600',
  GREETED: 'bg-blue-50 text-blue-600',
  QUALIFYING: 'bg-indigo-50 text-indigo-600',
  QUALIFIED_HOT: 'bg-orange-100 text-orange-700',
  QUALIFIED_COLD: 'bg-slate-100 text-slate-600',
  NURTURING: 'bg-purple-50 text-purple-600',
  VISIT_OFFERED: 'bg-cyan-50 text-cyan-700',
  VISIT_SCHEDULED: 'bg-green-100 text-green-700',
  HANDED_OFF: 'bg-yellow-100 text-yellow-700',
  CLOSED_WON: 'bg-emerald-100 text-emerald-700',
  CLOSED_LOST: 'bg-red-100 text-red-600',
};

function fmtBudget(min: number | null, max: number | null) {
  if (!min && !max) return '—';
  if (min && max) return formatPriceRange(min, max);
  if (max) return `Up to ${formatPriceRange(0, max).replace(/^₹0.* – /, '₹')}`;
  return `From ${formatPriceRange(min!, min!)}`;
}

function fmtTimeline(t: string) {
  const map: Record<string, string> = {
    immediate: 'Immediate',
    '1_3_months': '1–3 months',
    '3_6_months': '3–6 months',
    exploring: 'Exploring',
    unknown: '—',
  };
  return map[t] ?? t;
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const agentId = session?.user.agentId ?? '';
  const { id } = await params;
  const p = await makeApi(agentId).properties.get(id);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back + header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/properties"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft size={16} />
            Properties
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-base font-semibold text-slate-800 truncate max-w-[400px]">
            {p.title}
          </h1>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-500'}`}
          >
            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
          </span>
        </div>
        <Link
          href={`/properties/${id}/edit`}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Edit
        </Link>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Property info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 size={15} className="text-blue-600" />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <Detail label="Type">
                {p.propertyType.charAt(0).toUpperCase() + p.propertyType.slice(1)}
                {p.bhk ? ` · ${p.bhk} BHK` : ''}
              </Detail>
              {p.areaSqft && (
                <Detail label="Area">{p.areaSqft.toLocaleString()} sq ft</Detail>
              )}
              <Detail label="Price Range">
                <span className="font-semibold text-slate-900">
                  {formatPriceRange(p.priceMin, p.priceMax)}
                </span>
              </Detail>
              <Detail label="Locality">{p.location}</Detail>
              {p.address && (
                <div className="col-span-2">
                  <Detail label="Full Address">
                    <span className="flex items-start gap-1">
                      <MapPin size={13} className="mt-0.5 text-slate-400 shrink-0" />
                      {p.address}
                    </span>
                  </Detail>
                </div>
              )}
              {p.amenities.length > 0 && (
                <div className="col-span-2">
                  <Detail label="Amenities">
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {p.amenities.map((a) => (
                        <span
                          key={a}
                          className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </Detail>
                </div>
              )}
              {p.description && (
                <div className="col-span-2">
                  <Detail label="Description">
                    <p className="text-slate-600 leading-relaxed">{p.description}</p>
                  </Detail>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Owner card */}
        <Card>
          <CardHeader>
            <CardTitle>Owner / Seller</CardTitle>
          </CardHeader>
          <CardContent>
            {p.ownerName || p.ownerPhone || p.ownerEmail ? (
              <div className="space-y-3">
                {p.ownerName && (
                  <p className="text-sm font-semibold text-slate-800">{p.ownerName}</p>
                )}
                {p.ownerPhone && (
                  <a
                    href={`tel:${p.ownerPhone}`}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors"
                  >
                    <Phone size={14} className="text-slate-400" />
                    {p.ownerPhone}
                  </a>
                )}
                {p.ownerEmail && (
                  <a
                    href={`mailto:${p.ownerEmail}`}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors break-all"
                  >
                    <Mail size={14} className="text-slate-400" />
                    {p.ownerEmail}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No owner details added</p>
            )}
            {p.agent && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Assigned Agent</p>
                <p className="text-sm font-medium text-slate-700">{p.agent.name}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Site Visits */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck size={15} className="text-blue-600" />
            Site Visits ({p.siteVisits.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {p.siteVisits.length === 0 ? (
            <p className="text-sm text-slate-400 px-5 py-4 italic">No visits for this property yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Date & Time', 'Customer', 'Agent', 'Status'].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {p.siteVisits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-700">{formatDateTime(v.scheduledAt)}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/leads/${v.lead.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {v.lead.name ?? v.lead.phone}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{v.agent.name}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${VISIT_STATUS_STYLES[v.status] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Interested / Matching Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={15} className="text-blue-600" />
            Matching Customers ({p.interestedLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {p.interestedLeads.length === 0 ? (
            <p className="text-sm text-slate-400 px-5 py-4 italic">
              No active leads matching this property type right now.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Customer', 'Budget', 'BHK', 'Timeline', 'Status', 'Score'].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {p.interestedLeads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/leads/${l.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {l.name ?? l.phone}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {fmtBudget(
                        l.qualificationResult?.budgetMin ?? null,
                        l.qualificationResult?.budgetMax ?? null,
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {l.qualificationResult?.bhk ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {fmtTimeline(l.qualificationResult?.timeline ?? 'unknown')}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATE_COLORS[l.state] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {l.state.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-700">{l.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
