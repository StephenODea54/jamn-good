// Creates a Stripe Checkout Session for the cart and returns its URL.
// The browser only sends product slugs and quantities; names and prices come from EmDash.
// No sales tax: Ohio doesn't tax cottage food sold for eating off-site, and orders are pickup only.
import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { getProducts } from '../../lib/content';
import { getStripe } from '../../lib/stripe';

const MAX_LINES = 30;
const MAX_QTY = 99;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Normalise the posted cart: known shape, whole quantities, duplicates merged. */
function parseCart(body: unknown): Map<string, number> | undefined {
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) return undefined;
  const cart = new Map<string, number>();
  for (const item of items) {
    const slug = (item as { slug?: unknown })?.slug;
    const qty = (item as { qty?: unknown })?.qty;
    if (typeof slug !== 'string' || !Number.isInteger(qty) || (qty as number) < 1) return undefined;
    cart.set(slug, Math.min(MAX_QTY, (cart.get(slug) ?? 0) + (qty as number)));
  }
  return cart;
}

export const POST: APIRoute = async ({ request, url }) => {
  const stripe = getStripe();
  if (!stripe) return json({ error: 'Online checkout isn’t available yet. Please contact us to order.' }, 503);

  const cart = parseCart(await request.json().catch(() => undefined));
  if (!cart) return json({ error: 'Your cart looks empty or out of date. Please refresh and try again.' }, 400);

  const products = await getProducts();
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  // Stripe can only show product photos it can download, so skip them on localhost.
  const publicOrigin = url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const [slug, quantity] of cart) {
    const product = bySlug.get(slug);
    if (!product) {
      return json({ error: 'Something in your cart is no longer available. Please remove it and try again.' }, 409);
    }
    if (product.outOfStock) {
      return json({ error: `Sorry, ${product.name} just sold out. Please remove it from your cart to check out.` }, 409);
    }
    lineItems.push({
      quantity,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(product.price * 100),
        product_data: {
          name: product.name,
          metadata: { slug },
          ...(publicOrigin && product.image && { images: [new URL(product.image.src, url.origin).href] }),
        },
      },
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      // Without a billing address, Stripe doesn't always ask for a name, so ask for one for pickup.
      name_collection: { individual: { enabled: true, optional: false } },
      phone_number_collection: { enabled: true },
      custom_fields: [
        {
          key: 'pickup_notes',
          label: { type: 'custom', custom: 'Pickup notes (optional)' },
          type: 'text',
          optional: true,
        },
      ],
      custom_text: {
        submit: { message: 'Local pickup only. We’ll reach out after you order to set up a pickup time.' },
      },
      success_url: `${url.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url.origin}/shop?cart=open`,
      metadata: { fulfillment: 'local_pickup' },
    });

    return json({ url: session.url });
  } catch (error) {
    console.error('[checkout] Stripe error:', error instanceof Error ? error.message : error);
    return json({ error: 'We couldn’t start checkout. Please try again in a moment.' }, 502);
  }
};
