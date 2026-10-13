// Reads site content from EmDash and shapes it for the components.
// Content is edited at /_emdash/admin; the collections are defined in seed/seed.json.
import { getEmDashCollection, getEmDashEntry } from 'emdash';
import type { Photo, Product } from '../data/products';
import type { MarketEvent, Store } from '../data/markets';

type Data = Record<string, any>;

const BY_ORDER = { orderBy: { sort_order: 'asc' as const }, limit: 200 };

async function entries(collection: string, options: Record<string, unknown> = {}) {
  const { entries: list, error } = await getEmDashCollection(collection, options);
  if (error) throw error;
  return list.map((e) => ({ slug: e.id as string, data: e.data as Data }));
}

const blank = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : v);

/** EmDash image field -> URL the browser can load. */
function photo(value: Data | null | undefined, fallbackAlt: string): Photo | undefined {
  if (!value?.id) return undefined;
  // The public file route (the /media/asset/ route needs a logged-in user).
  const key = value.meta?.storageKey;
  const src = value.src ?? (key ? `/_emdash/api/media/file/${encodeURIComponent(key)}` : undefined);
  if (!src) return undefined;
  return { src, alt: value.alt || fallbackAlt, width: value.width ?? undefined, height: value.height ?? undefined };
}

function toProduct(slug: string, d: Data): Product {
  const name = String(d.name ?? '');
  const alt = d.kind === 'baked' ? `Jamn Good ${name.toLowerCase()}` : `Jar of Jamn Good ${name.toLowerCase()}`;
  return {
    slug,
    name,
    price: Number(d.price ?? 0),
    kind: d.kind === 'baked' ? 'baked' : 'jam',
    limited: d.category === 'limited',
    note: blank(d.note) as string | undefined,
    image: photo(d.image, alt),
    hero: photo(d.hero_image, alt),
    gallery: ((d.gallery ?? []) as Data[])
      .map((g) => photo(g?.photo, alt))
      .filter((p): p is Photo => Boolean(p)),
    home: photo(d.home_image, alt),
    homePosition: blank(d.home_position) as number | undefined,
    description: d.description ?? '',
    ingredients: blank(d.ingredients) as string | undefined,
    storage: blank(d.storage) as string | undefined,
    rating: blank(d.rating) as number | undefined,
    reviews: blank(d.reviews) as number | undefined,
  };
}

export async function getProducts(): Promise<Product[]> {
  return (await entries('products', BY_ORDER)).map(({ slug, data }) => toProduct(slug, data));
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const { entry, error } = await getEmDashEntry('products', slug);
  if (error) throw error;
  return entry ? toProduct(entry.id as string, entry.data as Data) : undefined;
}

/** Products shown in the homepage row, in their homepage position. */
export async function getFeaturedProducts(): Promise<Product[]> {
  return (await getProducts())
    .filter((p) => p.homePosition !== undefined)
    .sort((a, b) => a.homePosition! - b.homePosition!);
}

export async function getEvents(): Promise<MarketEvent[]> {
  return (await entries('events', { orderBy: { date: 'asc' }, limit: 200 })).map(({ data: d }) => ({
    name: d.name,
    date: String(d.date ?? '').slice(0, 10),
    town: d.town ?? '',
    start: blank(d.start_time) as string | undefined,
    end: blank(d.end_time) as string | undefined,
  }));
}

export async function getStores(): Promise<Store[]> {
  return (await entries('stores', BY_ORDER)).map(({ data: d }) => ({
    name: d.name,
    branch: blank(d.branch) as string | undefined,
    street: d.street ?? '',
    city: d.city ?? '',
    color: blank(d.color) as string | undefined,
  }));
}

export interface Faq {
  question: string;
  /** Portable Text */
  answer: unknown[];
}

export async function getFaqs(): Promise<Faq[]> {
  return (await entries('faqs', BY_ORDER)).map(({ data: d }) => ({ question: d.question, answer: d.answer ?? [] }));
}

export async function getTreats(): Promise<string[]> {
  return (await entries('treats', BY_ORDER)).map(({ data: d }) => d.name as string);
}

export interface SiteDetails {
  email: string;
  facebook?: string;
  instagram?: string;
  pickupInstructions?: string;
}

export async function getSiteDetails(): Promise<SiteDetails> {
  const [first] = await entries('site_details', { limit: 1 });
  const d = first?.data ?? {};
  return {
    email: d.email || 'hey@jamn-good.com',
    facebook: blank(d.facebook_url) as string | undefined,
    instagram: blank(d.instagram_url) as string | undefined,
    pickupInstructions: blank(d.pickup_instructions) as string | undefined,
  };
}

export interface Newsletter {
  slug: string;
  title: string;
  preview?: string;
  /** Portable Text */
  body: unknown[];
  publishedAt?: string;
}

function toNewsletter(slug: string, d: Data): Newsletter {
  return {
    slug,
    title: String(d.title ?? ''),
    preview: blank(d.preview) as string | undefined,
    body: (d.body ?? []) as unknown[],
    publishedAt: blank(d.publishedAt) as string | undefined,
  };
}

/** Published newsletter issues, newest first. Empty if the collection hasn't been added to this site yet. */
export async function getNewsletters(): Promise<Newsletter[]> {
  try {
    return (await entries('newsletters', { orderBy: { published_at: 'desc' }, limit: 200 })).map(({ slug, data }) =>
      toNewsletter(slug, data),
    );
  } catch (error) {
    console.error('[newsletters] (run scripts/sync-schema.mjs?)', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function getNewsletter(slug: string): Promise<Newsletter | undefined> {
  try {
    const { entry, error } = await getEmDashEntry('newsletters', slug);
    if (error) throw error;
    return entry ? toNewsletter(entry.id as string, entry.data as Data) : undefined;
  } catch (error) {
    console.error('[newsletters]', error instanceof Error ? error.message : error);
    return undefined;
  }
}

/** "October 13, 2026" */
export const formatIssueDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : '';
