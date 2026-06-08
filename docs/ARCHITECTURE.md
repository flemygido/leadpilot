# LeadPilot — Architecture

---

## Component Diagram

```mermaid
graph TB
    subgraph External
        WA[WhatsApp / Lead Portal]
        AgentPhone[Agent's Phone]
    end

    subgraph apps/api ["apps/api (Fastify)"]
        WH[POST /webhooks/whatsapp]
        WHL[POST /webhooks/lead]
        REST[REST API]
        DEV[POST /dev/simulate-inbound]
        CRON[node-cron scheduler]
    end

    subgraph apps/web ["apps/web (Next.js)"]
        DASH[Agent Dashboard]
    end

    subgraph packages/core
        direction TB
        WP[WhatsAppProvider interface]
        MOCK[MockWhatsAppProvider]
        META[MetaCloudProvider stub]
        TWI[TwilioProvider stub]
        CE[ConversationEngine]
        SM[StateMachine]
        LLM[LLM interface]
        CLAUDE[ClaudeClient]
        MOCKLLM[MockLLM]
        QUAL[Qualification + Scoring]
        ROUTE[Routing]
        FU[FollowUpLogic]
        SCHED[Scheduling]
    end

    subgraph packages/db
        PRISMA[Prisma ORM]
        PG[(PostgreSQL)]
    end

    WA -->|inbound webhook| WH
    WH --> CE
    WHL --> CE
    DEV --> CE
    CE --> SM
    CE --> LLM
    CE --> QUAL
    CE --> ROUTE
    ROUTE --> FU
    FU --> SCHED
    CE --> WP
    WP --> MOCK
    WP --> META
    WP --> TWI
    MOCK -->|console + DB| PRISMA
    META -->|real API call| AgentPhone
    LLM --> CLAUDE
    LLM --> MOCKLLM
    CE --> PRISMA
    CRON --> FU
    REST --> PRISMA
    DASH --> REST
    PRISMA --> PG
```

---

## Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `apps/api` | Fastify server: webhook handlers, REST CRUD, cron bootstrap, demo/tick scripts |
| `apps/web` | Next.js agent dashboard: lead list, conversation timeline, site-visit schedule |
| `packages/db` | Prisma schema, client singleton, migrations, seed data |
| `packages/core/whatsapp` | `WhatsAppProvider` interface + `MockWhatsAppProvider` + typed stubs |
| `packages/core/llm` | `LLMClient` interface + `ClaudeClient` + `MockLLM` |
| `packages/core/conversation` | State machine + conversation engine (pure, side-effects injected) |
| `packages/core/qualification` | Zod schema, LLM prompt for extraction, deterministic scoring |
| `packages/core/routing` | HOT/NURTURE classification, agent notification dispatch |
| `packages/core/followups` | Nurture sequence logic, follow-up message generation |
| `packages/core/scheduling` | Site-visit slot availability, booking, confirmation |

---

## Conversation State Machine

```mermaid
stateDiagram-v2
    [*] --> NEW
    NEW --> GREETED : system sends greeting
    GREETED --> QUALIFYING : lead responds
    QUALIFYING --> QUALIFIED_HOT : score >= 70
    QUALIFYING --> QUALIFIED_COLD : score < 70
    QUALIFIED_HOT --> VISIT_OFFERED : agent notified, offer sent
    QUALIFIED_COLD --> NURTURING : enrolled in follow-up sequence
    NURTURING --> QUALIFYING : lead replies to follow-up
    VISIT_OFFERED --> VISIT_SCHEDULED : lead accepts slot
    VISIT_OFFERED --> NURTURING : lead declines / not ready
    VISIT_SCHEDULED --> CLOSED_WON : visit happened
    VISIT_SCHEDULED --> CLOSED_LOST : visit cancelled / ghosted

    NEW --> HANDED_OFF : lead requests human / system confusion
    GREETED --> HANDED_OFF
    QUALIFYING --> HANDED_OFF
    QUALIFIED_HOT --> HANDED_OFF
    QUALIFIED_COLD --> HANDED_OFF
    NURTURING --> HANDED_OFF
    VISIT_OFFERED --> HANDED_OFF
    VISIT_SCHEDULED --> HANDED_OFF

    HANDED_OFF --> QUALIFYING : agent resolves + resumes AI
```

---

## WhatsApp 24-Hour Window

WhatsApp Business policy (and the India DPDP Act) require that business-initiated messages outside the 24-hour customer-care window use approved Message Templates — not free-form text.

LeadPilot tracks `last_inbound_at` on the `Lead` record. The active `WhatsAppProvider` checks this timestamp before sending any proactive message:

- **Inside 24h**: free-form message sent normally.
- **Outside 24h (Mock provider)**: logs a `WARN` to console — `[WhatsApp] Sending outside 24h window — real provider would require a template here`. The message is still delivered in mock mode so the demo flow works.
- **Outside 24h (Meta/Twilio providers)**: must use `sendTemplate()` with an approved template. The stubs enforce this at the type level.

This design means the 24h constraint is visible in dev without preventing local testing.

---

## Data Flow — Inbound Lead

```mermaid
sequenceDiagram
    participant Lead
    participant Webhook as /webhooks/whatsapp
    participant CE as ConversationEngine
    participant LLM
    participant DB as Prisma/PostgreSQL
    participant WP as WhatsAppProvider

    Lead->>Webhook: POST (provider payload)
    Webhook->>DB: upsert Lead, create Message(inbound)
    Webhook->>CE: processInbound(leadId, text)
    CE->>DB: load Lead + Conversation history
    CE->>LLM: chat(systemPrompt, history, userMessage)
    LLM-->>CE: {reply, qualification, next_action}
    CE->>DB: save Message(assistant), update QualificationResult
    CE->>CE: apply state transition
    CE->>DB: update Lead.state, log StateTransition
    CE->>WP: sendMessage(lead.phone, reply)
    WP-->>Lead: WhatsApp message
```

---

## Assumptions

See `docs/DECISIONS.md` for full ADRs.
