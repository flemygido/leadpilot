'use client';

import { signOut, useSession } from 'next-auth/react';
import { LogOut, User } from 'lucide-react';

export function SignOutButton() {
  const { data: session } = useSession();
  if (!session) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-slate-600 px-1">
        <User size={12} className="text-slate-400" />
        <span className="truncate max-w-[120px]">{session.user.name}</span>
      </div>
      <button
        onClick={() => void signOut({ callbackUrl: '/auth/signin' })}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-600 px-1 py-1 transition-colors rounded"
      >
        <LogOut size={12} />
        Sign out
      </button>
    </div>
  );
}
