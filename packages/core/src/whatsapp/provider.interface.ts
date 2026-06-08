import type { Lead } from '@leadpilot/db';

export interface SendMessageOptions {
  isProactive?: boolean; // true = business-initiated (outside reply window); false = reply to lead
}

export interface SendTemplateOptions {
  templateName: string;
  languageCode?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- template components are provider-specific
  components?: any[];
}

export interface ParsedInboundMessage {
  from: string; // E.164 phone number
  body: string;
  providerMessageId?: string;
  timestamp: Date;
}

export interface WhatsAppProvider {
  readonly name: string;

  /**
   * Send a free-form text message to the given E.164 phone number.
   * Implementations MUST check the 24-hour window and consent before sending.
   */
  sendMessage(to: string, body: string, lead: Lead, opts?: SendMessageOptions): Promise<void>;

  /**
   * Send an approved WhatsApp template message.
   * Required outside the 24-hour customer-care window on real providers.
   */
  sendTemplate(to: string, opts: SendTemplateOptions, lead: Lead): Promise<void>;

  /**
   * Parse a raw inbound webhook payload into a normalised message.
   * Returns null if the payload is not a recognised message event (e.g. delivery receipts).
   */
  parseInboundWebhook(payload: unknown): ParsedInboundMessage | null;
}
