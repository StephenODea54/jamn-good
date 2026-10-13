// Newsletter signup. The homepage form posts here; with JavaScript it gets JSON back and shows the
// result inline, without JavaScript it is redirected back to the homepage with ?newsletter=<status>.
import type { APIRoute } from 'astro';
import { addButtondownSubscriber, buttondownEnabled } from '../../lib/buttondown';
import { addSubscriber, isValidEmail, normalizeEmail } from '../../lib/subscribers';

type Status = 'subscribed' | 'confirm' | 'already' | 'invalid' | 'error';

export const POST: APIRoute = async ({ request, url }) => {
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const respond = (status: Status) =>
    wantsJson
      ? new Response(JSON.stringify({ status }), {
          status: status === 'invalid' ? 400 : status === 'error' ? 500 : 200,
          headers: { 'content-type': 'application/json' },
        })
      : Response.redirect(new URL(`/?newsletter=${status}#newsletter`, url), 303);

  const form = await request.formData().catch(() => undefined);
  // Bots fill in every field; people never see this one.
  if (form?.get('website')) return respond('subscribed');

  const email = normalizeEmail(form?.get('email'));
  if (!isValidEmail(email)) return respond('invalid');

  try {
    const page = new URL(request.headers.get('referer') ?? '/', url);
    const result = await addSubscriber(email, page.pathname);
    // Also add them to Buttondown, which sends a confirmation email. The signup is already saved in
    // EmDash, so a Buttondown hiccup is only logged.
    if (buttondownEnabled()) {
      try {
        await addButtondownSubscriber(email, {
          referrerUrl: new URL(page.pathname, url).href,
          ip: request.headers.get('cf-connecting-ip') ?? undefined,
        });
        return respond('confirm');
      } catch (error) {
        console.error('[subscribe] Buttondown:', error instanceof Error ? error.message : error);
      }
    }
    return respond(result === 'added' ? 'subscribed' : 'already');
  } catch (error) {
    console.error('[subscribe]', error instanceof Error ? error.message : error);
    return respond('error');
  }
};
