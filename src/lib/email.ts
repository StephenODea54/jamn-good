// Sends email through Cloudflare Email Sending (the EMAIL binding in wrangler.jsonc).
// jamn-good.com is set up for sending, so any @jamn-good.com address can be the sender.
import { env } from 'cloudflare:workers';

export const SITE_URL = 'https://jamn-good.com';
export const FROM_ORDERS = { name: 'Jamn Good Orders', email: 'orders@jamn-good.com' };
export const FROM_SITE = { name: 'Jamn Good', email: 'noreply@jamn-good.com' };

type Address = string | { name: string; email: string };

export interface OutgoingEmail {
  from: { name: string; email: string };
  to: Address | Address[];
  replyTo?: Address;
  subject: string;
  text: string;
  html?: string;
}

/** Send one email. Throws if the binding is missing or Cloudflare rejects it. */
export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const binding = (env as unknown as { EMAIL?: SendEmail }).EMAIL;
  if (!binding) throw new Error('The EMAIL send_email binding is missing (see wrangler.jsonc).');
  await binding.send(message as EmailMessageBuilder);
}

/** Escape text for use inside the HTML version of an email. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
