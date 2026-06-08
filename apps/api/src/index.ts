import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from '@leadpilot/db';
import {
  createWhatsAppProvider,
  ConversationEngine,
  ClaudeClient,
  MockLLM,
  HotLeadRouter,
  FollowUpService,
  CronScheduler,
  VisitService,
} from '@leadpilot/core';
import type { ProviderName } from '@leadpilot/core';
import { logger } from './logger.js';
import { webhookRoutes } from './routes/webhooks.js';
import { leadsRoutes } from './routes/leads.js';
import { propertiesRoutes } from './routes/properties.js';
import { agentsRoutes } from './routes/agents.js';

async function bootstrap() {
  const fastify = Fastify({ logger: false }); // use pino directly

  await fastify.register(cors, { origin: true });

  // Auth: validate shared secret + extract agentId from every non-webhook request
  const internalSecret = process.env['INTERNAL_API_SECRET'];
  if (internalSecret) {
    fastify.addHook('preHandler', async (req, reply) => {
      if (req.url.startsWith('/webhooks') || req.url === '/health') return;
      const secret = req.headers['x-api-secret'];
      if (secret !== internalSecret) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    });
  }

  // Resolve provider
  const providerName = (process.env['WHATSAPP_PROVIDER'] ?? 'mock') as ProviderName;
  const provider = createWhatsAppProvider(providerName, prisma, logger);
  logger.info({ provider: provider.name }, 'WhatsApp provider initialised');

  // Resolve LLM — use Claude if key present, MockLLM otherwise
  const llm = process.env['ANTHROPIC_API_KEY'] ? new ClaudeClient() : new MockLLM();
  logger.info({ llm: llm.name }, 'LLM initialised');

  // Resolve default agent (first in DB)
  const agent = await prisma.agent.findFirst();
  if (!agent) {
    logger.warn('No agent found in DB — run npm run db:seed first');
  }
  const defaultAgentId = agent?.id ?? 'seed-not-run';

  // Build routing + follow-up + visit services
  const hotLeadRouter = new HotLeadRouter({ db: prisma, whatsapp: provider, logger });
  const followUpService = new FollowUpService({ db: prisma, llm, whatsapp: provider, logger });
  const visitService = new VisitService({ db: prisma, whatsapp: provider, logger });

  // Wire ConversationEngine
  const engine = new ConversationEngine({
    db: prisma,
    llm,
    whatsapp: provider,
    logger,
    hotLeadRouter,
    followUpService,
    visitService,
  });
  const onInbound = async (leadId: string, text: string) => {
    await engine.process(leadId, text);
  };

  // Start cron scheduler
  const scheduler = new CronScheduler({ db: prisma, llm, whatsapp: provider, logger });
  scheduler.start();

  // Register routes
  await fastify.register(webhookRoutes, { provider, defaultAgentId, onInbound });
  await fastify.register(leadsRoutes);
  await fastify.register(propertiesRoutes);
  await fastify.register(agentsRoutes);

  // Health check
  fastify.get('/health', () => ({ status: 'ok', provider: provider.name }));

  // Start
  const port = Number(process.env['PORT'] ?? process.env['API_PORT'] ?? 3001);
  const host = process.env['API_HOST'] ?? '0.0.0.0';
  await fastify.listen({ port, host });
  logger.info({ port, host }, '🚀 LeadPilot API running');
}

bootstrap().catch((err) => {
  logger.error(err, 'Fatal error during startup');
  process.exit(1);
});
