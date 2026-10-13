// Loads starting content from seed/seed.json into an EmDash site and attaches the product photos
// in public/images/products. It only adds what's missing: entries that already exist (matched by
// slug) and photos already set are left alone, so it's safe to re-run and won't undo admin edits.
//
//   EMDASH_URL=https://jamn-good.com EMDASH_TOKEN=ec_pat_... node scripts/load-content.mjs [collections...]
//
// Collections default to "products". Pass e.g. `products site_details` to load more.
// --replace-photos  also replaces product photos that are already set.
//
// Locally, get a token from /_emdash/api/setup/dev-bypass?token=1. On the live site, create one in
// the admin under your user settings (API tokens).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = (process.env.EMDASH_URL ?? 'http://localhost:4321').replace(/\/$/, '');
const TOKEN = process.env.EMDASH_TOKEN;
if (!TOKEN) {
  console.error('Set EMDASH_TOKEN (see the comment at the top of this file).');
  process.exit(1);
}
const args = process.argv.slice(2);
const replacePhotos = args.includes('--replace-photos');
const collections = args.filter((a) => !a.startsWith('--'));
if (collections.length === 0) collections.push('products');

const seed = JSON.parse(await readFile('seed/seed.json', 'utf8'));
const PHOTO_DIR = 'public/images/products';

async function api(method, route, body) {
  const res = await fetch(`${BASE}/_emdash/api${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body && !(body instanceof FormData) && { 'Content-Type': 'application/json' }),
    },
    body: body instanceof FormData ? body : body && JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // Not EmDash: e.g. a network filter's "page blocked" page, or the wrong EMDASH_URL.
    const title = text.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    throw new Error(`${method} ${route} -> ${res.status}: got a web page${title ? ` ("${title}")` : ''} instead of the EmDash API. Check EMDASH_URL and that this network can reach the site.`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${route} -> ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  }
  return json.data ?? json;
}

/** Upload one photo and return an EmDash image field value. */
async function upload(file, alt) {
  const form = new FormData();
  form.append('file', new File([await readFile(file)], path.basename(file), { type: 'image/jpeg' }));
  form.append('alt', alt);
  form.append('deduplicate', 'true');
  const { item } = await api('POST', '/media', form);
  console.log(`    uploaded ${path.basename(file)}`);
  return {
    provider: 'local',
    id: item.id,
    src: item.url,
    alt,
    width: item.width,
    height: item.height,
    mimeType: item.mimeType,
    filename: item.filename,
    meta: { storageKey: item.storageKey },
  };
}

/** Product photos by field: <slug>.jpg (shop), <slug>-tall.jpg (product page), <slug>-home.jpg (homepage). */
function photoFiles(slug) {
  const files = { image: `${slug}.jpg`, hero_image: `${slug}-tall.jpg`, home_image: `${slug}-home.jpg` };
  return Object.entries(files)
    .map(([field, name]) => [field, path.join(PHOTO_DIR, name)])
    .filter(([, file]) => existsSync(file));
}

async function addPhotos(slug, data) {
  let changed = false;
  const alt = data.kind === 'baked' ? `Jamn Good ${data.name.toLowerCase()}` : `Jar of Jamn Good ${data.name.toLowerCase()}`;
  for (const [field, file] of photoFiles(slug)) {
    if (data[field]?.id && !replacePhotos) continue;
    data[field] = await upload(file, alt);
    changed = true;
  }
  return changed;
}

async function listAll(collection) {
  const out = [];
  for (const status of ['published', 'draft']) {
    const { items } = await api('GET', `/content/${collection}?limit=100&status=${status}`);
    out.push(...items);
  }
  return out;
}

for (const collection of collections) {
  const entries = seed.content?.[collection];
  if (!entries) throw new Error(`seed/seed.json has no content for "${collection}"`);
  console.log(`${collection}:`);
  const existing = new Map((await listAll(collection)).map((e) => [e.slug, e]));

  for (const entry of entries) {
    const current = existing.get(entry.slug);
    const data = { ...(current?.data ?? entry.data) };
    const photosChanged = collection === 'products' ? await addPhotos(entry.slug, data) : false;

    if (!current) {
      const { item } = await api('POST', `/content/${collection}`, { slug: entry.slug, data });
      if (entry.status !== 'draft') await api('POST', `/content/${collection}/${item.id}/publish`, {});
      console.log(`  added ${entry.slug}`);
    } else if (photosChanged) {
      const { _rev } = await api('GET', `/content/${collection}/${current.id}`);
      await api('PUT', `/content/${collection}/${current.id}`, { data, _rev });
      if (current.status === 'published') await api('POST', `/content/${collection}/${current.id}/publish`, {});
      console.log(`  added photos to ${entry.slug}`);
    } else {
      console.log(`  ${entry.slug} already there`);
    }
  }
}
console.log('Done.');
