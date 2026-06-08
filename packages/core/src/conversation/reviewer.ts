import type { PrismaClient } from '@prisma/client';
import type { LeadState } from '@leadpilot/db';
import type { NextAction, QualificationUpdate } from '../llm/llm.interface.js';
import { detectSlotChoice } from './engine.js';

interface ReviewTurnInput {
  leadId: string;
  incomingMessage: string;
  aiReply: string;
  leadStateBefore: LeadState;
  nextAction: NextAction;
  nextState: LeadState;
  existingQual: { intent?: string; propertyType?: string; timeline?: string; financing?: string } | null;
}

/**
 * Rule-based conversation reviewer.
 * Runs after every engine turn and creates ConversationFlag records for
 * detected issues. Non-fatal — exceptions must be caught by the caller.
 */
export async function reviewTurn(db: PrismaClient, input: ReviewTurnInput): Promise<void> {
  const flags: Array<{
    severity: string;
    category: string;
    description: string;
    snippet?: string;
  }> = [];

  const { incomingMessage, aiReply, leadStateBefore, nextAction, existingQual } = input;
  const msgLower = incomingMessage.toLowerCase();

  // --- Rule 1: Wrong auto-confirmation ---
  // If lead was in VISIT_OFFERED and AI booked a visit without the user picking a slot
  if (
    leadStateBefore === 'VISIT_OFFERED' &&
    nextAction === 'offer_visit' &&
    detectSlotChoice(incomingMessage) === null &&
    /confirmed|site visit is confirmed/i.test(aiReply)
  ) {
    flags.push({
      severity: 'high',
      category: 'wrong_action',
      description:
        'AI confirmed a site visit booking but the user did not select a slot number (1, 2, or 3).',
      snippet: `User: "${incomingMessage.slice(0, 80)}"`,
    });
  }

  // --- Rule 2: Repeated question for already-known info ---
  const qual = existingQual ?? {};
  const knownIntent = qual.intent && qual.intent !== 'unknown';
  const knownPropertyType = qual.propertyType && qual.propertyType !== 'unknown';
  const knownTimeline = qual.timeline && qual.timeline !== 'unknown';
  const knownFinancing = qual.financing && qual.financing !== 'unknown';

  if (knownIntent && /buy or rent|looking to buy|looking to rent/i.test(aiReply)) {
    flags.push({
      severity: 'medium',
      category: 'repeated_question',
      description: `AI asked about buy/rent intent but it was already known as "${qual.intent}".`,
      snippet: extractFirstLine(aiReply),
    });
  }
  if (knownPropertyType && /apartment.*villa.*plot|which type.*property/i.test(aiReply)) {
    flags.push({
      severity: 'medium',
      category: 'repeated_question',
      description: `AI asked about property type but it was already known as "${qual.propertyType}".`,
      snippet: extractFirstLine(aiReply),
    });
  }
  if (knownTimeline && /when.*planning.*move|how soon|immediately.*few months.*exploring/i.test(aiReply)) {
    flags.push({
      severity: 'low',
      category: 'repeated_question',
      description: `AI asked about timeline but it was already known as "${qual.timeline}".`,
      snippet: extractFirstLine(aiReply),
    });
  }
  if (knownFinancing && /home loan.*cash|paying in cash|going for a loan/i.test(aiReply)) {
    flags.push({
      severity: 'low',
      category: 'repeated_question',
      description: `AI asked about financing but it was already known as "${qual.financing}".`,
      snippet: extractFirstLine(aiReply),
    });
  }

  // --- Rule 3: Abrupt close without full qualification ---
  const hasEnoughQual = knownIntent && knownPropertyType && knownTimeline;
  if (
    !hasEnoughQual &&
    /i'll be in touch|find the best options|get back to you shortly/i.test(aiReply) &&
    nextAction === 'qualify'
  ) {
    flags.push({
      severity: 'medium',
      category: 'missing_context',
      description:
        'AI gave a generic closing reply before finishing qualification (intent/propertyType/timeline not all known).',
      snippet: extractFirstLine(aiReply),
    });
  }

  // --- Rule 4: User expressed frustration but AI ignored it ---
  if (
    /frustrated|useless|not helpful|you don't understand|what the hell|waste of time/i.test(msgLower) &&
    !/sorry|apologi|understand your frustration/i.test(aiReply.toLowerCase())
  ) {
    flags.push({
      severity: 'high',
      category: 'tone',
      description: 'User expressed frustration but AI response did not acknowledge it.',
      snippet: `User: "${incomingMessage.slice(0, 80)}"`,
    });
  }

  // --- Rule 5: Handoff missed — user explicitly asked for agent ---
  if (
    /speak.*(?:agent|human|person|someone)|call\s*me|talk.*agent/i.test(msgLower) &&
    nextAction !== 'handoff'
  ) {
    flags.push({
      severity: 'high',
      category: 'wrong_action',
      description: 'User asked to speak to a human agent but AI did not trigger handoff.',
      snippet: `User: "${incomingMessage.slice(0, 80)}", Action: ${nextAction}`,
    });
  }

  // Persist flags
  if (flags.length > 0) {
    await db.conversationFlag.createMany({
      data: flags.map((f) => ({ leadId: input.leadId, ...f })),
    });
  }
}

function extractFirstLine(text: string): string {
  return text.split('\n').find((l) => l.trim().length > 0)?.slice(0, 100) ?? text.slice(0, 100);
}
