import type { Lead } from '@leadpilot/db';

export class ConsentError extends Error {
  constructor(leadId: string) {
    super(`Cannot send proactive message to lead ${leadId}: consent not given`);
    this.name = 'ConsentError';
  }
}

/**
 * Returns true if the lead's last inbound message was within the 24-hour
 * WhatsApp customer-care window, meaning free-form messages are allowed.
 */
export function isWithin24hWindow(lead: Lead): boolean {
  if (!lead.lastInboundAt) return false;
  const windowMs = 24 * 60 * 60 * 1000;
  return Date.now() - lead.lastInboundAt.getTime() < windowMs;
}

/**
 * Asserts that a proactive (business-initiated) message is permitted.
 * Throws ConsentError if consent is false.
 */
export function assertConsent(lead: Lead): void {
  if (!lead.consent) {
    throw new ConsentError(lead.id);
  }
}
