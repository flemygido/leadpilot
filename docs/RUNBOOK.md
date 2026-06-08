# LeadPilot — Runbook

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org or `nvm install 20` |
| npm | 10+ | included with Node 20 |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop |

---

## 1. First-time setup

```bash
# 1. Clone the repo (or unzip)
cd leadpilot

# 2. Copy env file and fill in values
cp .env.example .env
# Minimum required: DATABASE_URL is pre-filled for local docker Postgres
# Everything else has safe defaults (mock provider, mock LLM)

# 3. Install all workspace dependencies
npm install

# 4. Start Postgres
docker compose up -d

# 5. Run DB migrations and seed
npm run db:migrate
npm run db:seed
```

---

## 2. Start development servers

```bash
# Start API (port 3001) + Web (port 3000) concurrently
npm run dev

# Or individually:
npm run dev:api    # Fastify API on :3001
npm run dev:web    # Next.js dashboard on :3000
```

Open the dashboard: http://localhost:3000

---

## 3. Run the demo

The demo seeds the DB and runs a full scripted simulation — no WhatsApp credentials needed.

```bash
npm run demo
```

You will see a transcript in the terminal showing the complete lead-to-site-visit flow.

---

## 4. Run due follow-up jobs immediately (for testing)

```bash
npm run tick
```

This fires all due `FollowUpJob`s immediately without waiting for the cron interval.

---

## 5. Simulate an inbound WhatsApp message (local dev)

```bash
curl -X POST http://localhost:3001/dev/simulate-inbound \
  -H "Content-Type: application/json" \
  -d '{"from": "+919876543210", "body": "Hi, I am looking for a 3BHK flat"}'
```

---

## 6. Run tests

```bash
npm test               # all tests, one run
npm run test:watch     # watch mode
npm run test:coverage  # coverage report
```

---

## 7. Environment Variables Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | `postgresql://leadpilot:leadpilot_dev@localhost:5432/leadpilot` | Yes | Postgres connection string |
| `ANTHROPIC_API_KEY` | (none) | No | If absent, MockLLM is used automatically |
| `WHATSAPP_PROVIDER` | `mock` | No | `mock` \| `meta` \| `twilio` |
| `META_PHONE_NUMBER_ID` | (none) | Only if `meta` | WhatsApp Business phone number ID |
| `META_WHATSAPP_TOKEN` | (none) | Only if `meta` | Permanent Meta API token |
| `META_VERIFY_TOKEN` | `leadpilot_webhook_verify` | Only if `meta` | Webhook verification token |
| `TWILIO_ACCOUNT_SID` | (none) | Only if `twilio` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | (none) | Only if `twilio` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | (none) | Only if `twilio` | Twilio WhatsApp sender number |
| `API_PORT` | `3001` | No | Fastify listen port |
| `FOLLOWUP_CRON` | `*/5 * * * *` | No | Cron expression for follow-up job runner |
| `AGENT_WHATSAPP_NUMBER` | `+910000000000` | No | Agent's number for HOT-lead notifications |
| `LOG_LEVEL` | `info` | No | pino log level |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | No | API base URL for Next.js |

---

## Manual Setup Required (yours to do)

### Going live with real WhatsApp (Meta Cloud API)

These steps require a real business and are entirely manual — LeadPilot cannot do them for you.

1. **Create a Meta Business Account** at https://business.facebook.com
2. **Create a Meta Developer App** at https://developers.facebook.com → "Create App" → "Business"
3. **Add WhatsApp product** to the app and go through the setup wizard
4. **Get a WhatsApp Business Number** — you can use the test number Meta provides during setup, or add your real business number
5. **Get the Phone Number ID** from the WhatsApp → Getting Started page
6. **Generate a permanent token**: Business Settings → System Users → Create system user → Grant WhatsApp permissions → Generate token. Store it safely.
7. **Set the webhook**: In your developer app → WhatsApp → Configuration:
   - Webhook URL: `https://YOUR_DOMAIN/webhooks/whatsapp`
   - Verify token: use the value of `META_VERIFY_TOKEN` in your `.env`
   - Subscribe to: `messages`
8. **Set env vars in your production `.env`**:
   ```
   WHATSAPP_PROVIDER=meta
   META_PHONE_NUMBER_ID=<your phone number id>
   META_WHATSAPP_TOKEN=<your permanent token>
   META_VERIFY_TOKEN=<your chosen verify token>
   ```
9. Restart the API. Inbound messages will now flow through the real WhatsApp API.

### Using Twilio instead

1. Create a Twilio account at https://www.twilio.com
2. Get a Twilio phone number with WhatsApp capability (requires Meta approval — Twilio walks you through it)
3. Set env vars:
   ```
   WHATSAPP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=<your account SID>
   TWILIO_AUTH_TOKEN=<your auth token>
   TWILIO_WHATSAPP_FROM=whatsapp:+1XXXXXXXXXX
   ```
4. Configure the Twilio webhook to point to `https://YOUR_DOMAIN/webhooks/whatsapp`

### Using real Claude (not MockLLM)

Add to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

The app will automatically switch from MockLLM to ClaudeClient on next restart.

---

## Prisma Studio (DB browser)

```bash
npm run db:studio
# Opens at http://localhost:5555
```

---

## 8. API Endpoint Reference

All endpoints are served by the Fastify API on port `3001`.

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhooks/whatsapp` | Receive inbound WhatsApp message (Meta / Twilio payload) |
| `GET` | `/webhooks/whatsapp` | Meta webhook verification challenge |
| `POST` | `/webhooks/lead` | Create a new lead manually (body: `{ phone, agentId?, source? }`) |
| `POST` | `/dev/simulate-inbound` | Dev-only: simulate inbound message (body: `{ from, body }`) |

### Leads

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/leads` | List all leads (ordered by newest first) |
| `GET` | `/api/leads/:id` | Full lead detail including conversation, visits, jobs |
| `POST` | `/api/leads/:id/takeover` | Pause AI for this lead (`aiPaused = true`) |
| `POST` | `/api/leads/:id/resume-ai` | Resume AI for this lead (`aiPaused = false`) |
| `GET` | `/api/leads/:id/visit-slots` | Get 3 available visit slots for this lead's agent |
| `POST` | `/api/leads/:id/book-visit` | Manually book a visit (body: `{ scheduledAt, notes? }`) |

### Summary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/summary/daily` | Today's stats: newLeads, hotLeads, upcomingVisits, pendingFollowUps |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{ status: "ok", provider: "mock" }` |

---

## 9. Architecture Overview

```
WhatsApp (inbound)
      │
      ▼
POST /webhooks/whatsapp
      │
      ▼
ConversationEngine.process(leadId, text)
  ├── Load lead + conversation history
  ├── Assert not aiPaused
  ├── Persist inbound Message
  ├── Grant consent (DPDP Act)
  ├── Call LLM (ClaudeClient | MockLLM)
  │     └── report_outcome tool → QualificationUpdate + nextAction + reply
  ├── Upsert QualificationResult
  ├── computeLeadScore() + classifyLead()
  ├── assertTransition() → update lead.state
  ├── if newly HOT → HotLeadRouter.notifyAgent()
  ├── if NURTURE → FollowUpService.enrollLead()
  ├── if offer_visit → VisitService.offerSlots() or confirmVisit()
  └── Send WhatsApp reply

CronScheduler (runs every 5 min)
  └── FollowUpService.executeJob() for each due FollowUpJob
```

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Error: No agent found` | DB not seeded | `npm run db:seed` |
| `ECONNREFUSED 5432` | Postgres not running | `docker compose up -d` |
| API 500 on `/webhooks/whatsapp` | Missing `from` or `body` in payload | Check your WhatsApp provider webhook format |
| Dashboard shows no leads | API URL mismatch | Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `apps/web/.env.local` |
| MockLLM used despite key set | `ANTHROPIC_API_KEY` not in `.env` | Ensure `.env` has the key and restart `npm run dev:api` |
| Follow-up jobs stuck at `pending` | Cron not running | The API auto-starts the cron; if using tick script: `npm run tick` |
