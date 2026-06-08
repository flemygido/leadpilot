import cron from 'node-cron';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { FollowUpService } from '../followups/follow-up.service.js';
import type { FollowUpServiceOptions } from '../followups/follow-up.service.js';

export interface CronSchedulerOptions extends FollowUpServiceOptions {
  db: PrismaClient;
  logger: Logger;
}

export class CronScheduler {
  private followUpService: FollowUpService;
  private db: PrismaClient;
  private logger: Logger;
  private tasks: cron.ScheduledTask[] = [];

  constructor(opts: CronSchedulerOptions) {
    this.db = opts.db;
    this.logger = opts.logger;
    this.followUpService = new FollowUpService(opts);
  }

  start(): void {
    const log = this.logger.child({ module: 'CronScheduler' });

    // Follow-up poller — every 5 minutes
    const followUpTask = cron.schedule('*/5 * * * *', () => {
      void this.runFollowUps();
    });
    this.tasks.push(followUpTask);

    // Daily summary — 9:00 AM IST (UTC+5:30 = 03:30 UTC)
    const summaryTask = cron.schedule('30 3 * * *', () => {
      void this.sendDailySummary();
    });
    this.tasks.push(summaryTask);

    log.info('CronScheduler started (follow-ups: */5 min, daily summary: 09:00 IST)');
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    this.logger.info({ module: 'CronScheduler' }, 'CronScheduler stopped');
  }

  /** Visible for testing — runs all pending follow-up jobs that are due. */
  async runFollowUps(): Promise<void> {
    const log = this.logger.child({ module: 'CronScheduler.runFollowUps' });

    const dueJobs = await this.db.followUpJob.findMany({
      where: {
        status: 'pending',
        runAt: { lte: new Date() },
      },
      orderBy: { runAt: 'asc' },
      take: 50, // process at most 50 per tick to avoid backlog explosion
    });

    if (dueJobs.length === 0) return;

    log.info({ count: dueJobs.length }, 'Processing due follow-up jobs');

    for (const job of dueJobs) {
      try {
        await this.followUpService.executeJob(job.id);
      } catch (err) {
        log.error({ err, jobId: job.id }, 'Unhandled error executing follow-up job');
      }
    }
  }

  /** Visible for testing — sends daily summary to all agents. */
  async sendDailySummary(): Promise<void> {
    const log = this.logger.child({ module: 'CronScheduler.sendDailySummary' });

    const agents = await this.db.agent.findMany();

    for (const agent of agents) {
      try {
        const [newLeads, hotLeads, scheduledVisits, pendingFollowUps] = await Promise.all([
          this.db.lead.count({
            where: { agentId: agent.id, state: 'NEW', createdAt: { gte: startOfDay() } },
          }),
          this.db.lead.count({ where: { agentId: agent.id, classification: 'HOT' } }),
          this.db.siteVisit.count({
            where: { agentId: agent.id, status: 'confirmed', scheduledAt: { gte: new Date() } },
          }),
          this.db.followUpJob.count({
            where: { lead: { agentId: agent.id }, status: 'pending' },
          }),
        ]);

        const body = [
          `📊 LeadPilot Daily Summary — ${new Date().toLocaleDateString('en-IN')}`,
          `New leads today: ${newLeads}`,
          `Hot leads (total): ${hotLeads}`,
          `Upcoming site visits: ${scheduledVisits}`,
          `Pending follow-ups: ${pendingFollowUps}`,
        ].join('\n');

        await this.db.notification.create({
          data: { agentId: agent.id, type: 'daily_summary', title: 'Daily Summary', body },
        });

        log.info({ agentId: agent.id }, 'Daily summary notification created');
      } catch (err) {
        log.error({ err, agentId: agent.id }, 'Failed to send daily summary');
      }
    }
  }
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
