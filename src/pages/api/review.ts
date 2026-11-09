// Review form on the product pages. With JavaScript it gets JSON back and shows the result inline;
// without JavaScript it is redirected back to the product with ?review=<status>. Reviews are saved
// as drafts and the shop gets an email, so nothing appears on the site until it is published.
import type { APIRoute } from 'astro';
import { getProduct, getSiteDetails } from '../../lib/content';
import { escapeHtml, FROM_SITE, sendEmail, SITE_URL } from '../../lib/email';
import { addReview, LIMITS, type NewReview } from '../../lib/reviews';
import { isValidEmail, normalizeEmail } from '../../lib/subscribers';

type Status = 'thanks' | 'invalid' | 'error';

const text = (v: FormDataEntryValue | null | undefined) => (typeof v === 'string' ? v.trim() : '');

export const POST: APIRoute = async ({ request, url }) => {
  const form = await request.formData().catch(() => undefined);
  const product = await getProduct(text(form?.get('product'))).catch(() => undefined);

  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const respond = (status: Status) =>
    wantsJson
      ? new Response(JSON.stringify({ status }), {
          status: status === 'invalid' ? 400 : status === 'error' ? 500 : 200,
          headers: { 'content-type': 'application/json' },
        })
      : Response.redirect(new URL(product ? `/shop/${product.slug}?review=${status}#reviews` : '/shop', url), 303);

  // Bots fill in every field; people never see this one.
  if (form?.get('website')) return respond('thanks');

  const rating = Number(text(form?.get('rating')));
  const name = text(form?.get('name'));
  const body = text(form?.get('text'));
  const email = normalizeEmail(form?.get('email'));
  const valid =
    product &&
    Number.isInteger(rating) &&
    rating >= 1 &&
    rating <= 5 &&
    name.length > 0 &&
    name.length <= LIMITS.name &&
    body.length > 0 &&
    body.length <= LIMITS.text &&
    (email === '' || isValidEmail(email));
  if (!valid) return respond('invalid');

  const review: NewReview = { product: product.slug, rating, name, text: body, email };
  try {
    await addReview(review);
  } catch (error) {
    console.error('[review]', error instanceof Error ? error.message : error);
    return respond('error');
  }
  // The review is already saved, so a failed email is only logged.
  try {
    await sendReviewAlert(review, product.name);
  } catch (error) {
    console.error('[review] email:', error instanceof Error ? error.message : error);
  }
  return respond('thanks');
};

/** Tell the shop a review is waiting, with Reply-To set to the customer when they left an email. */
async function sendReviewAlert(review: NewReview, productName: string) {
  const site = await getSiteDetails();
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const adminUrl = `${SITE_URL}/_emdash/admin`;
  const from = review.email ? `${review.name} (${review.email})` : `${review.name} (no email given)`;
  await sendEmail({
    from: FROM_SITE,
    to: site.email,
    ...(review.email && { replyTo: { name: review.name, email: review.email } }),
    subject: `New ${review.rating}-star review: ${productName}`,
    text: [
      `New review of ${productName}`,
      '',
      stars,
      review.text,
      '',
      `From: ${from}`,
      '',
      `It's a draft: publish it in the admin under Reviews to show it on the site. ${adminUrl}`,
    ].join('\n'),
    html: `<div style="font-family:Georgia,serif;color:#3e3327;max-width:520px">
  <h2 style="margin:0 0 12px">New review of ${escapeHtml(productName)}</h2>
  <p style="margin:0 0 8px;font-size:20px;letter-spacing:2px">${stars}</p>
  <p style="margin:0 0 16px;white-space:pre-line">${escapeHtml(review.text)}</p>
  <p style="margin:0 0 16px;font-size:14px;color:#7a6a58">From: ${escapeHtml(from)}</p>
  <p style="margin:0;font-size:14px">It's a draft: publish it in the <a href="${adminUrl}">admin</a> under Reviews to show it on the site.</p>
</div>`,
  });
}
