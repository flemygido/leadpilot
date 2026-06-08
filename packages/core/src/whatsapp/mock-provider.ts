import type { Lead, PrismaClient } from '@leadpilot/db';
import type { Logger } from 'pino';
import type {
  WhatsAppProvider,
  ParsedInboundMessage,
  SendMessageOptions,
  SendTemplateOptions,
} from './provider.interface.js';
import { assertConsent, isWithin24hWindow } from './consent.js';

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'mock';

  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async sendMessage(
    to: string,
    body: string,
    lead: Lead,
    opts: SendMessageOptions = {},
  ): Promise<void> {
    // Enforce consent for proactive messages (business-initiated)
    if (opts.isProactive) {
      assertConsent(lead);
    }

    // 24-hour window check — in mock mode we warn but still send
    if (opts.isProactive && !isWithin24hWindow(lead)) {
      this.logger.warn(
        { leadId: lead.id, to, lastInboundAt: lead.lastInboundAt },
        '[WhatsApp] Sending outside 24h window — real provider would require a template here',
      );
    }

    // Log to console (intentional — this is the mock's "delivery")
    // Note: outbound message is already persisted by ConversationEngine (step 16)
    this.logger.info({ to, body }, '[MockWhatsApp] → OUTBOUND MESSAGE');
    console.log(`\n📤 [MockWhatsApp] → ${to}\n   "${body}"\n`);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async sendTemplate(to: string, opts: SendTemplateOptions, lead: Lead): Promise<void> {
    assertConsent(lead);
    this.logger.info({ to, template: opts.templateName }, '[MockWhatsApp] → TEMPLATE MESSAGE');
    console.log(`\n📤 [MockWhatsApp Template] → ${to}\n   Template: ${opts.templateName}\n`);
  }

  /**
   * Parses a mock inbound payload from POST /dev/simulate-inbound.
   * Payload shape: { from: string, body: string }
   */
  parseInboundWebhook(payload: unknown): ParsedInboundMessage | null {
    if (!isSimulatePayload(payload)) return null;
    return {
      from: payload.from,
      body: payload.body,
      providerMessageId: `mock_${Date.now()}`,
      timestamp: new Date(),
    };
  }
}

interface SimulatePayload {
  from: string;
  body: string;
}

function isSimulatePayload(p: unknown): p is SimulatePayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    'from' in p &&
    'body' in p &&
    typeof (p as Record<string, unknown>)['from'] === 'string' &&
    typeof (p as Record<string, unknown>)['body'] === 'string'
  );
}
