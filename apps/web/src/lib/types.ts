// API response shapes — mirrors Prisma output from GET /api/leads and /api/leads/:id

export type LeadState =
  | 'NEW'
  | 'GREETED'
  | 'QUALIFYING'
  | 'QUALIFIED_HOT'
  | 'QUALIFIED_COLD'
  | 'NURTURING'
  | 'VISIT_OFFERED'
  | 'VISIT_SCHEDULED'
  | 'HANDED_OFF'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';

export type LeadClassification = 'HOT' | 'NURTURE' | 'UNSCORED';

export interface QualificationResult {
  intent: string;
  propertyType: string;
  bhk: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredLocations: string[];
  timeline: string;
  financing: string;
  name: string | null;
  preferredContactTime: string | null;
  notes: string | null;
}

export interface StateTransition {
  id: string;
  fromState: LeadState;
  toState: LeadState;
  reason: string | null;
  createdAt: string;
}

export interface SiteVisit {
  id: string;
  scheduledAt: string;
  status: 'offered' | 'confirmed' | 'cancelled' | 'completed';
  durationMinutes: number;
  notes: string | null;
  confirmedAt: string | null;
  propertyId: string | null;
  property?: { id: string; title: string; location: string } | null;
}

// ─── Property ───────────────────────────────────────────────────────────────

export type PropertyStatus = 'available' | 'negotiating' | 'sold';

export interface PropertyVisit {
  id: string;
  scheduledAt: string;
  status: string;
  durationMinutes: number;
  lead: { id: string; name: string | null; phone: string; state: string; score: number };
  agent: { id: string; name: string };
}

export interface InterestedLead {
  id: string;
  name: string | null;
  phone: string;
  state: string;
  score: number;
  qualificationResult: {
    intent: string;
    timeline: string;
    budgetMin: number | null;
    budgetMax: number | null;
    bhk: number | null;
  } | null;
}

export interface PropertyDetail extends Property {
  siteVisits: PropertyVisit[];
  interestedLeads: InterestedLead[];
}

// ─── Agent ──────────────────────────────────────────────────────────────────

export interface AgentAvailability {
  id: string;
  agentId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface AgentDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  availabilities: AgentAvailability[];
  _count: { leads: number; properties: number };
}

export interface Message {
  id: string;
  role: 'lead' | 'assistant' | 'agent' | 'system';
  direction: 'inbound' | 'outbound';
  body: string;
  createdAt: string;
}

export interface FollowUpJob {
  id: string;
  sequenceStep: number;
  runAt: string;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
}

export interface Lead {
  id: string;
  phone: string;
  name: string | null;
  state: LeadState;
  classification: LeadClassification;
  score: number;
  aiPaused: boolean;
  consent: boolean;
  source: string;
  lastInboundAt: string | null;
  createdAt: string;
  updatedAt: string;
  agent: { id: string; name: string };
  qualificationResult: QualificationResult | null;
  stateTransitions: StateTransition[];
  siteVisits: SiteVisit[];
  followUpJobs: FollowUpJob[];
  conversationFlags: ConversationFlag[];
  conversation?: {
    messages: Message[];
  };
}

export interface ConversationFlag {
  id: string;
  severity: 'low' | 'medium' | 'high';
  category: 'wrong_action' | 'repeated_question' | 'state_jump' | 'missing_context' | 'tone';
  description: string;
  snippet: string | null;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  newLeads: number;
  hotLeads: number;
  upcomingVisits: number;
  pendingFollowUps: number;
  dealsWon: number;
  conversionRate: number;
  visits: Array<{
    scheduledAt: string;
    lead: { name: string | null; phone: string };
  }>;
}

// Add reraNumber to Property (schema addition)
export interface Property {
  id: string;
  title: string;
  description: string | null;
  propertyType: string;
  bhk: number | null;
  areaSqft: number | null;
  priceMin: number;
  priceMax: number;
  location: string;
  address: string | null;
  status: PropertyStatus;
  isAvailable: boolean;
  amenities: string[];
  reraNumber: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  agentId: string | null;
  agent: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { siteVisits: number };
}
