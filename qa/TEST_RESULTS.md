# LeadPilot — Test Results

> Maintained by the `qa-engineer` subagent. Append-only. One entry per phase gate.

---

## Phase 0 — 2026-06-07

**Phase:** 0 (Foundation & Governance)
**Tests run:** 0 (no runnable code in Phase 0)
**Tests passed:** 0
**Tests failed:** 0
**Coverage:** N/A

**Verification performed:**
- [x] `package.json` exists with correct workspaces
- [x] `tsconfig.base.json` has `strict: true`
- [x] `docker-compose.yml` exists with Postgres service
- [x] `.env.example` lists all required variables
- [x] `docs/REQUIREMENTS.md` contains verbatim Section 5
- [x] `docs/ARCHITECTURE.md` has mermaid component diagram and state machine
- [x] `docs/DECISIONS.md` has ADRs 001–010
- [x] `docs/BUILD_LOG.md` has Phase 0 entry
- [x] `docs/RUNBOOK.md` has skeleton with "Manual setup required" section
- [x] `.claude/agents/qa-engineer.md` exists and is complete
- [x] `qa/TEST_PLAN.md` maps all Section 5 requirements to tests
- [x] `qa/TEST_RESULTS.md` exists (this file)
- [x] `qa/BUG_TRACKER.md` exists

**Verdict: ✅ PASS**

---

<!-- Future phase results appended below -->

---

## Phase 1 — 2026-06-07

**Phase:** 1 (Data Layer)
**Tests run:** 9
**Tests passed:** 9
**Tests failed:** 0
**Coverage:** Schema enums and exports (100% of Phase 1 public API)

**Tests in:** `packages/db/src/__tests__/schema.test.ts`

**What was verified:**
- [x] `LeadState` enum has exactly all 11 states required by §5.3
- [x] `LeadClassification` has HOT, NURTURE, UNSCORED
- [x] `MessageRole` has all 4 roles (lead/assistant/agent/system)
- [x] `MessageDirection` has inbound/outbound
- [x] `FollowUpStatus` has all lifecycle states
- [x] `SiteVisitStatus` has all 4 states
- [x] `NotificationType` has all 4 types
- [x] `packages/db` index re-exports everything required
- [x] Schema includes `consent`, `consent_source`, `consent_at`, `last_inbound_at`, `ai_paused` on Lead

**Verdict: ✅ PASS**

---

## Phase 2 — 2026-06-07


**Phase:** 2 (WhatsApp Provider Abstraction)
**Tests run:** 22 new (31 total)
**Tests passed:** 22 new (31 total)
**Tests failed:** 0

**Tests in:** `packages/core/src/whatsapp/__tests__/consent.test.ts`, `packages/core/src/whatsapp/__tests__/mock-provider.test.ts`

**What was verified:**
- [x] `assertConsent` throws `ConsentError` when consent=false (§5.6)
- [x] `assertConsent` allows send when consent=true
- [x] `isWithin24hWindow` correctly handles null, within-24h, boundary, and over-24h cases (§5.6)
- [x] `MockWhatsAppProvider.sendMessage` persists outbound message to DB (P.1)
- [x] `MockWhatsAppProvider.sendMessage` logs via logger.info (P.2)
- [x] `MockWhatsAppProvider.sendMessage` throws `ConsentError` for proactive=true, consent=false (§5.6)
- [x] `MockWhatsAppProvider.sendMessage` allows reply (proactive=false) even without consent
- [x] `MockWhatsAppProvider.sendMessage` warns on 24h window violation (§5.6, ADR-001)
- [x] `MockWhatsAppProvider.parseInboundWebhook` returns `ParsedInboundMessage` for valid payload (P.3)
- [x] `MockWhatsAppProvider.parseInboundWebhook` returns null for missing fields, null input, non-object

**Verdict: ✅ PASS**

---

## Phase 3 — 2026-06-07

**Phase:** 3 (LLM Layer + Conversation Engine)
**Tests run:** 39 new (70 total)
**Tests passed:** 39 new (70 total)
**Tests failed:** 0

**Tests in:**
- `packages/core/src/conversation/__tests__/scoring.test.ts` (12 tests)
- `packages/core/src/conversation/__tests__/state-machine.test.ts` (9 tests)
- `packages/core/src/conversation/__tests__/mock-llm.test.ts` (13 tests)
- `packages/core/src/conversation/__tests__/engine.test.ts` (14 tests)

**What was verified:**
- [x] `computeLeadScore` returns 0 for empty input (UNSCORED path)
- [x] Scoring weights match ADR-003 exactly (intent, budget, timeline, propertyType, BHK, locations)
- [x] Score capped at 100 for fully-qualified leads
- [x] `classifyLead(0)` → UNSCORED; `classifyLead(1-69)` → NURTURE; `classifyLead(70+)` → HOT
- [x] State machine covers all 11 LeadState values
- [x] HANDED_OFF reachable from all 8 non-terminal states (§5.3)
- [x] Terminal states (CLOSED_WON, CLOSED_LOST) have no outgoing transitions
- [x] `assertTransition` throws `InvalidTransitionError` with correct `fromState`/`toState`
- [x] `MockLLM` is deterministic (same input → same output)
- [x] `MockLLM` extracts intent=buy/rent, propertyType, BHK, budget (lakh/crore), timeline, financing, name
- [x] `MockLLM` returns `handoff` when user asks for human
- [x] `MockLLM` returns `close_lost` when user says "not interested"
- [x] `MockLLM` returns `offer_visit` when fully qualified + immediate timeline
- [x] `ConversationEngine` throws for missing lead
- [x] `ConversationEngine` skips LLM when `aiPaused=true` (§5.5)
- [x] `ConversationEngine` creates conversation if none exists
- [x] `ConversationEngine` persists inbound message with role=lead, direction=inbound
- [x] `ConversationEngine` grants consent on first inbound message (§5.6 DPDP)
- [x] `ConversationEngine` does NOT overwrite existing consent
- [x] `ConversationEngine` applies NEW→GREETED transition on `nextAction=continue`
- [x] `ConversationEngine` applies HANDED_OFF transition on `nextAction=handoff`
- [x] `ConversationEngine` sends WhatsApp message with LLM reply
- [x] `ConversationEngine` continues gracefully when LLM throws (no crash)
- [x] `ConversationEngine` continues gracefully when WhatsApp send fails
- [x] `ConversationEngine` upserts QualificationResult on first turn
- [x] `ConversationEngine` extracts and saves lead name from qualification update
- [x] `tsc --noEmit` clean on `packages/core` and `apps/api`

**Verdict: ✅ PASS**

---

## Phase 4 — 2026-06-07

**Phase:** 4 (Scoring, Routing, Follow-up Scheduler)
**Tests run:** 31 new (101 total)
**Tests passed:** 31 new (101 total)
**Tests failed:** 0

**Tests in:**
- `packages/core/src/routing/__tests__/hot-lead-router.test.ts` (6 tests)
- `packages/core/src/followups/__tests__/follow-up.service.test.ts` (10 tests)
- `packages/core/src/scheduling/__tests__/cron-scheduler.test.ts` (7 tests)
- Updated `packages/core/src/conversation/__tests__/scoring.test.ts` (18 tests — formula corrected)

**What was verified:**
- [x] Scoring formula matches ADR-003 exactly (COMPLETENESS + TIMELINE + CLARITY + FINANCING + CONTACT_TIME)
- [x] HOT threshold at 70 correct; NURTURE for 1-69; UNSCORED for 0
- [x] `HotLeadRouter.notifyAgent` creates Notification record with correct agentId/leadId/type
- [x] Notification body includes lead name and score
- [x] WhatsApp sent to agent when agent has a lead record
- [x] Notification still created when WhatsApp send fails (non-fatal)
- [x] Router skips gracefully when lead not found
- [x] `FollowUpService.enrollLead` creates exactly 4 FollowUpJob records
- [x] Jobs scheduled at Day 1, Day 3, Day 7, Day 14 with correct runAt
- [x] Enrollment is idempotent — skips if pending jobs already exist
- [x] `FollowUpService.executeJob` calls LLM and sends WhatsApp
- [x] Job marked 'skipped' when aiPaused=true
- [x] Job marked 'skipped' for terminal states (CLOSED_WON, CLOSED_LOST, HANDED_OFF)
- [x] Job marked 'failed' when LLM throws
- [x] Job marked 'failed' when WhatsApp send fails
- [x] Non-pending jobs skipped without LLM call
- [x] `CronScheduler.runFollowUps` processes all due jobs
- [x] Empty queue produces no DB queries beyond the findMany
- [x] Per-job errors do not stop processing of remaining jobs
- [x] `CronScheduler.sendDailySummary` creates daily_summary notification for each agent
- [x] Summary body includes counts from DB
- [x] `start()`/`stop()` lifecycle works without throwing
- [x] `tsc --noEmit` clean on all workspaces

**Verdict: ✅ PASS**

---

## Phase 5 — 2026-06-07

**Phase:** 5 (Site-visit Scheduling)
**Tests run:** 20 new (121 total)
**Tests passed:** 20 new (121 total)
**Tests failed:** 0

**Tests in:**
- `packages/core/src/visits/__tests__/slot-generator.test.ts` (7 tests)
- `packages/core/src/visits/__tests__/visit.service.test.ts` (13 tests)

**What was verified:**
- [x] `generateAvailableSlots` returns exactly `count` slots (default 3)
- [x] All slots are in the future (not today)
- [x] Slots respect `AgentAvailability.dayOfWeek` filter
- [x] Default weekday slots returned when no availability configured
- [x] Slot label includes day name and AM/PM time
- [x] `VisitService.offerSlots` returns non-empty string with numbered options
- [x] `offerSlots` creates SiteVisit records with status='offered'
- [x] `offerSlots` cancels previously offered visits before creating new ones
- [x] `offerSlots` returns fallback message and skips DB write when lead not found
- [x] `offerSlots` includes lead name in message when known
- [x] `VisitService.confirmVisit` marks offered visit as confirmed
- [x] `confirmVisit` transitions lead state to VISIT_SCHEDULED
- [x] `confirmVisit` creates StateTransition record (VISIT_OFFERED → VISIT_SCHEDULED)
- [x] `confirmVisit` creates site_visit_booked notification for agent
- [x] `confirmVisit` returns confirmation message containing "confirmed"
- [x] `confirmVisit` cancels remaining offered slots
- [x] `confirmVisit` falls back to offerSlots when no offered visit found
- [x] `tsc --noEmit` clean on all workspaces

**Verdict: ✅ PASS**

---

## Phase 6 — 2026-06-07

**Phase:** 6 (Agent Dashboard — Next.js)
**Vitest tests run:** 0 new (121 total — all existing tests still pass)
**Build gate:** `next build` — ✅ PASS

**Build output verified:**
```
Route (app)                         Size    First Load JS
○ /                                 120 B   103 kB
○ /_not-found                       990 B   103 kB
ƒ /leads                            162 B   106 kB
ƒ /leads/[id]                      9.12 kB  115 kB
```

**What was verified:**
- [x] `npm run build --workspace=apps/web` exits 0 (no ESLint/TypeScript errors)
- [x] All 4 routes compile: `/`, `/_not-found`, `/leads`, `/leads/[id]`
- [x] No Prettier formatting errors remaining
- [x] No `@typescript-eslint/no-misused-promises` errors (onClick handlers use `void` wrapper)
- [x] `LeadState` union covers all 11 states matching backend enum
- [x] CVA variants match Tailwind classes without unknown utility errors
- [x] `api.leads.*` and `api.summary.*` match REST endpoint paths in `apps/api/src/routes/`
- [x] Server components (`/leads`, `/leads/[id]`) use `async`/`await` with `api` calls
- [x] Client component `LeadActions` correctly uses `useTransition` + `useRouter().refresh()`
- [x] `tsc --noEmit` clean on `apps/web`

**Verdict: ✅ PASS**

---

## Phase 7 — 2026-06-07

**Phase:** 7 (End-to-end Demo + Runbook)
**Tests run:** 130 total (all 130 passing — 9 additional tests discovered vs. prior count)
**Build gate:** `tsc --noEmit` on `apps/api` — ✅ PASS

**What was verified:**
- [x] `apps/api/src/demo.ts` type-checks cleanly (no implicit any, no missing imports)
- [x] `apps/api/src/tick.ts` type-checks cleanly
- [x] `MockWhatsAppProvider` exported from `@leadpilot/core` (confirmed)
- [x] `CronScheduler.runFollowUps()` is public API (confirmed)
- [x] Root `package.json` has `demo` and `tick` scripts delegating to `apps/api`
- [x] `docs/RUNBOOK.md` sections 8, 9, 10 added (API reference, architecture, troubleshooting)
- [x] Full test suite: 130/130 passing across 12 test files
- [x] `tsc --noEmit` clean across all workspaces

**Verdict: ✅ PASS**

---

## Phase 8 — 2026-06-07

**Phase:** 8 (Hardening Pass)
**Tests run:** 130 total, 130 passing
**ESLint:** 0 errors in source files (was 180 before hardening)

**What was verified:**
- [x] `npx eslint apps/api/src/ packages/core/src/ --ext .ts` — 0 errors
- [x] All Prettier formatting errors resolved
- [x] `@typescript-eslint/no-misused-promises` — fixed in cron scheduler, demo, tick
- [x] `@typescript-eslint/require-await` — fixed in health check, cron, stub providers
- [x] `@typescript-eslint/no-unnecessary-type-assertion` — fixed in engine.ts and follow-up.service.ts
- [x] `@typescript-eslint/consistent-type-imports` — fixed in claude-client.ts
- [x] `@typescript-eslint/no-unused-vars` — removed unused `LLMCallParams` import in engine.test.ts
- [x] ESLint override added for test files (vi.fn() mock patterns are intentionally unsafe-typed)
- [x] `npm test` — 130/130 passing (12 test files)
- [x] `tsc --noEmit` clean on all 4 workspaces
- [x] `next build` — 0 errors (verified in Phase 6)

**Verdict: ✅ PASS — LeadPilot build complete (all 8 phases)**
