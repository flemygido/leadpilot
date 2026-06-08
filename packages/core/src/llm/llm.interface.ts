import type { LeadState } from '@leadpilot/db';

export type NextAction =
  | 'continue'
  | 'qualify'
  | 'offer_visit'
  | 'handoff'
  | 'close_lost'
  | 'close_won'
  | 'nurture';

export interface ConversationMessage {
  role: 'lead' | 'assistant';
  body: string;
}

export interface LeadContext {
  id: string;
  name: string | null;
  state: LeadState;
  phone: string;
  existingQual?: QualificationUpdate;
}

export interface QualificationUpdate {
  intent?: 'buy' | 'rent' | 'unknown';
  propertyType?: 'apartment' | 'villa' | 'plot' | 'commercial' | 'unknown';
  bhk?: number;
  budgetMin?: number;
  budgetMax?: number;
  preferredLocations?: string[];
  timeline?: 'immediate' | '1_3_months' | '3_6_months' | 'exploring' | 'unknown';
  financing?: 'loan' | 'loan_preapproved' | 'cash' | 'unknown';
  name?: string;
  notes?: string;
}

export interface LLMResponse {
  reply: string;
  nextAction: NextAction;
  qualificationUpdate: QualificationUpdate;
}

export interface LLMCallParams {
  leadContext: LeadContext;
  history: ConversationMessage[];
  incomingMessage: string;
}

export interface LLMClient {
  readonly name: string;
  call(params: LLMCallParams): Promise<LLMResponse>;
}
