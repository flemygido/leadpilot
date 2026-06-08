/**
 * End-to-end demo script — runs a full lead lifecycle without real credentials.
 *
 * Usage: npm run demo (from root) or npm run demo --workspace=apps/api
 *
 * Prerequisites: docker compose up -d && npm run db:migrate && npm run db:seed
 */
import 'dotenv/config';
import { prisma } from '@leadpilot/db';
import {
  ConversationEngine,
  MockLLM,
  MockWhatsAppProvider,
  FollowUpService,
  HotLeadRouter,
  VisitService,
  CronScheduler,
} from '@leadpilot/core';
import pino from 'pino';

const log = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

// ─── helpers ──────────────────────────────────────────────────────────────────

function section(title: string) {
  log.info(`\n${'─'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  section('LeadPilot — End-to-End Demo');
  log.info('Using MockLLM + MockWhatsAppProvider (no credentials required)');

  // ── 1. Resolve agent ─────────────────────────────────────────────────────
  const agent = await prisma.agent.findFirst();
  if (!agent) throw new Error('No agent found. Run: npm run db:seed');
  log.info({ agentId: agent.id, agentName: agent.name }, 'Agent loaded');

  // ── 2. Create a fresh lead ───────────────────────────────────────────────
  section('Step 1 — New inbound lead');
  const phone = `+91${Date.now().toString().slice(-10)}`;
  const lead = await prisma.lead.create({
    data: {
      phone,
      agentId: agent.id,
      source: 'demo',
      state: 'NEW',
      classification: 'UNSCORED',
      score: 0,
      consent: false,
    },
  });
  log.info({ leadId: lead.id, phone }, 'Lead created');

  // ── 3. Wire up services ──────────────────────────────────────────────────
  const whatsapp = new MockWhatsAppProvider(prisma, log);
  const llm = new MockLLM();
  const hotLeadRouter = new HotLeadRouter({ db: prisma, whatsapp, logger: log });
  const followUpService = new FollowUpService({ db: prisma, llm, whatsapp, logger: log });
  const visitService = new VisitService({ db: prisma, whatsapp, logger: log });
  const engine = new ConversationEngine({
    db: prisma,
    llm,
    whatsapp,
    logger: log,
    hotLeadRouter,
    followUpService,
    visitService,
  });

  // ── 4. Simulate conversation ─────────────────────────────────────────────
  const turns: string[] = [
    'Hi, I am Priya Sharma',
    'I want to buy a 3BHK flat in Bandra',
    'My budget is around 2 crore',
    'I need it immediately',
    'I have a home loan pre-approved',
    'Prefer morning calls',
    'Yes please show me available times',
  ];

  for (let i = 0; i < turns.length; i++) {
    section(`Turn ${i + 1} — Lead: "${turns[i]}"`);
    await engine.process(lead.id, turns[i]!);
    await sleep(200);

    const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
    log.info(
      { state: updated?.state, classification: updated?.classification, score: updated?.score },
      'Lead state after turn',
    );
  }

  // ── 5. Show final lead state ─────────────────────────────────────────────
  section('Final State');
  const final = await prisma.lead.findUnique({
    where: { id: lead.id },
    include: {
      qualificationResult: true,
      stateTransitions: { orderBy: { createdAt: 'asc' } },
      siteVisits: true,
      followUpJobs: true,
      conversation: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
    },
  });

  if (!final) throw new Error('Lead vanished');

  log.info('── Qualification ──────────────────────────────────────────');
  log.info(final.qualificationResult ?? '(none)');

  log.info('── State Transitions ──────────────────────────────────────');
  for (const t of final.stateTransitions) {
    log.info(`  ${t.fromState} → ${t.toState}  (${t.reason ?? '–'})`);
  }

  log.info('── Site Visits ────────────────────────────────────────────');
  if (final.siteVisits.length === 0) {
    log.info('  (none)');
  }
  for (const v of final.siteVisits) {
    log.info(`  [${v.status}] ${v.scheduledAt.toLocaleString('en-IN')}`);
  }

  log.info('── Follow-up Jobs ─────────────────────────────────────────');
  for (const j of final.followUpJobs) {
    log.info(
      `  Step ${j.sequenceStep} | runAt: ${j.runAt.toISOString().split('T')[0]} | ${j.status}`,
    );
  }

  log.info('── Conversation ───────────────────────────────────────────');
  for (const m of final.conversation?.messages ?? []) {
    const who = m.role === 'lead' ? '👤 Lead' : '🤖 AI';
    log.info(`  ${who}: ${m.body.slice(0, 120)}`);
  }

  // ── 6. Tick the cron to run any pending follow-ups ───────────────────────
  section('Step 2 — Run follow-up jobs (cron tick)');
  const scheduler = new CronScheduler({ db: prisma, llm, whatsapp, logger: log });
  await scheduler.runFollowUps();

  log.info('\n✅ Demo complete. Dashboard: http://localhost:3000/leads');
}

main()
  .catch((err) => {
    log.error(err, 'Demo failed');
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
