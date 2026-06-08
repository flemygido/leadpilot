import { UserCog, Phone, Mail, Building2, Users } from 'lucide-react';
import { auth } from '@/auth';
import { makeApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AvailabilityManager } from '@/components/team/availability-manager';
import { AddAgentForm } from '@/components/team/add-agent-form';
import { RemoveAgentButton } from '@/components/team/remove-agent-button';

export default async function TeamPage() {
  const session = await auth();
  const agentId = session?.user.agentId ?? '';
  let agents = await makeApi(agentId).agents.list().catch(() => []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <UserCog size={20} className="text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Team</h1>
          <span className="text-sm text-slate-500">({agents.length})</span>
        </div>
        <AddAgentForm />
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">No agents found.</div>
      ) : (
        <div className="space-y-8">
          {agents.map((agent) => (
            <div key={agent.id} className="space-y-4">
              {/* Agent Profile Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog size={15} className="text-blue-600" />
                    {agent.name}
                  </CardTitle>
                  <RemoveAgentButton agentId={agent.id} agentName={agent.name} />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={14} className="text-slate-400" />
                      <a href={`mailto:${agent.email}`} className="hover:text-blue-600">
                        {agent.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={14} className="text-slate-400" />
                      <a href={`tel:${agent.phone}`} className="hover:text-blue-600">
                        {agent.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users size={14} className="text-slate-400" />
                      <span>{agent._count.leads} leads</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building2 size={14} className="text-slate-400" />
                      <span>{agent._count.properties} properties</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Availability */}
              <Card>
                <CardContent className="pt-5">
                  <AvailabilityManager agent={agent} />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
