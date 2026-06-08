import type { Lead } from '@leadpilot/db';
import type {
  WhatsAppProvider,
  ParsedInboundMessage,
  SendMessageOptions,
  SendTemplateOptions,
} from './provider.interface.js';
import { assertConsent, isWithin24hWindow } from './consent.js';

/**
 * Meta Cloud API provider (stub).
 * TODO: implement when WHATSAPP_PROVIDER=meta and META_WHATSAPP_TOKEN is set.
 * See docs/RUNBOOK.md "Going live with real WhatsApp" for setup steps.
 */
export class MetaCloudProvider implements WhatsAppProvider {
  readonly name = 'meta';

  constructor(
    private readonly phoneNumberId: string,
    private readonly token: string,
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
        `[MetaCloudProvider] Cannot send free-form message to ${to}: outside 24h window. Use sendTemplate() with an approved template.`,
      );
    }

    // TODO: implement Meta Cloud API call
    // POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages
    // Authorization: Bearer {token}
    // Body: { messaging_product: "whatsapp", to, type: "text", text: { body } }
    throw new Error(
      `[MetaCloudProvider] sendMessage not yet implemented. phoneNumberId=${this.phoneNumberId}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async sendTemplate(to: string, opts: SendTemplateOptions, lead: Lead): Promise<void> {
    assertConsent(lead);

    // TODO: implement Meta template message
    // POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages
    // Body: { messaging_product: "whatsapp", to, type: "template", template: { name, language, components } }
    throw new Error(
      `[MetaCloudProvider] sendTemplate not yet implemented. template=${opts.templateName}`,
    );
  }

  parseInboundWebhook(payload: unknown): ParsedInboundMessage | null {
    // TODO: parse Meta Cloud API webhook payload
    // Payload structure: { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [...] } }] }] }
    void payload;
    throw new Error('[MetaCloudProvider] parseInboundWebhook not yet implemented.');
  }
}
