'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const PROXY = '/api/proxy';

export function RemoveAgentButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function remove() {
    setError('');
    startTransition(async () => {
      try {
        const res = await fetch(`${PROXY}/api/agents/${agentId}`, { method: 'DELETE' });
        const body = await res.json() as { error?: string; message?: string };
        if (!res.ok) throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
        setConfirming(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove');
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Remove {agentName}?</span>
        <button
          onClick={remove}
          disabled={isPending}
          className="text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
        >
          {isPending ? 'Removing…' : 'Yes, remove'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600 ml-1">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
      >
        <Trash2 size={13} />
        Remove
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
