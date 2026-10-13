// Newsletter signups, saved to the private EmDash "subscribers" collection (as drafts, so they are
// never published). One entry per email address.
import { handleContentCreate, handleContentGet } from 'emdash';
import { getDb } from 'emdash/runtime';

const COLLECTION = 'subscribers';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase() : '');
export const isValidEmail = (email: string) => email.length <= 254 && EMAIL.test(email);

/** Slug from a hash of the address, so the same email always maps to the same entry. */
async function slugFor(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sub-${hex.slice(0, 24)}`;
}

/** Add an email to the list. Returns 'exists' if it was already on it. */
export async function addSubscriber(email: string, page: string): Promise<'added' | 'exists'> {
  const db = await getDb();
  const slug = await slugFor(email);
  const exists = async () => (await handleContentGet(db, COLLECTION, slug, undefined, { includeDrafts: true })).success;
  if (await exists()) return 'exists';

  const result = await handleContentCreate(db, COLLECTION, {
    slug,
    status: 'draft',
    data: { email, subscribed_at: new Date().toISOString(), signup_page: page },
  });
  if (result.success) return 'added';
  if (await exists()) return 'exists'; // two signups at once
  throw new Error(`Couldn't save subscriber: ${result.error.code} ${result.error.message}`);
}
