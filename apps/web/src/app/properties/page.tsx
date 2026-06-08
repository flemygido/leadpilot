import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';
import { auth } from '@/auth';
import { makeApi } from '@/lib/api';
import { formatPriceRange } from '@/lib/format';
import type { Property } from '@/lib/types';

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Available', value: 'available' },
  { label: 'Negotiating', value: 'negotiating' },
  { label: 'Sold', value: 'sold' },
];

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  negotiating: 'bg-amber-100 text-amber-700',
  sold: 'bg-slate-100 text-slate-500',
};

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartment',
  villa: 'Villa',
  plot: 'Plot',
  commercial: 'Commercial',
};

function PropertyCard({ p }: { p: Property }) {
  const visitCount = p._count?.siteVisits ?? 0;
  return (
    <Link
      href={`/properties/${p.id}`}
      className="block rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-5"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-800 leading-snug">{p.title}</h3>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-500'}`}>
          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded">
          {TYPE_LABELS[p.propertyType] ?? p.propertyType}
          {p.bhk ? ` · ${p.bhk} BHK` : ''}
        </span>
        {p.areaSqft && (
          <span className="text-[11px] text-slate-500">{p.areaSqft.toLocaleString()} sq ft</span>
        )}
      </div>

      <p className="text-base font-bold text-slate-900 mb-1">
        {formatPriceRange(p.priceMin, p.priceMax)}
      </p>

      <p className="text-xs text-slate-500 mb-3">{p.location}</p>

      {p.ownerName && (
        <div className="border-t border-slate-100 pt-3 mt-3">
          <p className="text-xs font-medium text-slate-600">{p.ownerName}</p>
          {/* Phone/email shown only on property detail page, not in list */}
        </div>
      )}

      {visitCount > 0 && (
        <p className="text-[11px] text-blue-600 mt-2">
          {visitCount} visit{visitCount !== 1 ? 's' : ''} booked
        </p>
      )}
    </Link>
  );
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const agentId = session?.user.agentId ?? '';

  const sp = await searchParams;
  const activeStatus = sp.status as string | undefined;

  let properties: Property[] = [];
  try {
    properties = await makeApi(agentId).properties.list(activeStatus);
  } catch {
    // API may not be running — show empty state
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <Building2 size={20} className="text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Properties</h1>
          <span className="text-sm text-slate-500 ml-1">({properties.length})</span>
        </div>
        <Link
          href="/properties/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Add Property
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {STATUS_TABS.map(({ label, value }) => {
          const isActive = activeStatus === value;
          const href = value ? `/properties?status=${value}` : '/properties';
          return (
            <Link
              key={label}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Property grid */}
      {properties.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No properties yet</p>
          <p className="text-xs mt-1">Add your first property to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {properties.map((p) => (
            <PropertyCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
