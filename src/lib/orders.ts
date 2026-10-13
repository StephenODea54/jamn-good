// Saves paid Stripe checkouts as entries in the EmDash "orders" collection (the pickup to-do list
// at /_emdash/admin). Called from the Stripe webhook and from the thank-you page; whichever runs
// first creates the order and the other finds it already there.
// Orders are kept as drafts so customer details are never published to the site.
import { handleContentCreate, handleContentGet } from 'emdash';
import { getDb } from 'emdash/runtime';
import type Stripe from 'stripe';

const COLLECTION = 'orders';

/** Short reference shown to the customer on the thank-you page ("Order #AB12CD34"). */
export const orderRef = (sessionId: string) => sessionId.slice(-8).toUpperCase();

const orderSlug = (sessionId: string) => `order-${sessionId.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

const dollars = (cents: number | null | undefined) => Math.round(cents ?? 0) / 100;

function itemsText(session: Stripe.Checkout.Session): string {
  return (session.line_items?.data ?? [])
    .map((li) => `${li.quantity ?? 1} × ${li.description} ($${dollars(li.amount_subtotal).toFixed(2)})`)
    .join('\n');
}

async function exists(db: Awaited<ReturnType<typeof getDb>>, slug: string): Promise<boolean> {
  const found = await handleContentGet(db, COLLECTION, slug, undefined, { includeDrafts: true });
  return found.success;
}

/**
 * Record a completed Checkout Session as an order, once. `session` must include `line_items`.
 * Unpaid sessions are ignored. Returns 'created' or 'exists'.
 */
export async function recordOrder(
  session: Stripe.Checkout.Session,
  paidAt: Date = new Date(),
): Promise<'created' | 'exists' | 'unpaid'> {
  if (session.payment_status === 'unpaid') return 'unpaid';

  const db = await getDb();
  const slug = orderSlug(session.id);
  if (await exists(db, slug)) return 'exists';

  const customer = session.customer_details;
  const notes = session.custom_fields?.find((f) => f.key === 'pickup_notes')?.text?.value;
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

  const result = await handleContentCreate(db, COLLECTION, {
    slug,
    status: 'draft',
    data: {
      order_number: `#${orderRef(session.id)}`,
      pickup_status: 'new',
      customer_name: customer?.individual_name ?? customer?.name ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      items: itemsText(session),
      pickup_notes: notes ?? '',
      total: dollars(session.amount_total),
      paid_at: paidAt.toISOString(),
      stripe_link: paymentIntent
        ? `https://dashboard.stripe.com/${session.livemode ? '' : 'test/'}payments/${paymentIntent}`
        : null,
      stripe_session: session.id,
    },
  });
  if (result.success) return 'created';

  // The webhook and the thank-you page can race; the loser hits the unique slug/session.
  if (await exists(db, slug)) return 'exists';
  throw new Error(`Couldn't save order ${session.id}: ${result.error.code} ${result.error.message}`);
}
