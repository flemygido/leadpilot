# LeadPilot — Product Requirements

> Source of truth. Copied verbatim from the build brief Section 5.

---

## 5.1 Actors

- **Lead** — a prospective buyer/renter messaging on WhatsApp.
- **Agent** — the real-estate agent who owns leads and gets notified.
- **System (LeadPilot)** — the autonomous assistant.

---

## 5.2 Core user journey

1. A lead enters the system via one of: (a) inbound WhatsApp message, (b) a portal/website webhook (`POST /webhooks/lead`), or (c) manual creation in the dashboard.
2. Within 60 seconds the system sends a warm, human-sounding WhatsApp greeting (through the active provider).
3. The **conversation engine** qualifies the lead through natural back-and-forth, extracting structured fields (Section 5.4).
4. After enough signal, the lead is **scored** and classified **HOT** or **COLD/NURTURE**.
5. **HOT** → the assigned agent is notified immediately (notification = a record + a message via provider to the agent's number) and the lead is offered a site visit.
6. **COLD/NURTURE** → the lead is enrolled in a follow-up sequence (Day 1, Day 3, Day 7, Day 14). Each follow-up is context-aware, not a canned blast.
7. The lead can request a **site visit**; the engine offers slots and books one (`SiteVisit` record + confirmation message).
8. At any point, if the lead asks for a human, says something out of scope, or gets frustrated, the engine **hands off**: pauses automation, flags the lead, and notifies the agent.
9. The agent sees everything in the dashboard and can **take over** a conversation manually (which pauses the AI for that lead).
10. The agent receives a **daily summary** (new leads, hot leads, scheduled visits, pending follow-ups).

---

## 5.3 Conversation state machine (implement exactly)

```
NEW → GREETED → QUALIFYING → (QUALIFIED_HOT | QUALIFIED_COLD) → NURTURING → VISIT_OFFERED → VISIT_SCHEDULED → HANDED_OFF → CLOSED_WON | CLOSED_LOST
```

- `HANDED_OFF` is reachable from any state.
- State transitions must be logged on the `Lead` and visible in the dashboard timeline.

---

## 5.4 Qualification schema (LLM must return exactly this, validated by Zod)

```ts
{
  intent: "buy" | "rent" | "unknown",
  property_type: "apartment" | "villa" | "plot" | "commercial" | "unknown",
  bhk: number | null,                 // e.g. 2, 3; null if N/A
  budget_min: number | null,          // INR
  budget_max: number | null,          // INR
  preferred_locations: string[],      // free text localities
  timeline: "immediate" | "1_3_months" | "3_6_months" | "exploring" | "unknown",
  financing: "loan" | "cash" | "unknown",
  name: string | null,
  preferred_contact_time: string | null,
  notes: string | null                // anything else useful to the agent
}
```

---

## 5.5 Lead scoring (deterministic, in `core/qualification`)

Compute a 0–100 score from: completeness of the schema, timeline urgency (immediate/1–3mo score highest), budget presence, and intent clarity. Define thresholds in one config object: `>= 70 → HOT`, else `NURTURE`. Document the formula in `docs/DECISIONS.md`.

---

## 5.6 Guardrails (enforce in the engine + system prompt)

- Never state a price/availability not present in the DB.
- Never promise anything financial or legal.
- Respect a `consent` flag on the lead — do not send proactive nurture messages if `consent = false`. (Compliance: WhatsApp Business policy + India DPDP Act require opt-in for business-initiated messages. Track `consent`, `consent_source`, `consent_at`.)
- Honour the WhatsApp 24-hour customer-care window concept: model a `last_inbound_at`; outside 24h, real providers require an approved template. The Mock provider logs a warning when a free-form message is sent outside the window so this is visible in dev. Document this in ARCHITECTURE.md.

---

## 5.7 Out of scope for v1

Multi-tenant billing, payment collection, real portal integrations beyond a generic webhook, multi-language (build English + a clean hook for adding languages later).
