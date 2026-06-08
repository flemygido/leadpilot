import type { Lead } from '@leadpilot/db';
import type {
  WhatsAppProvider,
  ParsedInboundMessage,
  SendMessageOptions,
  SendTemplateOptions,
} from './provider.interface.js';
import { assertConsent, isWithin24hWindow } from './consent.js';

/**
 * Twilio WhatsApp provider (stub).
 * TODO: implement when WHATSAPP_PROVIDER=twilio.
 * See docs/RUNBOOK.md "Going live with real WhatsApp" for Twilio setup steps.
 */
export class TwilioProvider implements WhatsAppProvider {
  readonly name = 'twilio';

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string, // e.g. "whatsapp:+14155238886"
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async sendMessage(
    to: string,
    body: string,
    lead: Lead,
    opts: SendMessageOptions = {},
  ): Promise<void> {
    if (opts.isProactive) {
      assertConsent(lead);
    }

    if (opts.isProactive && !isWithin24hWindow(lead)) {
      throw new Error(
        `[TwilioProvider] Cannot send free-form message to ${to}: outside 24h window. Use sendTemplate() with an approved template.`,
      );
    }

    // TODO: implement Twilio Messages API call
    // POST https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json
    // Form data: From=whatsapp:{from}, To=whatsapp:{to}, Body={body}
    throw new Error(
      `[TwilioProvider] sendMessage not yet implemented. from=${this.from}, accountSid=${this.accountSid}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async sendTemplate(to: string, opts: SendTemplateOptions, lead: Lead): Promise<void> {
    assertConsent(lead);

    // TODO: implement Twilio Content Template API
    throw new Error(
      `[TwilioProvider] sendTemplate not yet implemented. template=${opts.templateName}`,
    );
  }

  parseInboundWebhook(payload: unknown): ParsedInboundMessage | null {
    // TODO: parse Twilio webhook payload
    // Twilio sends application/x-www-form-urlencoded with: From, Body, MessageSid
    void payload;
    throw new Error('[TwilioProvider] parseInboundWebhook not yet implemented.');
  }
}
