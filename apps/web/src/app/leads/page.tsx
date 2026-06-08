import { Suspense } from 'react';
import { auth } from '@/auth';
import { makeApi } from '@/lib/api';
import { LeadCard } from '@/components/leads/lead-card';
import { StatCard } from '@/components/leads/stat-card';
import { ImportLeadsForm } from '@/components/leads/import-leads-form';
import type { Lead } from '@/lib/types';

async function LeadList({ stateFilter, agentId }: { stateFilter?: string; agentId: string }) {
  let leads: Lead[] = [];
  try {
    leads = await makeApi(agentId).leads.list();
  } catch {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        Could not reach the API. Make sure <code>npm run dev:api</code> is running.
      </div>
    );
  }

  const filtered = stateFilter ? leads.filter((l) => l.state === stateFilter) : leads;

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
        <p className="text-sm text-slate-500">
          {stateFilter ? `No leads in state ${stateFilter}.` : 'No leads yet.'}
        </p>
        {!stateFilter && (
          <p className="text-xs text-slate-400 mt-1">
            Send a WhatsApp message to the mock endpoint or run <code>npm run db:seed</code>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((lead) => (
        <LeadCard key={lead.id} lead={lead} from={stateFilter ? 'visits' : undefined} />
      ))}
    </div>
  );
}

async function SummaryStats({ agentId }: { agentId: string }) {
  try {
    const summary = await makeApi(agentId).summary.daily();
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="New today" value={summary.newLeads} icon="✨" accent="blue" />
        <StatCard label="Hot leads" value={summary.hotLeads} icon="🔥" accent="red" />
        <StatCard label="Upcoming visits" value={summary.upcomingVisits} icon="📅" accent="green" />
        <StatCard label="Pending follow-ups" value={summary.pendingFollowUps} icon="⏳" accent="orange" />
        <StatCard label="Deals closed" value={summary.dealsWon} icon="🏆" accent="green" />
        <StatCard label="Conversion %" value={`${summary.conversionRate}%`} icon="📈" accent="blue" />
      </div>
    );
  } catch {
    return null;
  }
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const session = await auth();
  const agentId = session?.user.agentId ?? '';

  const params = await searchParams;
  const stateFilter = typeof params['state'] === 'string' ? params['state'] : undefined;
  const isVisitsView = stateFilter === 'VISIT_SCHEDULED';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isVisitsView ? 'Scheduled Visits' : 'Leads'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isVisitsView ? 'Leads with a confirmed site visit' : 'Your real estate pipeline'}
          </p>
        </div>
      </div>

      {!isVisitsView && (
        <>
          <Suspense fallback={<div className="h-24 rounded-xl bg-slate-100 animate-pulse" />}>
            <SummaryStats agentId={agentId} />
          </Suspense>
          <div className="mt-4">
            <ImportLeadsForm />
          </div>
        </>
      )}

      <div className="mt-6">
        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          }
        >
          <LeadList stateFilter={stateFilter} agentId={agentId} />
        </Suspense>
      </div>
    </div>
  );
}
