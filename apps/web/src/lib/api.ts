import type { Lead, DailySummary, Property, PropertyDetail, AgentDetail, AgentAvailability } from './types';

// Server components pass this directly to Fastify with auth headers.
// Client components use the Next.js proxy (/api/proxy/...) which adds headers automatically.
const DIRECT_API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const API_SECRET = process.env['INTERNAL_API_SECRET'] ?? '';

// Used by server components — receives agentId from auth() session
export function serverFetch<T>(agentId: string, path: string, opts?: RequestInit): Promise<T> {
  return baseFetch(`${DIRECT_API}${path}`, {
    ...opts,
    headers: {
      ...(opts?.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...opts?.headers,
      'X-Agent-Id': agentId,
      'X-Api-Secret': API_SECRET,
    },
  });
}

// Used by client components — calls the Next.js proxy
function proxyFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  return baseFetch(`/api/proxy${path}`, {
    ...opts,
    headers: {
      ...(opts?.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...opts?.headers,
    },
  });
}

async function baseFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${url} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Server-side API (used by Next.js server components / page.tsx files)
export function makeApi(agentId: string) {
  const f = <T>(path: string, opts?: RequestInit) => serverFetch<T>(agentId, path, opts);
  return {
    leads: {
      list: () => f<Lead[]>('/api/leads'),
      get: (id: string) => f<Lead>(`/api/leads/${id}`),
      visitSlots: (id: string) =>
        f<{ leadId: string; slots: Array<{ label: string; scheduledAt: string }> }>(
          `/api/leads/${id}/visit-slots`,
        ),
    },
    summary: {
      daily: () => f<DailySummary>('/api/summary/daily'),
    },
    properties: {
      list: (status?: string) =>
        f<Property[]>(`/api/properties${status ? `?status=${encodeURIComponent(status)}` : ''}`),
      get: (id: string) => f<PropertyDetail>(`/api/properties/${id}`),
    },
    agents: {
      list: () => f<AgentDetail[]>('/api/agents'),
      get: (id: string) => f<AgentDetail>(`/api/agents/${id}`),
    },
  };
}

// Client-side API (used by client components — routes through /api/proxy)
export const api = {
  leads: {
    list: () => proxyFetch<Lead[]>('/api/leads'),
    get: (id: string) => proxyFetch<Lead>(`/api/leads/${id}`),
    takeover: (id: string) =>
      proxyFetch<{ status: string }>(`/api/leads/${id}/takeover`, { method: 'POST' }),
    resumeAI: (id: string) =>
      proxyFetch<{ status: string }>(`/api/leads/${id}/resume-ai`, { method: 'POST' }),
    visitSlots: (id: string) =>
      proxyFetch<{ leadId: string; slots: Array<{ label: string; scheduledAt: string }> }>(
        `/api/leads/${id}/visit-slots`,
      ),
    bookVisit: (id: string, scheduledAt: string, notes?: string) =>
      proxyFetch<{ visitId: string; scheduledAt: string; status: string }>(
        `/api/leads/${id}/book-visit`,
        { method: 'POST', body: JSON.stringify({ scheduledAt, notes }) },
      ),
    resolveFlag: (leadId: string, flagId: string) =>
      proxyFetch<{ status: string; flagId: string }>(
        `/api/leads/${leadId}/flags/${flagId}/resolve`,
        { method: 'POST' },
      ),
  },
  summary: {
    daily: () => proxyFetch<DailySummary>('/api/summary/daily'),
  },
  properties: {
    list: (status?: string) =>
      proxyFetch<Property[]>(`/api/properties${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    get: (id: string) => proxyFetch<PropertyDetail>(`/api/properties/${id}`),
    create: (data: Partial<Property>) =>
      proxyFetch<Property>('/api/properties', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Property>) =>
      proxyFetch<Property>(`/api/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      proxyFetch<{ status: string }>(`/api/properties/${id}`, { method: 'DELETE' }),
  },
  agents: {
    list: () => proxyFetch<AgentDetail[]>('/api/agents'),
    get: (id: string) => proxyFetch<AgentDetail>(`/api/agents/${id}`),
    create: (data: { name: string; email: string; phone: string }) =>
      proxyFetch<AgentDetail>('/api/agents', { method: 'POST', body: JSON.stringify(data) }),
    addAvailability: (
      agentId: string,
      slot: { dayOfWeek: number; startTime: string; endTime: string },
    ) =>
      proxyFetch<AgentAvailability>(`/api/agents/${agentId}/availability`, {
        method: 'POST',
        body: JSON.stringify(slot),
      }),
    deleteAvailability: (agentId: string, slotId: string) =>
      proxyFetch<{ status: string }>(`/api/agents/${agentId}/availability/${slotId}`, {
        method: 'DELETE',
      }),
  },
};
