'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { rupeesToLakhs, lakhsToRupees } from '@/lib/format';
import type { Property } from '@/lib/types';

interface PropertyFormProps {
  initialData?: Property;
  propertyId?: string;
}

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment / Flat' },
  { value: 'villa', label: 'Villa / Independent House' },
  { value: 'plot', label: 'Plot / Land' },
  { value: 'commercial', label: 'Commercial / Office' },
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'negotiating', label: 'Under Negotiation' },
  { value: 'sold', label: 'Sold / Rented' },
];

export function PropertyForm({ initialData, propertyId }: PropertyFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: initialData?.title ?? '',
    propertyType: initialData?.propertyType ?? 'apartment',
    bhk: initialData?.bhk?.toString() ?? '',
    areaSqft: initialData?.areaSqft?.toString() ?? '',
    priceMin: initialData?.priceMin ? rupeesToLakhs(initialData.priceMin) : '',
    priceMax: initialData?.priceMax ? rupeesToLakhs(initialData.priceMax) : '',
    location: initialData?.location ?? '',
    address: initialData?.address ?? '',
    status: initialData?.status ?? 'available',
    reraNumber: (initialData as Property & { reraNumber?: string })?.reraNumber ?? '',
    amenities: initialData?.amenities?.join(', ') ?? '',
    description: initialData?.description ?? '',
    ownerName: initialData?.ownerName ?? '',
    ownerPhone: initialData?.ownerPhone ?? '',
    ownerEmail: initialData?.ownerEmail ?? '',
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.location || !form.priceMin || !form.priceMax) {
      setError('Title, location, and price range are required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      title: form.title,
      propertyType: form.propertyType,
      bhk: form.bhk ? parseInt(form.bhk) : null,
      areaSqft: form.areaSqft ? parseFloat(form.areaSqft) : null,
      priceMin: lakhsToRupees(form.priceMin),
      priceMax: lakhsToRupees(form.priceMax),
      location: form.location,
      address: form.address || null,
      status: form.status,
      amenities: form.amenities
        ? form.amenities.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      description: form.description || null,
      reraNumber: form.reraNumber || null,
      ownerName: form.ownerName || null,
      ownerPhone: form.ownerPhone || null,
      ownerEmail: form.ownerEmail || null,
    };

    try {
      const PROXY = '/api/proxy';
      const url = propertyId ? `${PROXY}/api/properties/${propertyId}` : `${PROXY}/api/properties`;
      const method = propertyId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      const saved = (await res.json()) as Property;
      router.push(`/properties/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  const isResidential = form.propertyType !== 'plot' && form.propertyType !== 'commercial';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Property Details */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">
          Property Details
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Listing Title *">
            <input
              className={INPUT}
              placeholder="e.g. 3BHK Premium Apartment — Bandra West"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Property Type *">
              <select
                className={INPUT}
                value={form.propertyType}
                onChange={(e) => set('propertyType', e.target.value)}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status *">
              <select
                className={INPUT}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {isResidential && (
              <Field label="BHK">
                <input
                  className={INPUT}
                  type="number"
                  min="1"
                  max="10"
                  placeholder="e.g. 3"
                  value={form.bhk}
                  onChange={(e) => set('bhk', e.target.value)}
                />
              </Field>
            )}
            <Field label="Area (sq ft)">
              <input
                className={INPUT}
                type="number"
                placeholder="e.g. 1450"
                value={form.areaSqft}
                onChange={(e) => set('areaSqft', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price Min (₹ Lakhs) *" hint="Enter in Lakhs — 180 = ₹1.8 Cr">
              <input
                className={INPUT}
                type="number"
                step="0.01"
                placeholder="e.g. 180"
                value={form.priceMin}
                onChange={(e) => set('priceMin', e.target.value)}
                required
              />
            </Field>
            <Field label="Price Max (₹ Lakhs) *" hint="Enter in Lakhs — 220 = ₹2.2 Cr">
              <input
                className={INPUT}
                type="number"
                step="0.01"
                placeholder="e.g. 220"
                value={form.priceMax}
                onChange={(e) => set('priceMax', e.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Area / Locality *" hint="Used by AI for matching (e.g. Bandra West, Mumbai)">
            <input
              className={INPUT}
              placeholder="e.g. Bandra West, Mumbai"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              required
            />
          </Field>

          <Field label="Full Address" hint="Shown to customers during visit confirmation">
            <input
              className={INPUT}
              placeholder="e.g. 12B, Sea View Heights, Bandstand, Bandra West, Mumbai - 400050"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </Field>

          <Field label="RERA Number" hint="Required for all residential projects in MH/KA — must appear in marketing">
            <input
              className={INPUT}
              placeholder="e.g. P51900012345 (MahaRERA) or PRM/KA/RERA/1251/446 (K-RERA)"
              value={form.reraNumber}
              onChange={(e) => set('reraNumber', e.target.value)}
            />
          </Field>

          <Field label="Amenities" hint="Comma-separated list">
            <input
              className={INPUT}
              placeholder="e.g. Gym, Swimming Pool, 2 Car Parking, 24/7 Security"
              value={form.amenities}
              onChange={(e) => set('amenities', e.target.value)}
            />
          </Field>

          <Field label="Description">
            <textarea
              className={INPUT + ' h-24 resize-none'}
              placeholder="Brief description of the property..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* Owner Details */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">
          Owner / Seller Details
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Owner Name">
            <input
              className={INPUT}
              placeholder="e.g. Deepak Malhotra"
              value={form.ownerName}
              onChange={(e) => set('ownerName', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Owner Phone">
              <input
                className={INPUT}
                type="tel"
                placeholder="+91 98200 12345"
                value={form.ownerPhone}
                onChange={(e) => set('ownerPhone', e.target.value)}
              />
            </Field>
            <Field label="Owner Email">
              <input
                className={INPUT}
                type="email"
                placeholder="owner@example.com"
                value={form.ownerEmail}
                onChange={(e) => set('ownerEmail', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" size="lg" disabled={saving}>
          {saving ? 'Saving…' : propertyId ? 'Save Changes' : 'Add Property'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {hint && <span className="text-slate-400 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
