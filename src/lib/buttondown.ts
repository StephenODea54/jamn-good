// Buttondown (newsletter sending) API client. Needs the BUTTONDOWN_API_KEY secret; everything here is
// a no-op until it's set. https://docs.buttondown.com
import { env } from 'cloudflare:workers';

const API = 'https://api.buttondown.com/v1';

const apiKey = () => (env as unknown as Record<string, string | undefined>).BUTTONDOWN_API_KEY?.trim() || undefined;

export const buttondownEnabled = () => Boolean(apiKey());

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const key = apiKey();
  if (!key) throw new Error('BUTTONDOWN_API_KEY is not set');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Token ${key}`, ...(body !== undefined && { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Buttondown ${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/**
 * Add a newsletter signup. Buttondown emails them a link to confirm (double opt-in). If the address
 * is already on the list, the details are merged and an unsubscribed address is re-subscribed.
 */
export async function addButtondownSubscriber(email: string, opts: { referrerUrl?: string; ip?: string } = {}) {
  await call(
    'POST',
    '/subscribers',
    {
      email_address: email,
      ...(opts.referrerUrl && { referrer_url: opts.referrerUrl }),
      ...(opts.ip && { ip_address: opts.ip }),
    },
    { 'X-Buttondown-Collision-Behavior': 'add' },
  );
}

/** Create a draft email; returns its Buttondown id. */
export async function createButtondownDraft(subject: string, markdown: string): Promise<string> {
  const email = await call('POST', '/emails', { subject, body: markdown, status: 'draft' });
  return email.id as string;
}

/** Update a draft. Returns false (and changes nothing) if it has already been sent or scheduled. */
export async function updateButtondownDraft(id: string, subject: string, markdown: string): Promise<boolean> {
  const current = await call('GET', `/emails/${id}`);
  if (current.status !== 'draft') return false;
  await call('PATCH', `/emails/${id}`, { subject, body: markdown });
  return true;
}
