import { env } from 'cloudflare:workers';
import Stripe from 'stripe';

const secrets = env as Record<string, string | undefined>;

/** Stripe client, or undefined when STRIPE_SECRET_KEY isn't set (checkout then shows as unavailable). */
export function getStripe(): Stripe | undefined {
  const key = secrets.STRIPE_SECRET_KEY?.trim();
  if (!key) return undefined;
  if (!/^(sk|rk)_(test|live)_/.test(key)) {
    // Most often the publishable key (pk_...) was pasted by mistake.
    console.error('[stripe] STRIPE_SECRET_KEY must be a secret key (sk_live_... or sk_test_...), not a publishable key.');
    return undefined;
  }
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

/** Signing secret for /api/stripe-webhook (whsec_...), from the Stripe webhook endpoint or `stripe listen`. */
export const getWebhookSecret = () => secrets.STRIPE_WEBHOOK_SECRET || undefined;
