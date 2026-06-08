# LeadPilot — QA Test Plan

> Maintained by the `qa-engineer` subagent. Maps every requirement from `docs/REQUIREMENTS.md` to the tests that prove it.

---

## §5.2 — Core User Journey

| # | Requirement | Test(s) | Location | Status |
|---|-------------|---------|----------|--------|
| 5.2.1 | Lead enters via inbound WhatsApp | `webhook POST /webhooks/whatsapp creates Lead and triggers greeting` | `apps/api/src/routes/webhooks.test.ts` | PLANNED |
| 5.2.1 | Lead enters via portal webhook | `POST /webhooks/lead creates Lead with state NEW` | `apps/api/src/routes/webhooks.test.ts` | PLANNED |
| 5.2.2 | Greeting sent within 60s of lead creation | `ConversationEngine.handleNew() sends greeting message` | `packages/core/conversation/engine.test.ts` | PLANNED |
| 5.2.3 | Engine qualifies through natural conversation | `engine processes 3+ exchanges and extracts qualification` | `packages/core/conversation/engine.test.ts` | PLANNED |
| 5.2.4 | Lead scored and classified HOT or NURTURE | `scoring returns HOT for score>=70, NURTURE otherwise` | `packages/core/qualification/scoring.test.ts` | PLANNED |
| 5.2.5 | HOT → agent notified + visit offered | `routeHotLead() creates Notification and transitions to VISIT_OFFERED` | `packages/core/routing/routing.test.ts` | PLANNED |
| 5.2.6 | COLD/NURTURE → follow-up sequence enrolled | `enrollNurture() creates FollowUpJobs for Day1/3/7/14` | `packages/core/followups/followups.test.ts` | PLANNED |
| 5.2.6 | Each follow-up is context-aware | `generateFollowUp() includes lead context, not canned text` | `packages/core/followups/followups.test.ts` | PLANNED |
| 5.2.7 | Lead requests site visit → slots offered and booked | `offerSlots() sends available times; bookVisit() creates SiteVisit` | `packages/core/scheduling/scheduling.test.ts` | PLANNED |
| 5.2.8 | Lead asks for human → HANDED_OFF | `engine detects handoff trigger and transitions to HANDED_OFF` | `packages/core/conversation/engine.test.ts` | PLANNED |
| 5.2.9 | Agent can take over → AI paused | `Lead.ai_paused=true stops engine from replying` | `packages/core/conversation/engine.test.ts` | PLANNED |
| 5.2.10 | Agent receives daily summary | `dailySummary() returns correct counts` | `apps/api/src/scheduler/daily-summary.test.ts` | PLANNED |

---

## §5.3 — State Machine

| # | Requirement | Test(s) | Location | Status |
|---|-------------|---------|----------|--------|
| 5.3.1 | NEW → GREETED valid | `transition(NEW, GREETED) succeeds` | `packages/core/conversation/state-machine.test.ts` | PLANNED |
| 5.3.2 | GREETED → QUALIFYING valid | `transition(GREETED, QUALIFYING) succeeds` | `packages/core/conversation/state-machine.test.ts` | PLANNED |
| 5.3.3 | QUALIFYING → QUALIFIED_HOT valid | `transition(QUALIFYING, QUALIFIED_HOT) succeeds` | `packages/core/conversation/state-machine.test.ts` | PLANNED |
| 5.3.4 | QUALIFYING → QUALIFIED_COLD valid | `transition(QUALIFYING, QUALIFIED_COLD) succeeds` | `packages/core/conversation/state-machine.test.ts` | PLANNED |
| 5.3.5 | HANDED_OFF reachable from any state | `transition(X, HANDED_OFF) succeeds for all X` | `packages/core/conversation/state-machine.test.ts` | PLANNED |
| 5.3.6 | Invalid transitions throw | `transition(NEW, VISIT_SCHEDULED) throws` | `packages/core/conversation/state-machine.test.ts` | PLANNED |
| 5.3.7 | State transitions logged on Lead | `engine persists StateTransition record on every change` | `packages/core/conversation/engine.test.ts` | PLANNED |

---

## §5.4 — Qualification Schema

| # | Requirement | Test(s) | Location | Status |
|---|-------------|---------|----------|--------|
| 5.4.1 | Valid LLM output parses to schema | `QualificationSchema.parse(validOutput) succeeds` | `packages/core/qualification/schema.test.ts` | PLANNED |
| 5.4.2 | Invalid LLM output rejected by Zod | `QualificationSchema.safeParse(invalidOutput).success === false` | `packages/core/qualification/schema.test.ts` | PLANNED |
| 5.4.3 | bhk is number or null | `schema accepts null, integer; rejects string` | `packages/core/qualification/schema.test.ts` | PLANNED |
| 5.4.4 | preferred_locations is string[] | `schema accepts [], ['Pune'], rejects non-array` | `packages/core/qualification/schema.test.ts` | PLANNED |
| 5.4.5 | All enum fields reject unknown values | `intent:"unknown_value" fails parse` | `packages/core/qualification/schema.test.ts` | PLANNED |

---

## §5.5 — Lead Scoring

| # | Requirement | Test(s) | Location | Status |
|---|-------------|---------|----------|--------|
| 5.5.1 | Fully qualified lead scores >= 70 (HOT) | `computeLeadScore(complete) >= 70` | `packages/core/qualification/scoring.test.ts` | PLANNED |
| 5.5.2 | Minimal lead scores < 70 (NURTURE) | `computeLeadScore(empty) < 70` | `packages/core/qualification/scoring.test.ts` | PLANNED |
| 5.5.3 | "immediate" timeline scores highest | `immediate > 1_3_months > 3_6_months > exploring > unknown` | `packages/core/qualification/scoring.test.ts` | PLANNED |
| 5.5.4 | Score is 0–100 | `computeLeadScore(any) >= 0 && <= 100` | `packages/core/qualification/scoring.test.ts` | PLANNED |
| 5.5.5 | classifyLead >= 70 returns HOT | `classifyLead({score:70}) === 'HOT'` | `packages/core/qualification/scoring.test.ts` | PLANNED |
| 5.5.6 | classifyLead < 70 returns NURTURE | `classifyLead({score:69}) === 'NURTURE'` | `packages/core/qualification/scoring.test.ts` | PLANNED |

---

## §5.6 — Guardrails

| # | Requirement | Test(s) | Location | Status |
|---|-------------|---------|----------|--------|
| 5.6.1 | No fabricated property data | `MockLLM never produces price/availability not in DB; system prompt instructs Claude` | `packages/core/conversation/engine.test.ts` | PLANNED |
| 5.6.2 | No proactive message if consent=false | `sendMessage(lead with consent=false) throws ConsentError` | `packages/core/whatsapp/mock-provider.test.ts` | PLANNED |
| 5.6.3 | Follow-up not enqueued if consent=false | `enrollNurture(lead with consent=false) enqueues 0 jobs` | `packages/core/followups/followups.test.ts` | PLANNED |
| 5.6.4 | Mock provider warns on 24h window | `sendMessage outside 24h logs WARN` | `packages/core/whatsapp/mock-provider.test.ts` | PLANNED |
| 5.6.5 | consent, consent_source, consent_at tracked | `Lead schema has all three fields` | `packages/db/prisma/schema.test.ts` | PLANNED |

---

## §5.2 Adversarial Tests

| # | Scenario | Expected | Location | Status |
|---|----------|---------|----------|--------|
| A.1 | Empty string message | Engine replies gracefully, no crash | `packages/core/conversation/engine.test.ts` | PLANNED |
| A.2 | Gibberish / random characters | Engine replies gracefully, stays in QUALIFYING | `packages/core/conversation/engine.test.ts` | PLANNED |
| A.3 | "I want to speak to a human" mid-flow | Engine transitions to HANDED_OFF | `packages/core/conversation/engine.test.ts` | PLANNED |
| A.4 | Lead changes topic mid-qualification | Engine handles gracefully, re-asks missed fields | `packages/core/conversation/engine.test.ts` | PLANNED |
| A.5 | Lead provides budget below all properties | Engine does not fabricate matches | `packages/core/conversation/engine.test.ts` | PLANNED |
| A.6 | Very long message (5000 chars) | No crash, handled within token budget | `packages/core/conversation/engine.test.ts` | PLANNED |
| A.7 | Rapid fire messages (5 in 1s) | No duplicate state transitions | `packages/core/conversation/engine.test.ts` | PLANNED |

---

## Provider Tests

| # | Requirement | Test(s) | Location | Status |
|---|-------------|---------|----------|--------|
| P.1 | MockWhatsAppProvider persists outbound to DB | `sendMessage() creates Message record` | `packages/core/whatsapp/mock-provider.test.ts` | PLANNED |
| P.2 | MockWhatsAppProvider logs to console | `sendMessage() calls logger.info` | `packages/core/whatsapp/mock-provider.test.ts` | PLANNED |
| P.3 | MockWhatsAppProvider.parseInboundWebhook() returns ParsedMessage | `parseInboundWebhook(payload) returns {from, body}` | `packages/core/whatsapp/mock-provider.test.ts` | PLANNED |
| P.4 | MetaCloudProvider is typed (not runtime tested — stub) | TypeScript compiles without error | compile-time | PLANNED |
| P.5 | TwilioProvider is typed (not runtime tested — stub) | TypeScript compiles without error | compile-time | PLANNED |

---

## LLM Layer Tests

| # | Requirement | Test(s) | Location | Status |
|---|-------------|---------|----------|--------|
| L.1 | MockLLM returns deterministic output | `mockLLM.chat(same input) === same output` | `packages/core/llm/mock-llm.test.ts` | PLANNED |
| L.2 | MockLLM requires no API key | `new MockLLM() works without ANTHROPIC_API_KEY` | `packages/core/llm/mock-llm.test.ts` | PLANNED |
| L.3 | ClaudeClient uses correct model | `client sends model: claude-sonnet-4-5` | `packages/core/llm/claude-client.test.ts` | PLANNED |

---

## End-to-End Demo

| # | Requirement | Test(s) | Location | Status |
|---|-------------|---------|----------|--------|
| E.1 | `npm run demo` exits 0 | `e2e: demo script runs end-to-end without crash` | `qa/e2e/demo.test.ts` | PLANNED |
| E.2 | Demo prints readable transcript | `stdout includes: greeting, qualification, HOT, notification, visit booking` | `qa/e2e/demo.test.ts` | PLANNED |
