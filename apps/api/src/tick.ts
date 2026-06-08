/**
 * Manual cron tick — runs all due FollowUpJobs immediately.
 * Useful for testing the follow-up flow without waiting for the 5-minute poller.
 *
 * Usage: npm run tick (from root) or npm run tick --workspace=apps/api
 */
import 'dotenv/config';
import { prisma } from '@leadpilot/db';
import { MockLLM, MockWhatsAppProvider, CronScheduler } from '@leadpilot/core';
import pino from 'pino';

const log = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

async function main() {
  log.info('⏰ Running follow-up tick…');

  const whatsapp = new MockWhatsAppProvider(prisma, log);
  const llm = new MockLLM();
  const scheduler = new CronScheduler({ db: prisma, llm, whatsapp, logger: log });

  await scheduler.runFollowUps();

  log.info('✅ Tick complete');
}

main()
  .catch((err) => {
    log.error(err, 'Tick failed');
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
