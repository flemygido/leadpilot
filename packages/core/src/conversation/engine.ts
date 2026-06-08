import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { LLMClient } from '../llm/llm.interface.js';
import type { WhatsAppProvider } from '../whatsapp/provider.interface.js';
import type { QualificationUpdate } from '../llm/llm.interface.js';
import { computeLeadScore, classifyLead } from '../qualification/scoring.js';
import { assertTransition } from './state-machine.js';
import type { LeadState, LeadClassification } from '@leadpilot/db';
import type { HotLeadRouter } from '../routing/hot-lead-router.js';
import type { FollowUpService } from '../followups/follow-up.service.js';
import type { VisitService } from '../visits/visit.service.js';
import { reviewTurn } from './reviewer.js';

export interface ConversationEngineOptions {
  db: PrismaClient;
  llm: LLMClient;
  whatsapp: WhatsAppProvider;
  logger: Logger;
  hotLeadRouter?: HotLeadRouter;
  followUpService?: FollowUpService;
  visitService?: VisitService;
}

export class ConversationEngine {
  private db: PrismaClient;
  private llm: LLMClient;
  private whatsapp: WhatsAppProvider;
  private logger: Logger;
  private hotLeadRouter?: HotLeadRouter;
  private followUpService?: FollowUpService;
  private visitService?: VisitService;

  constructor({
    db,
    llm,
    whatsapp,
    logger,
    hotLeadRouter,
    followUpService,
    visitService,
  }: ConversationEngineOptions) {
    this.db = db;
    this.llm = llm;
    this.whatsapp = whatsapp;
    this.logger = logger;
    this.hotLeadRouter = hotLeadRouter;
    this.followUpService = followUpService;
    this.visitService = visitService;
  }

  async process(leadId: string, incomingMessage: string): Promise<void> {
    const log = this.logger.child({ leadId, module: 'ConversationEngine' });

    // 1. Load lead
    const lead = await this.db.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      log.error('Lead not found');
      throw new Error(`Lead not found: ${leadId}`);
    }

    // 2. AI paused check
    if (lead.aiPaused) {
      log.info('aiPaused=true — skipping AI response');
      return;
    }

    // 3. Load or create conversation
    let conversation = await this.db.conversation.findUnique({ where: { leadId } });
    if (!conversation) {
      conversation = await this.db.conversation.create({ data: { leadId } });
    }

    // 4. Load recent history (last 20 messages for context window)
    const recentMessages = await this.db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // 5. Persist the inbound message
    await this.db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'lead',
        direction: 'inbound',
        body: incomingMessage,
      },
    });

    // Update lastInboundAt
    await this.db.lead.update({
      where: { id: leadId },
      data: { lastInboundAt: new Date() },
    });

    // Explicit consent flow (DPDP Act 2023 + WhatsApp Business Policy)
    // If the lead has not yet consented, send a one-time opt-in request.
    // Check if their current message is an opt-in confirmation before proceeding.
    if (!lead.consent) {
      const optsIn = isConsentConfirmation(incomingMessage);
      if (!optsIn) {
        const consentMsg =
          `Hi! 👋 I'm the LeadPilot assistant. Before we chat, I need your permission to contact you about property options and to remember our conversation (as required by the DPDP Act 2023).\n\n` +
          `Reply *YES* to continue — or *STOP* if you'd prefer not to hear from us.`;

        await this.db.message.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            direction: 'outbound',
            body: consentMsg,
          },
        });
        await this.whatsapp.sendMessage(lead.phone, consentMsg, lead);
        return;
      }
      // They opted in
      await this.db.lead.update({
        where: { id: leadId },
        data: { consent: true, consentSource: 'explicit_optin', consentAt: new Date() },
      });
      log.info('Explicit consent granted');
    }

    // 6. Build LLM call params
    const history = recentMessages.map((m: { role: string; body: string }) => ({
      role: m.role === 'lead' ? ('lead' as const) : ('assistant' as const),
      body: m.body,
    }));

    const existingQualRecord = await this.db.qualificationResult.findUnique({ where: { leadId } });
    const leadContext = {
      id: lead.id,
      name: lead.name,
      state: lead.state,
      phone: lead.phone,
      existingQual: existingQualRecord
        ? {
            intent: existingQualRecord.intent as QualificationUpdate['intent'],
            propertyType: existingQualRecord.propertyType as QualificationUpdate['propertyType'],
            bhk: existingQualRecord.bhk ?? undefined,
            budgetMin: existingQualRecord.budgetMin ?? undefined,
            budgetMax: existingQualRecord.budgetMax ?? undefined,
            preferredLocations: existingQualRecord.preferredLocations,
            timeline: existingQualRecord.timeline as QualificationUpdate['timeline'],
            financing: existingQualRecord.financing as QualificationUpdate['financing'],
            name: existingQualRecord.name ?? undefined,
          }
        : undefined,
    };

    // 7. Call LLM
    let llmResponse;
    try {
      llmResponse = await this.llm.call({ leadContext, history, incomingMessage });
    } catch (err) {
      log.error({ err }, 'LLM call failed — skipping response');
      return;
    }

    const { reply, nextAction, qualificationUpdate } = llmResponse;

    log.info({ nextAction, llm: this.llm.name }, 'LLM response received');

    // 8. Upsert QualificationResult
    await this.upsertQualification(leadId, qualificationUpdate);

    // 9. Load updated qualification for scoring
    const qual = await this.db.qualificationResult.findUnique({ where: { leadId } });

    // 10. Compute score and classification
    const score = computeLeadScore({
      intent: qual?.intent,
      budgetMin: qual?.budgetMin,
      budgetMax: qual?.budgetMax,
      timeline: qual?.timeline,
      propertyType: qual?.propertyType,
      bhk: qual?.bhk,
      preferredLocations: qual?.preferredLocations ?? [],
      name: qual?.name,
      financing: qual?.financing,
      preferredContactTime: qual?.preferredContactTime,
    });
    const classification: LeadClassification = classifyLead(score);

    // 11. Determine next state
    const nextState = resolveNextState(lead.state, nextAction, score);

    // 12. Apply state transition (validate, persist, update lead)
    let updatedName = lead.name;
    if (qualificationUpdate.name && !lead.name) {
      updatedName = qualificationUpdate.name;
    }

    if (nextState !== lead.state) {
      try {
        assertTransition(lead.state, nextState);
        await this.db.stateTransition.create({
          data: {
            leadId,
            fromState: lead.state,
            toState: nextState,
            reason: nextAction,
          },
        });
      } catch (err) {
        log.warn(
          { err, fromState: lead.state, toState: nextState },
          'Invalid transition — keeping current state',
        );
      }
    }

    await this.db.lead.update({
      where: { id: leadId },
      data: {
        state: nextState,
        score,
        classification,
        ...(updatedName ? { name: updatedName } : {}),
      },
    });

    log.info({ score, classification, state: nextState }, 'Lead updated');

    // 13. Routing — notify agent if newly HOT
    const wasHot = lead.classification === 'HOT';
    if (!wasHot && classification === 'HOT' && this.hotLeadRouter) {
      try {
        await this.hotLeadRouter.notifyAgent(leadId);
      } catch (err) {
        log.error({ err }, 'Hot lead notification failed (non-fatal)');
      }
    }

    // 14. Follow-up enrollment — enroll NURTURE leads
    if (classification === 'NURTURE' && lead.classification !== 'HOT' && this.followUpService) {
      try {
        await this.followUpService.enrollLead(leadId);
      } catch (err) {
        log.error({ err }, 'Follow-up enrollment failed (non-fatal)');
      }
    }

    // 15. Visit scheduling — only trigger when actually moving into/within VISIT_OFFERED
    let finalReply = reply;
    if (nextAction === 'offer_visit' && nextState === 'VISIT_OFFERED' && this.visitService) {
      try {
        if (lead.state === 'VISIT_OFFERED') {
          // Lead already saw slots — check if they actually picked one (1, 2, or 3)
          const slotChoice = detectSlotChoice(incomingMessage);
          if (slotChoice != null) {
            finalReply = await this.visitService.confirmVisit(leadId, slotChoice);
          } else {
            // Ambiguous response — re-offer the slots, don't auto-confirm
            log.info({ slotChoice }, 'No slot choice detected — re-offering slots');
            finalReply = await this.visitService.offerSlots(leadId);
          }
        } else {
          // Transitioning into VISIT_OFFERED — offer slots for the first time
          finalReply = await this.visitService.offerSlots(leadId);
        }
      } catch (err) {
        log.error({ err }, 'VisitService failed — using LLM reply as fallback');
      }
    }

    // 16. Persist outbound message
    await this.db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        direction: 'outbound',
        body: finalReply,
      },
    });

    // 17. Send via WhatsApp
    const updatedLead = await this.db.lead.findUniqueOrThrow({ where: { id: leadId } });
    try {
      await this.whatsapp.sendMessage(lead.phone, finalReply, updatedLead);
    } catch (err) {
      log.error({ err }, 'Failed to send WhatsApp message');
    }

    // 18. Conversation review — flag any off behaviour non-fatally
    try {
      await reviewTurn(this.db, {
        leadId,
        incomingMessage,
        aiReply: finalReply,
        leadStateBefore: lead.state,
        nextAction,
        nextState,
        existingQual: existingQualRecord,
      });
    } catch (err) {
      log.warn({ err }, 'ConversationReviewer failed (non-fatal)');
    }
  }

  private async upsertQualification(leadId: string, update: QualificationUpdate): Promise<void> {
    const existing = await this.db.qualificationResult.findUnique({ where: { leadId } });

    const data = {
      ...(update.intent ? { intent: update.intent } : {}),
      ...(update.propertyType ? { propertyType: update.propertyType } : {}),
      ...(update.bhk != null ? { bhk: update.bhk } : {}),
      ...(update.budgetMin != null ? { budgetMin: update.budgetMin } : {}),
      ...(update.budgetMax != null ? { budgetMax: update.budgetMax } : {}),
      ...(update.preferredLocations ? { preferredLocations: update.preferredLocations } : {}),
      ...(update.timeline ? { timeline: update.timeline } : {}),
      ...(update.financing ? { financing: update.financing } : {}),
      ...(update.name ? { name: update.name } : {}),
      ...(update.notes ? { notes: update.notes } : {}),
    };

    if (existing) {
      await this.db.qualificationResult.update({ where: { leadId }, data });
    } else {
      await this.db.qualificationResult.create({ data: { leadId, ...data } });
    }
  }
}

function resolveNextState(currentState: LeadState, nextAction: string, score: number): LeadState {
  switch (nextAction) {
    case 'handoff':
      return 'HANDED_OFF';

    case 'close_won':
      // Only reachable from HANDED_OFF (agent manually marks deal closed)
      return currentState === 'HANDED_OFF' ? 'CLOSED_WON' : currentState;

    case 'close_lost':
      return 'CLOSED_LOST';

    case 'offer_visit':
      // Step through intermediate states to respect the state machine
      if (currentState === 'QUALIFIED_HOT' || currentState === 'NURTURING') return 'VISIT_OFFERED';
      if (currentState === 'QUALIFYING' || currentState === 'QUALIFIED_COLD') {
        return score >= 70 ? 'QUALIFIED_HOT' : 'QUALIFYING';
      }
      if (currentState === 'GREETED') return 'QUALIFYING';
      return currentState; // e.g. already VISIT_OFFERED — handled by visitService.confirmVisit

    case 'qualify': {
      if (
        currentState === 'QUALIFYING' ||
        currentState === 'QUALIFIED_COLD' ||
        currentState === 'NURTURING'
      ) {
        if (score >= 70) return 'QUALIFIED_HOT';
        return 'QUALIFYING';
      }
      if (currentState === 'GREETED') return 'QUALIFYING';
      return currentState;
    }

    case 'nurture':
      return 'NURTURING';

    case 'continue': {
      if (currentState === 'NEW') return 'GREETED';
      return currentState;
    }

    default:
      return currentState;
  }
}

/** Returns true when the lead's message is a clear opt-in confirmation. */
function isConsentConfirmation(msg: string): boolean {
  return /^\s*(yes|haan|ha|ok|okay|sure|agree|accepted?|i\s+agree)\s*$/i.test(msg.trim());
}

/**
 * Returns 1/2/3 if the message clearly picks a slot, otherwise null.
 *
 * Bare digits (1/2/3) only count when they are the entire message or are
 * preceded/followed only by whitespace/punctuation — prevents false positives
 * like "I have 2 properties" or "2 BHK" from booking slot 2.
 *
 * Also recognises common Hinglish replies:
 *   pehla / pehle / pehla wala → 1
 *   doosra / dusra / doosre → 2
 *   teesra / tisra → 3
 */
export function detectSlotChoice(msg: string): number | null {
  const m = msg.trim().toLowerCase();

  // Explicit label matches (always safe regardless of surrounding text)
  if (/\b(one|first|option\s*1|slot\s*1|#\s*1|pehla?|pehle(\s+wala)?)\b/.test(m)) return 1;
  if (/\b(two|second|option\s*2|slot\s*2|#\s*2|do+sra?|du+sra?|doosre)\b/.test(m)) return 2;
  if (/\b(three|third|option\s*3|slot\s*3|#\s*3|te+sra?|ti+sra?)\b/.test(m)) return 3;

  // Bare digit — only if the trimmed message is JUST that digit (possibly with punctuation)
  if (/^[^\d]*1[^\d]*$/.test(m)) return 1;
  if (/^[^\d]*2[^\d]*$/.test(m)) return 2;
  if (/^[^\d]*3[^\d]*$/.test(m)) return 3;

  return null;
}
