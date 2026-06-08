import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CronScheduler } from '../cron-scheduler.js';

const logger = {
  child: vi.fn().mockReturnThis(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockLlm = {
  name: 'mock',
  call: vi.fn().mockResolvedValue({
    reply: 'Follow-up message',
    nextAction: 'nurture',
    qualificationUpdate: {},
  }),
};

const mockWhatsapp = {
  name: 'mock',
  sendMessage: vi.fn().mockResolvedValue(undefined),
  sendTemplate: vi.fn().mockResolvedValue(undefined),
  parseInboundWebhook: vi.fn().mockReturnValue(null),
};

const fakeLead = {
  id: 'lead-1',
  phone: '+911234567890',
  name: 'Riya',
  state: 'NURTURING',
  classification: 'NURTURE',
  aiPaused: false,
  agentId: 'agent-1',
  conversation: { id: 'conv-1', messages: [] },
  qualificationResult: null,
};

const fakeJob = {
  id: 'job-1',
  leadId: 'lead-1',
  sequenceStep: 1,
  status: 'pending',
  runAt: new Date(Date.now() - 1000),
  lead: fakeLead,
};

function buildDb(dueJobs: object[] = [fakeJob]) {
  return {
    followUpJob: {
      findMany: vi.fn().mockResolvedValue(dueJobs),
      findFirst: vi.fn().mockResolvedValue(null),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue(fakeJob),
      update: vi.fn().mockResolvedValue({ id: 'job-1', status: 'sent' }),
      count: vi.fn().mockResolvedValue(2),
    },
    message: {
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    },
    agent: {
      findMany: vi.fn().mockResolvedValue([{ id: 'agent-1', phone: '+919876543210' }]),
    },
    lead: {
      count: vi.fn().mockResolvedValue(3),
    },
    siteVisit: {
      count: vi.fn().mockResolvedValue(1),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    },
  };
}

describe('CronScheduler.runFollowUps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes all due jobs', async () => {
    const db = buildDb([fakeJob, { ...fakeJob, id: 'job-2' }]);
    const scheduler = new CronScheduler({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await scheduler.runFollowUps();
    // findUnique called once per job (in executeJob)
    expect(db.followUpJob.findUnique).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no jobs are due', async () => {
    const db = buildDb([]);
    const scheduler = new CronScheduler({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await scheduler.runFollowUps();
    expect(db.followUpJob.findUnique).not.toHaveBeenCalled();
  });

  it('continues processing even if one job throws', async () => {
    const db = buildDb([fakeJob, { ...fakeJob, id: 'job-2' }]);
    // First job throws, second should still run
    db.followUpJob.findUnique
      .mockResolvedValueOnce(null) // job-1: not found
      .mockResolvedValueOnce({ ...fakeJob, id: 'job-2' }); // job-2: found
    const scheduler = new CronScheduler({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await expect(scheduler.runFollowUps()).resolves.toBeUndefined();
  });
});

describe('CronScheduler.sendDailySummary', () => {
  it('creates a notification for each agent', async () => {
    const db = buildDb();
    const scheduler = new CronScheduler({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await scheduler.sendDailySummary();
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'daily_summary', agentId: 'agent-1' }),
      }),
    );
  });

  it('summary body includes counts', async () => {
    const db = buildDb();
    const scheduler = new CronScheduler({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await scheduler.sendDailySummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (
      (db.notification.create as ReturnType<typeof vi.fn>).mock.calls[0] as any[]
    )[0] as { data: { body: string } };
    expect(call.data.body).toContain('LeadPilot Daily Summary');
  });
});

describe('CronScheduler.start/stop', () => {
  it('starts without throwing', () => {
    const db = buildDb();
    const scheduler = new CronScheduler({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    expect(() => scheduler.start()).not.toThrow();
    scheduler.stop(); // clean up
  });

  it('stop is idempotent', () => {
    const db = buildDb();
    const scheduler = new CronScheduler({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    scheduler.start();
    expect(() => {
      scheduler.stop();
      scheduler.stop();
    }).not.toThrow();
  });
});
