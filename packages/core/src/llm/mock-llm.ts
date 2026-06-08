import type {
  LLMClient,
  LLMCallParams,
  LLMResponse,
  QualificationUpdate,
  NextAction,
} from './llm.interface.js';

/** Keyword-based deterministic LLM for local development (no API key required). */
export class MockLLM implements LLMClient {
  readonly name = 'mock';

  call({ leadContext, incomingMessage }: LLMCallParams): Promise<LLMResponse> {
    const msg = incomingMessage.toLowerCase();

    // Follow-up system prompts contain price figures that must not be extracted as lead budget.
    const isFollowUpPrompt = msg.startsWith('[follow-up step');

    const qual: QualificationUpdate = {};

    // --- intent detection ---
    if (/\brent\b/.test(msg)) qual.intent = 'rent';
    else if (/\bbuy\b|\bpurchase\b/.test(msg)) qual.intent = 'buy';

    // --- property type ---
    if (/\bvilla\b/.test(msg)) qual.propertyType = 'villa';
    else if (/\bapartment\b|\bflat\b/.test(msg)) qual.propertyType = 'apartment';
    else if (/\bplot\b|\bland\b/.test(msg)) qual.propertyType = 'plot';
    else if (/\bcommercial\b|\boffice\b|\bshop\b/.test(msg)) qual.propertyType = 'commercial';

    // --- BHK ---
    const bhkMatch = msg.match(/(\d)\s*(?:bhk|bedroom)/);
    if (bhkMatch) qual.bhk = parseInt(bhkMatch[1] as string, 10);

    // --- budget (handles "80 lakh", "1.5 crore", "2cr") ---
    // Skip budget extraction for system-generated follow-up prompts to prevent
    // the bot's own property price from being written as the lead's budget.
    if (!isFollowUpPrompt) {
      const lakhMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:lakh|l\b)/i);
      const croreMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr\b)/i);
      if (croreMatch) {
        const lakhs = parseFloat(croreMatch[1] as string) * 100;
        qual.budgetMin = lakhs * 0.9 * 100_000; // store in rupees
        qual.budgetMax = lakhs * 1.1 * 100_000;
      } else if (lakhMatch) {
        const lakhs = parseFloat(lakhMatch[1] as string);
        qual.budgetMin = lakhs * 0.9 * 100_000; // store in rupees
        qual.budgetMax = lakhs * 1.1 * 100_000;
      }
    }

    // --- timeline ---
    if (/\bimmediate(?:ly)?\b|\basap\b|\burgent\b/.test(msg)) qual.timeline = 'immediate';
    else if (/\b1[\s-]?3\s*month|\bone\s+to\s+three/.test(msg)) qual.timeline = '1_3_months';
    else if (/\b3[\s-]?6\s*month|\bthree\s+to\s+six/.test(msg)) qual.timeline = '3_6_months';
    else if (/\bexplor|\bjust\s+looking|\bbrowsing/.test(msg)) qual.timeline = 'exploring';

    // --- financing ---
    if (/\bloan\b|\bemi\b|\bfinance\b/.test(msg)) qual.financing = 'loan';
    else if (/\bcash\b/.test(msg)) qual.financing = 'cash';

    // --- name extraction ---
    // "my name is X" or "I'm X" — but NOT "I am interested / I am looking / I am ready"
    const nameMatch = msg.match(/(?:my name is|i'm)\s+([a-z]+)/i)
      ?? msg.match(/i am\s+([a-z]+)/i);
    if (nameMatch) {
      const candidate = (nameMatch[1] as string).toLowerCase();
      const stopWords = new Set(['interested', 'looking', 'ready', 'a', 'the', 'an', 'not', 'very', 'just', 'also', 'here', 'there']);
      if (!stopWords.has(candidate)) {
        qual.name = capitalize(nameMatch[1] as string);
      }
    }

    // Merge current-turn extractions with existing DB state for action + reply
    const accumulated: QualificationUpdate = { ...leadContext.existingQual, ...qual };

    // --- next action ---
    const nextAction = resolveNextAction(msg, leadContext.state, accumulated);

    const reply = buildReply(leadContext.name ?? null, accumulated, nextAction, msg);

    return Promise.resolve({ reply, nextAction, qualificationUpdate: qual });
  }
}

function isKnown(v: string | undefined): boolean {
  return !!v && v !== 'unknown';
}

function resolveNextAction(msg: string, state: string, qual: QualificationUpdate): NextAction {
  if (/\bhuman\b|\bagent\b|\bspeak\b|\bcall\s+me\b/.test(msg)) return 'handoff';
  if (/\bnot\s+interested\b|\bno\s+thanks\b|\bstop\b/.test(msg)) return 'close_lost';

  const hasEnoughData =
    isKnown(qual.intent) &&
    qual.budgetMin != null &&
    isKnown(qual.timeline) &&
    isKnown(qual.propertyType);

  if (hasEnoughData) {
    // Exploring timeline → nurture (not ready for visit, but keep warm)
    if (qual.timeline === 'exploring') return 'nurture';
    const isHot = qual.intent === 'buy' && qual.timeline === 'immediate';
    if (isHot) return 'offer_visit';
    return 'qualify';
  }

  if (state === 'NEW' || state === 'GREETED') return 'continue';
  return 'qualify';
}

function buildReply(
  name: string | null,
  qual: QualificationUpdate,
  nextAction: NextAction,
  _msg: string,
): string {
  const greeting = name ? `Hi ${name}` : 'Hi there';

  if (nextAction === 'handoff') {
    return `${greeting}! Let me connect you with one of our senior agents right away. 😊`;
  }
  if (nextAction === 'close_lost') {
    return `No problem at all! If you ever decide to explore properties in the future, we're always here to help. Take care! 🙏`;
  }
  if (nextAction === 'offer_visit') {
    return `${greeting}! Based on what you've shared, I think we have some great options for you. Would you like to schedule a site visit this week?`;
  }

  // Ask the next missing question (treat "unknown" same as not-set)
  if (!isKnown(qual.intent)) {
    return `${greeting}! Are you looking to buy or rent a property? 🏡`;
  }
  if (!isKnown(qual.propertyType)) {
    return `Great! Are you looking for an apartment, villa, plot, or commercial space?`;
  }
  if (!qual.bhk) {
    return `Got it! How many bedrooms (BHK) are you looking for?`;
  }
  if (qual.budgetMin == null) {
    return `Perfect! What's your budget range? (Feel free to mention in lakhs or crores)`;
  }
  if (!isKnown(qual.timeline)) {
    return `Wonderful! When are you planning to move — are you looking immediately, in the next few months, or just exploring for now?`;
  }
  if (!isKnown(qual.financing)) {
    return `Almost there! Will you be going for a home loan or paying in cash?`;
  }

  return `${greeting}! Thanks for sharing that. Let me find the best options for you. I'll be in touch shortly! 🙏`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
