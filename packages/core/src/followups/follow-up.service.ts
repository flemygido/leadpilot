import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { LLMClient } from '../llm/llm.interface.js';
import type { WhatsAppProvider } from '../whatsapp/provider.interface.js';

// Follow-up sequence: [days from enrollment, sequence_step]
const FOLLOW_UP_SCHEDULE: Array<{ step: number; daysFromNow: number }> = [
  { step: 1, daysFromNow: 1 },
  { step: 2, daysFromNow: 3 },
  { step: 3, daysFromNow: 7 },
  { step: 4, daysFromNow: 14 },
];

export interface FollowUpServiceOptions {
  db: PrismaClient;
  llm: LLMClient;
  whatsapp: WhatsAppProvider;
  logger: Logger;
}

export class FollowUpService {
  private db: PrismaClient;
  private llm: LLMClient;
  private whatsapp: WhatsAppProvider;
  private logger: Logger;

  constructor({ db, llm, whatsapp, logger }: FollowUpServiceOptions) {
    this.db = db;
    this.llm = llm;
    this.whatsapp = whatsapp;
    this.logger = logger;
  }

  /** Enroll a lead in the 4-step nurture sequence. Idempotent — skips if already enrolled. */
  async enrollLead(leadId: string): Promise<void> {
    const log = this.logger.child({ leadId, module: 'FollowUpService' });

    const existing = await this.db.followUpJob.findFirst({
      where: { leadId, status: 'pending' },
    });
    if (existing) {
      log.info('Lead already enrolled in follow-up sequence — skipping');
      return;
    }

    const now = new Date();
    const jobs = FOLLOW_UP_SCHEDULE.map(({ step, daysFromNow }) => ({
      leadId,
      sequenceStep: step,
      runAt: new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
    }));

    await this.db.followUpJob.createMany({ data: jobs });
    log.info({ steps: jobs.length }, 'Lead enrolled in follow-up sequence');
  }

  /** Execute a single pending follow-up job. Called by the cron scheduler. */
  async executeJob(jobId: string): Promise<void> {
    const log = this.logger.child({ jobId, module: 'FollowUpService' });

    const job = await this.db.followUpJob.findUnique({
      where: { id: jobId },
      include: {
        lead: {
          include: {
            conversation: { include: { messages: { orderBy: { createdAt: 'asc' }, take: 10 } } },
            qualificationResult: true,
          },
        },
      },
    });

    if (!job) {
      log.warn('Job not found');
      return;
    }
    if (job.status !== 'pending') {
      log.info({ status: job.status }, 'Job already processed');
      return;
    }

    const lead = job.lead;

    // Skip if AI is paused or lead is terminal
    if (lead.aiPaused) {
      await this.db.followUpJob.update({ where: { id: jobId }, data: { status: 'skipped' } });
      log.info('aiPaused — skipping follow-up');
      return;
    }
    if (
      lead.state === 'CLOSED_WON' ||
      lead.state === 'CLOSED_LOST' ||
      lead.state === 'HANDED_OFF'
    ) {
      await this.db.followUpJob.update({ where: { id: jobId }, data: { status: 'skipped' } });
      log.info({ state: lead.state }, 'Terminal state — skipping follow-up');
      return;
    }

    const history = (lead.conversation?.messages ?? []).map(
      (m: { role: string; body: string }) => ({
        role: m.role === 'lead' ? ('lead' as const) : ('assistant' as const),
        body: m.body,
      }),
    );

    const followUpPrompt =
      `[FOLLOW-UP STEP ${job.sequenceStep}/4] This is an automated nurture follow-up. ` +
      `Re-engage ${lead.name ?? 'this lead'} warmly. Reference what you know about their property search. ` +
      `Ask one gentle question to understand if anything has changed.`;

    try {
      const llmResponse = await this.llm.call({
        leadContext: { id: lead.id, name: lead.name, state: lead.state, phone: lead.phone },
        history,
        incomingMessage: followUpPrompt,
      });

      // Persist the outbound follow-up message
      if (lead.conversation) {
        await this.db.message.create({
          data: {
            conversationId: lead.conversation.id,
            role: 'assistant',
            direction: 'outbound',
            body: llmResponse.reply,
          },
        });
      }

      // Send via WhatsApp (proactive — uses template if outside 24h window)
      try {
        await this.whatsapp.sendMessage(lead.phone, llmResponse.reply, lead, { isProactive: true });
      } catch (sendErr) {
        log.warn({ sendErr }, 'WhatsApp send failed for follow-up');
        await this.db.followUpJob.update({
          where: { id: jobId },
          data: { status: 'failed', failureReason: String(sendErr) },
        });
        return;
      }

      await this.db.followUpJob.update({
        where: { id: jobId },
        data: { status: 'sent', sentAt: new Date() },
      });

      log.info({ step: job.sequenceStep }, 'Follow-up sent');
    } catch (err) {
      log.error({ err }, 'Follow-up LLM call failed');
      await this.db.followUpJob.update({
        where: { id: jobId },
        data: { status: 'failed', failureReason: String(err) },
      });
    }
  }
}
