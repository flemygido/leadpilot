# LeadPilot — Architecture Decision Records (ADRs)

Format: **Context → Decision → Consequence**

---

## ADR-001: Adapter pattern for WhatsApp providers

**Context:** We need to support Meta Cloud API, Twilio, and a local mock without spreading provider logic through the codebase.

**Decision:** Define a `WhatsAppProvider` interface in `packages/core/whatsapp/provider.interface.ts`. All outbound/inbound messaging goes through this interface. Provider is selected at startup from `WHATSAPP_PROVIDER` env var.

**Consequence:** Swapping providers (or adding a new one) requires only a new class implementing the interface. No other code changes. Tradeoff: slight verbosity — acceptable for production-grade code.

---

## ADR-002: MockLLM for zero-credential development

**Context:** The Anthropic Claude API requires a paid API key. We cannot require it for local dev or CI.

**Decision:** When `ANTHROPIC_API_KEY` is absent, the app automatically uses `MockLLM` — a deterministic, rule-based responder in `packages/core/llm/mock-llm.ts`. Both `ClaudeClient` and `MockLLM` implement the same `LLMClient` interface.

**Consequence:** All tests are deterministic. The whole app runs without credentials. Tradeoff: MockLLM uses simple pattern-matching, not real intelligence — the demo shows the plumbing, not production-quality conversation.

---

## ADR-003: Lead scoring formula

**Context:** We need a deterministic 0–100 score to classify HOT vs NURTURE, defined in one place.

**Decision:** Scoring is computed by `computeLeadScore()` in `packages/core/qualification/scoring.ts` using the following weights:

```
COMPLETENESS  (max 30 pts):
  - name present:                     5 pts
  - intent != "unknown":              5 pts
  - property_type != "unknown":       5 pts
  - bhk present (not null):           3 pts
  - budget_min or budget_max present: 7 pts
  - preferred_locations non-empty:    5 pts

TIMELINE_URGENCY (max 30 pts):
  - "immediate":    30 pts
  - "1_3_months":   20 pts
  - "3_6_months":   10 pts
  - "exploring":     5 pts
  - "unknown":       0 pts

INTENT_CLARITY (max 20 pts):
  - "buy" or "rent":  20 pts
  - "unknown":         0 pts

FINANCING (max 10 pts):
  - "loan" or "cash":  10 pts
  - "unknown":          0 pts

CONTACT_TIME (max 10 pts):
  - preferred_contact_time present:  10 pts
  - absent:                           0 pts

THRESHOLD: score >= 70 → HOT; else → NURTURE
```

**Consequence:** Fully testable without LLM. Formula is explicit and auditable. Can be tuned by changing the config object without touching engine logic.

---

## ADR-004: No external queue for MVP scheduler

**Context:** Follow-up jobs need to be scheduled and executed reliably. Redis/BullMQ would be ideal at scale.

**Decision:** For MVP, use a `follow_up_jobs` Postgres table + `node-cron` polling every 5 minutes. The scheduler logic is behind a `SchedulerService` interface so BullMQ can replace the cron implementation later.

**Consequence:** No extra infrastructure (no Redis). Works with just Postgres. Tradeoff: not suitable for high-volume (100k+ leads); acceptable for the MVP's single-agent target.

---

## ADR-005: Monorepo structure with npm workspaces

**Context:** We have shared domain logic, a DB package, an API server, and a Next.js frontend. They share types and can evolve independently.

**Decision:** npm workspaces with `packages/core`, `packages/db`, `apps/api`, `apps/web`. No build step required between packages in dev — `tsx` resolves TypeScript source directly.

**Consequence:** Fast DX — no pre-build. In production, each app must build its own bundle including workspace dependencies.

---

## ADR-006: Consent and DPDP Act compliance

**Context:** The India Digital Personal Data Protection Act 2023 and WhatsApp Business Policy require opt-in consent before sending business-initiated messages.

**Decision:** `Lead` has `consent: Boolean` (default false), `consent_source: String?` (e.g. "whatsapp_opt_in", "portal_form"), `consent_at: DateTime?`. The `WhatsAppProvider.sendMessage()` wrapper checks consent before sending any proactive (non-reply) message. Consent is implicitly given when a lead messages in first (inbound message = customer-initiated = always allowed).

**Consequence:** Compliant by default. Nurture sequences cannot fire without consent. Tradeoff: slightly more complex lead creation flow (must set consent).

---

## ADR-007: Single agent, no multi-tenancy in v1

**Context:** The build brief explicitly lists multi-tenant billing as out of scope.

**Decision:** The DB has an `Agent` table but no tenant isolation logic. All leads are owned by a single agent. A `TODO: multi-tenancy` comment is left at every relevant boundary.

**Consequence:** Simple, fast to build. Upgrading to multi-tenant will require adding `tenantId` foreign keys and RLS policies in Postgres.

---

## ADR-008: Pino for structured logging

**Context:** Need structured, levelled logging that is fast and works in both dev (pretty) and prod (JSON).

**Decision:** Use `pino` throughout. `apps/api` bootstraps a root logger passed into services. `pino-pretty` is used in dev via the `LOG_LEVEL` env. No `console.log` in production code paths (only in `MockWhatsAppProvider` intentionally).

**Consequence:** Consistent, queryable logs. Easy to ship to Datadog/CloudWatch by changing the transport.

---

## ADR-009: Zod for all external input validation

**Context:** All LLM output and all inbound webhooks are untrusted external input.

**Decision:** Every external input is validated through a Zod schema before use. LLM structured output is parsed with `z.safeParse()`; failures trigger a retry or fallback.

**Consequence:** Runtime type safety at every boundary. Tradeoff: extra boilerplate for schemas — judged worth it for correctness.

---

## ADR-010: State machine as explicit enum + transition table

**Context:** The conversation flow must be predictable, auditable, and testable.

**Decision:** `LeadState` is a Prisma enum. Valid transitions are defined in a `TRANSITIONS` lookup table in `packages/core/conversation/state-machine.ts`. Any attempt to apply an invalid transition throws a typed error.

**Consequence:** Invalid state transitions are caught at runtime and in tests. Adding a new state requires updating the enum, the transition table, and the tests — all in one file.
