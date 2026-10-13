import { env } from 'cloudflare:workers';
import Stripe from 'stripe';

const secrets = env as Record<string, string | undefined>;

/** Stripe client, or undefined when STRIPE_SECRET_KEY isn't set (checkout then shows as unavailable). */
export function getStripe(): Stripe | undefined {
  const key = secrets.STRIPE_SECRET_KEY;
  return key ? new Stripe(key, { httpClient: Stripe.createFetchHttpClient() }) : undefined;
}

/** Signing secret for /api/stripe-webhook (whsec_...), from the Stripe webhook endpoint or `stripe listen`. */
export const getWebhookSecret = () => secrets.STRIPE_WEBHOOK_SECRET || undefined;
