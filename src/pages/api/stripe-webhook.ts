// Stripe webhook: saves each paid checkout as an order in EmDash (see src/lib/orders.ts).
// In the Stripe dashboard, add an endpoint for https://<site>/api/stripe-webhook with the events
// checkout.session.completed and checkout.session.async_payment_succeeded, then store its signing
// secret as STRIPE_WEBHOOK_SECRET.
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { recordOrder } from '../../lib/orders';
import { getStripe, getWebhookSecret } from '../../lib/stripe';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

export const POST: APIRoute = async ({ request }) => {
  const stripe = getStripe();
  const secret = getWebhookSecret();
  if (!stripe || !secret) return new Response('Webhook not configured', { status: 503 });

  // The signature covers the exact bytes Stripe sent, so read the raw body.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      request.headers.get('stripe-signature') ?? '',
      secret,
      undefined,
      cryptoProvider,
    );
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    try {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id, { expand: ['line_items'] });
      await recordOrder(session, new Date(event.created * 1000));
    } catch (error) {
      // A non-2xx response makes Stripe retry the event later.
      console.error('[stripe-webhook]', error instanceof Error ? error.message : error);
      return new Response('Could not save order', { status: 500 });
    }
  }

  return new Response('ok');
};
