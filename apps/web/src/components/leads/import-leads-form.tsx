'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ChevronDown, ChevronUp } from 'lucide-react';

const PROXY = '/api/proxy';

export function ImportLeadsForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [source, setSource] = useState('manual');
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleImport() {
    setError('');
    setResult(null);
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    const rows = lines.map((line) => {
      const [phone, name] = line.split(',').map((s) => s.trim());
      return { phone: phone ?? '', name: name || undefined, source };
    }).filter((r) => r.phone.length >= 5);

    if (rows.length === 0) { setError('No valid rows found.'); return; }

    try {
      const res = await fetch(`${PROXY}/api/leads/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });
      const body = await res.json() as { created?: number; skipped?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult({ created: body.created ?? 0, skipped: body.skipped ?? 0 });
      setCsv('');
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors rounded-xl"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <Upload size={14} />
          Import Leads (CSV / manual entry)
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-slate-500">
            One lead per line: <code className="bg-slate-100 px-1 rounded">phone, name (optional)</code>
            &nbsp;— e.g. from a 99acres or MagicBricks CSV export.
          </p>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600">Source</label>
            <select
              className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="manual">Manual</option>
              <option value="99acres">99acres</option>
              <option value="magicbricks">MagicBricks</option>
              <option value="housing">Housing.com</option>
              <option value="squareyards">Square Yards</option>
            </select>
          </div>

          <textarea
            className="w-full h-32 text-xs border border-slate-200 rounded-lg px-3 py-2 font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder={"+919876543210, Priya Mehta\n+912233445566, Kiran Desai\n+910011223344"}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleImport()}
              disabled={isPending || !csv.trim()}
              className="text-xs font-medium bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Importing…' : 'Import'}
            </button>
            {result && (
              <span className="text-xs text-green-700 font-medium">
                ✓ {result.created} created, {result.skipped} skipped (duplicate)
              </span>
            )}
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
