import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { auth } from '@/auth';
import { makeApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StateBadge } from '@/components/leads/state-badge';
import { ClassificationBadge } from '@/components/leads/classification-badge';
import { ConversationTimeline } from '@/components/leads/conversation-timeline';
import { QualificationPanel } from '@/components/leads/qualification-panel';
import { StateTimeline } from '@/components/leads/state-timeline';
import { SiteVisitList } from '@/components/leads/site-visit-list';
import { LeadActions } from '@/components/leads/lead-actions';
import { ConversationFlagsPanel } from '@/components/leads/conversation-flags-panel';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function LeadDetailPage({ params, searchParams }: Props) {
  const session = await auth();
  const agentId = session?.user.agentId ?? '';

  const { id } = await params;
  const sp = await searchParams;
  const backHref = sp['from'] === 'visits' ? '/leads?state=VISIT_SCHEDULED' : '/leads';
  const backLabel = sp['from'] === 'visits' ? 'Visits' : 'All Leads';
  let lead;
  try {
    lead = await makeApi(agentId).leads.get(id);
  } catch {
    notFound();
  }

  // HANDED_OFF urgency banner — show after 2 h without a call being logged
  const handedOffTransition = lead.state === 'HANDED_OFF'
    ? [...lead.stateTransitions].reverse().find((t) => t.toState === 'HANDED_OFF')
    : undefined;
  const handedOffAt = handedOffTransition?.createdAt ?? null;
  const handedOffElapsedMs = handedOffAt ? Date.now() - new Date(handedOffAt).getTime() : 0;
  const showHandoffWarning = handedOffAt && handedOffElapsedMs > 2 * 60 * 60 * 1000;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-5"
      >
        <ChevronLeft size={13} /> {backLabel}
      </Link>

      {/* HANDED_OFF elapsed-time warning */}
      {showHandoffWarning && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              HOT lead handed off {formatDistanceToNow(new Date(handedOffAt!), { addSuffix: true })} — no call logged yet.
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              Hot leads who aren&apos;t called within 1 hour drop off sharply. Call {lead.name ?? lead.phone} now.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{lead.name ?? 'Unknown'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{lead.phone}</p>
          <div className="flex items-center gap-2 mt-2">
            <StateBadge state={lead.state} />
            <ClassificationBadge classification={lead.classification} />
            <span className="text-xs text-slate-500">
              Score: <strong>{lead.score}/100</strong>
            </span>
          </div>
        </div>
        <LeadActions lead={lead} />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 mb-6">
        <span>
          Source: <strong className="capitalize">{lead.source}</strong>
        </span>
        <span>
          Agent: <strong>{lead.agent.name}</strong>
        </span>
        <span>
          Consent: <strong>{lead.consent ? 'Yes' : 'No'}</strong>
        </span>
        {lead.aiPaused && <span className="font-semibold text-orange-600">AI Paused</span>}
        <span>
          Created: <strong>{format(new Date(lead.createdAt), 'dd MMM yyyy, HH:mm')}</strong>
        </span>
        {lead.lastInboundAt && (
          <span>
            Last inbound: <strong>{format(new Date(lead.lastInboundAt), 'dd MMM, HH:mm')}</strong>
          </span>
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Conversation — takes 2 cols on lg */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <span className="text-xs text-slate-400">
                {lead.conversation?.messages.length ?? 0} messages
              </span>
            </CardHeader>
            <CardContent className="max-h-[520px] overflow-y-auto">
              <ConversationTimeline messages={lead.conversation?.messages ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Site Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <SiteVisitList visits={lead.siteVisits} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar panels */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Qualification</CardTitle>
            </CardHeader>
            <CardContent>
              <QualificationPanel qual={lead.qualificationResult} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>State History</CardTitle>
            </CardHeader>
            <CardContent>
              <StateTimeline transitions={lead.stateTransitions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Monitor</CardTitle>
              <span className="text-xs text-slate-400">
                {lead.conversationFlags.length > 0
                  ? `${lead.conversationFlags.length} issue${lead.conversationFlags.length > 1 ? 's' : ''} flagged`
                  : 'Clean'}
              </span>
            </CardHeader>
            <CardContent>
              <ConversationFlagsPanel leadId={lead.id} flags={lead.conversationFlags} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.followUpJobs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-2">Not enrolled.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lead.followUpJobs.map((job) => (
                    <li key={job.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        Day{' '}
                        {job.sequenceStep === 1
                          ? 1
                          : job.sequenceStep === 2
                            ? 3
                            : job.sequenceStep === 3
                              ? 7
                              : 14}
                      </span>
                      <span className="text-slate-400">
                        {format(new Date(job.runAt), 'dd MMM')}
                      </span>
                      <span
                        className={
                          job.status === 'sent'
                            ? 'text-green-600 font-medium'
                            : job.status === 'failed'
                              ? 'text-red-600 font-medium'
                              : job.status === 'skipped'
                                ? 'text-slate-400'
                                : 'text-blue-600 font-medium'
                        }
                      >
                        {job.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
