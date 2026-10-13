// Saves paid Stripe checkouts as entries in the EmDash "orders" collection (the pickup to-do list
// at /_emdash/admin). Called from the Stripe webhook and from the thank-you page; whichever runs
// first creates the order and the other finds it already there.
// Orders are kept as drafts so customer details are never published to the site.
// Each new order also emails an alert to the contact address in Site Details.
import { handleContentCreate, handleContentGet } from 'emdash';
import { getDb } from 'emdash/runtime';
import type Stripe from 'stripe';
import { getSiteDetails } from './content';
import { escapeHtml, FROM_ORDERS, sendEmail, SITE_URL } from './email';

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
  if (result.success) {
    // The order is saved either way; a failed alert is only logged.
    await sendOrderAlert(session, notes).catch((error) =>
      console.error('[orders] alert email failed:', error instanceof Error ? error.message : error),
    );
    return 'created';
  }

  // The webhook and the thank-you page can race; the loser hits the unique slug/session.
  if (await exists(db, slug)) return 'exists';
  throw new Error(`Couldn't save order ${session.id}: ${result.error.code} ${result.error.message}`);
}

/** Email the shop a summary of a new order, with Reply-To set to the customer. */
async function sendOrderAlert(session: Stripe.Checkout.Session, notes: string | null | undefined) {
  const site = await getSiteDetails();
  const customer = session.customer_details;
  const name = customer?.individual_name ?? customer?.name ?? 'A customer';
  const ref = `#${orderRef(session.id)}`;
  const total = `$${dollars(session.amount_total).toFixed(2)}`;
  const items = itemsText(session);
  const rows: [string, string][] = [
    ['Name', name],
    ['Email', customer?.email ?? ''],
    ['Phone', customer?.phone ?? ''],
    ['Pickup notes', notes || 'None'],
    ['Total paid', total],
  ];
  const adminUrl = `${SITE_URL}/_emdash/admin`;

  await sendEmail({
    from: FROM_ORDERS,
    to: site.email,
    ...(customer?.email && { replyTo: { name, email: customer.email } }),
    subject: `New order ${ref}: ${name}, ${total}`,
    text: [
      `New pickup order ${ref}`,
      '',
      items,
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      '',
      'Reply to this email to reach the customer.',
      `Orders list: ${adminUrl} (Orders)`,
    ].join('\n'),
    html: `<div style="font-family:Georgia,serif;color:#3e3327;max-width:520px">
  <h2 style="margin:0 0 12px">New pickup order ${escapeHtml(ref)}</h2>
  <p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(items)}</p>
  <table style="border-collapse:collapse;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#7a6a58">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`)
    .join('')}</table>
  <p style="margin:16px 0 0;font-size:14px">Reply to this email to reach the customer. All orders are in the <a href="${adminUrl}">admin</a> under Orders.</p>
</div>`,
  });
}
