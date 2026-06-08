import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { WhatsAppProvider } from '../whatsapp/provider.interface.js';

export interface HotLeadRouterOptions {
  db: PrismaClient;
  whatsapp: WhatsAppProvider;
  logger: Logger;
}

export class HotLeadRouter {
  private db: PrismaClient;
  private whatsapp: WhatsAppProvider;
  private logger: Logger;

  constructor({ db, whatsapp, logger }: HotLeadRouterOptions) {
    this.db = db;
    this.whatsapp = whatsapp;
    this.logger = logger;
  }

  async notifyAgent(leadId: string): Promise<void> {
    const log = this.logger.child({ leadId, module: 'HotLeadRouter' });

    const lead = await this.db.lead.findUnique({
      where: { id: leadId },
      include: { agent: true, qualificationResult: true },
    });
    if (!lead) {
      log.warn('Lead not found for hot notification');
      return;
    }

    const agent = lead.agent;
    const qual = lead.qualificationResult;

    const budgetStr = qual?.budgetMax
      ? `₹${(qual.budgetMax / 100_000).toFixed(0)}L`
      : qual?.budgetMin
        ? `₹${(qual.budgetMin / 100_000).toFixed(0)}L+`
        : 'not specified';

    const body = [
      `🔥 HOT LEAD ALERT`,
      `Name: ${lead.name ?? 'Unknown'}`,
      `Phone: ${lead.phone}`,
      `Intent: ${qual?.intent ?? '?'} | Type: ${qual?.propertyType ?? '?'}${qual?.bhk ? ` ${qual.bhk}BHK` : ''}`,
      `Budget: ${budgetStr}`,
      `Timeline: ${qual?.timeline ?? '?'}`,
      `Locations: ${qual?.preferredLocations?.join(', ') || '?'}`,
      `Score: ${lead.score}/100`,
    ].join('\n');

    // Persist notification record
    await this.db.notification.create({
      data: {
        agentId: lead.agentId,
        leadId: lead.id,
        type: 'hot_lead',
        title: `HOT: ${lead.name ?? lead.phone}`,
        body,
      },
    });

    // Send WhatsApp notification to agent
    // Agents have consent implicitly — they signed up for the platform
    const agentLead = await this.db.lead.findFirst({ where: { phone: agent.phone } });
    if (agentLead) {
      try {
        await this.whatsapp.sendMessage(agent.phone, body, agentLead);
      } catch (err) {
        log.warn({ err }, 'Could not send WhatsApp to agent — notification record still created');
      }
    } else {
      log.info(
        { agentPhone: agent.phone },
        'Agent has no lead record — WhatsApp skipped, notification recorded',
      );
    }

    log.info({ agentId: agent.id, score: lead.score }, 'Hot lead notification sent');
  }
}
