import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FollowUpService } from '../follow-up.service.js';

const logger = {
  child: vi.fn().mockReturnThis(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockLlm = {
  name: 'mock',
  call: vi.fn().mockResolvedValue({
    reply: 'Hi! Just checking in — any update on your property search?',
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

const fakeConversation = {
  id: 'conv-1',
  messages: [{ role: 'lead', body: 'Hi I want to buy' }],
};

const fakeLead = {
  id: 'lead-1',
  phone: '+911234567890',
  name: 'Rahul',
  state: 'NURTURING',
  classification: 'NURTURE',
  aiPaused: false,
  consent: true,
  consentAt: new Date(),
  consentSource: 'inbound_message',
  conversation: fakeConversation,
  qualificationResult: null,
};

function buildDb(
  overrides: Partial<{
    existingJob: object | null;
    job: object | null;
  }> = {},
) {
  const pendingJob = {
    id: 'job-1',
    leadId: 'lead-1',
    sequenceStep: 1,
    status: 'pending',
    runAt: new Date(Date.now() - 1000),
    lead: fakeLead,
  };

  return {
    followUpJob: {
      findFirst: vi.fn().mockResolvedValue(overrides.existingJob ?? null),
      createMany: vi.fn().mockResolvedValue({ count: 4 }),
      findUnique: vi.fn().mockResolvedValue(overrides.job ?? pendingJob),
      update: vi.fn().mockResolvedValue({ id: 'job-1' }),
    },
    message: {
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    },
  };
}

describe('FollowUpService.enrollLead', () => {
  it('creates 4 follow-up jobs', async () => {
    const db = buildDb();
    const svc = new FollowUpService({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await svc.enrollLead('lead-1');
    expect(db.followUpJob.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ sequenceStep: 1 }),
          expect.objectContaining({ sequenceStep: 2 }),
          expect.objectContaining({ sequenceStep: 3 }),
          expect.objectContaining({ sequenceStep: 4 }),
        ]),
      }),
    );
  });

  it('is idempotent — skips if pending jobs already exist', async () => {
    const db = buildDb({ existingJob: { id: 'job-existing' } });
    const svc = new FollowUpService({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await svc.enrollLead('lead-1');
    expect(db.followUpJob.createMany).not.toHaveBeenCalled();
  });

  it('schedules jobs at Day 1, 3, 7, 14', async () => {
    const db = buildDb();
    const svc = new FollowUpService({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    const before = Date.now();
    await svc.enrollLead('lead-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (
      (db.followUpJob.createMany as ReturnType<typeof vi.fn>).mock.calls[0] as any[]
    )[0] as {
      data: Array<{ sequenceStep: number; runAt: Date }>;
    };
    const steps = call.data;
    const dayMs = 24 * 60 * 60 * 1000;
    expect(steps[0]!.runAt.getTime()).toBeGreaterThanOrEqual(before + 1 * dayMs - 100);
    expect(steps[1]!.runAt.getTime()).toBeGreaterThanOrEqual(before + 3 * dayMs - 100);
    expect(steps[2]!.runAt.getTime()).toBeGreaterThanOrEqual(before + 7 * dayMs - 100);
    expect(steps[3]!.runAt.getTime()).toBeGreaterThanOrEqual(before + 14 * dayMs - 100);
  });
});

describe('FollowUpService.executeJob', () => {
  let db: ReturnType<typeof buildDb>;
  let svc: FollowUpService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildDb();
    svc = new FollowUpService({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
  });

  it('calls LLM and sends WhatsApp message', async () => {
    await svc.executeJob('job-1');
    expect(mockLlm.call).toHaveBeenCalled();
    expect(mockWhatsapp.sendMessage).toHaveBeenCalled();
    expect(db.followUpJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }),
    );
  });

  it('skips job when aiPaused=true', async () => {
    db = buildDb({
      job: { id: 'job-1', status: 'pending', lead: { ...fakeLead, aiPaused: true } },
    });
    svc = new FollowUpService({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await svc.executeJob('job-1');
    expect(db.followUpJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }),
    );
    expect(mockLlm.call).not.toHaveBeenCalled();
  });

  it('skips job when lead is in terminal state', async () => {
    db = buildDb({
      job: { id: 'job-1', status: 'pending', lead: { ...fakeLead, state: 'CLOSED_WON' } },
    });
    svc = new FollowUpService({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await svc.executeJob('job-1');
    expect(db.followUpJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }),
    );
  });

  it('marks job as failed if LLM throws', async () => {
    mockLlm.call = vi.fn().mockRejectedValue(new Error('LLM timeout'));
    await svc.executeJob('job-1');
    expect(db.followUpJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('marks job as failed if WhatsApp send fails', async () => {
    mockWhatsapp.sendMessage = vi.fn().mockRejectedValue(new Error('WA error'));
    await svc.executeJob('job-1');
    expect(db.followUpJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('returns early for non-pending jobs', async () => {
    db = buildDb({ job: { id: 'job-1', status: 'sent', lead: fakeLead } });
    svc = new FollowUpService({
      db: db as never,
      llm: mockLlm,
      whatsapp: mockWhatsapp as never,
      logger: logger as never,
    });
    await svc.executeJob('job-1');
    expect(mockLlm.call).not.toHaveBeenCalled();
  });

  it('returns early if job not found', async () => {
    db.followUpJob.findUnique = vi.fn().mockResolvedValue(null);
    await svc.executeJob('missing');
    expect(mockLlm.call).not.toHaveBeenCalled();
  });
});
