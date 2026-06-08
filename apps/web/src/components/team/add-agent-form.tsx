'use client';

import { useState, useTransition } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

const PROXY = '/api/proxy';

export function AddAgentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName(''); setEmail(''); setPhone(''); setError(''); setOpen(false);
  }

  function submit() {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError('Name, email and phone are all required.');
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        const res = await fetch(`${PROXY}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add member');
      }
    });
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus size={14} />
        Add Team Member
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-blue-800">Add Team Member</p>
        <button onClick={reset} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
          <input
            className={INPUT}
            placeholder="e.g. Priya Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
            <input
              type="email"
              className={INPUT}
              placeholder="priya@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp Number *</label>
            <input
              type="tel"
              className={INPUT}
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={submit} disabled={isPending}>
          {isPending ? 'Adding…' : 'Add Member'}
        </Button>
        <Button variant="secondary" size="sm" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
