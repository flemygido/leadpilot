import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutDashboard, Users, Calendar, Building2, UserCog } from 'lucide-react';
import './globals.css';
import { SessionProvider } from '@/components/auth/session-provider';
import { SignOutButton } from '@/components/auth/signout-button';

export const metadata: Metadata = {
  title: 'LeadPilot',
  description: 'Real Estate WhatsApp AI Sales Assistant',
};

const NAV = [
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/leads?state=VISIT_SCHEDULED', label: 'Visits', icon: Calendar },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/team', label: 'Team', icon: UserCog },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <SessionProvider>
          {/* Sidebar */}
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
            <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
              <LayoutDashboard size={20} className="text-blue-600" />
              <span className="font-bold text-slate-800">LeadPilot</span>
            </div>
            <nav className="flex flex-col gap-1 p-3 flex-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-slate-100 flex flex-col gap-3">
              <SignOutButton />
              <p className="text-[10px] text-slate-400">LeadPilot v0.1.0</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
