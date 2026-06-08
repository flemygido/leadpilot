import type { PrismaClient } from '@leadpilot/db';
import type { Logger } from 'pino';
import type { WhatsAppProvider } from './provider.interface.js';
import { MockWhatsAppProvider } from './mock-provider.js';
import { MetaCloudProvider } from './meta-provider.js';
import { TwilioProvider } from './twilio-provider.js';

export type ProviderName = 'mock' | 'meta' | 'twilio';

export function createWhatsAppProvider(
  providerName: ProviderName,
  db: PrismaClient,
  logger: Logger,
): WhatsAppProvider {
  switch (providerName) {
    case 'mock':
      return new MockWhatsAppProvider(db, logger);

    case 'meta': {
      const phoneNumberId = process.env['META_PHONE_NUMBER_ID'];
      const token = process.env['META_WHATSAPP_TOKEN'];
      if (!phoneNumberId || !token) {
        throw new Error(
          'WHATSAPP_PROVIDER=meta requires META_PHONE_NUMBER_ID and META_WHATSAPP_TOKEN in .env',
        );
      }
      return new MetaCloudProvider(phoneNumberId, token);
    }

    case 'twilio': {
      const accountSid = process.env['TWILIO_ACCOUNT_SID'];
      const authToken = process.env['TWILIO_AUTH_TOKEN'];
      const from = process.env['TWILIO_WHATSAPP_FROM'];
      if (!accountSid || !authToken || !from) {
        throw new Error(
          'WHATSAPP_PROVIDER=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env',
        );
      }
      return new TwilioProvider(accountSid, authToken, from);
    }

    default:
      throw new Error(
        `Unknown WHATSAPP_PROVIDER: "${String(providerName)}". Use: mock | meta | twilio`,
      );
  }
}
