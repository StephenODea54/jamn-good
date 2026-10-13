// Uploads the product photos in public/images into the EmDash media library and attaches them
// to the matching products. Safe to re-run: identical files are deduplicated by EmDash.
//
//   EMDASH_URL=http://localhost:4321 EMDASH_TOKEN=ec_pat_... node scripts/upload-photos.mjs
//
// Locally, get a token from /_emdash/api/setup/dev-bypass?token=1. On the live site, create
// one in the admin under your user settings (API tokens).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = (process.env.EMDASH_URL ?? 'http://localhost:4321').replace(/\/$/, '');
const TOKEN = process.env.EMDASH_TOKEN;
if (!TOKEN) {
  console.error('Set EMDASH_TOKEN (see the comment at the top of this file).');
  process.exit(1);
}

const img = (p) => path.join('public/images', p);

// product slug -> photos (paths relative to public/images)
const photos = {
  'strawberry-jam': {
    image: 'products/strawberry.jpg',
    hero_image: 'products/strawberry-detail.jpg',
    gallery: ['products/strawberry-thumb-1.jpg', 'products/strawberry-thumb-2.jpg', 'products/strawberry-thumb-3.jpg'],
    home_image: 'jam-strawberry.jpg',
  },
  'blueberry-jam': { image: 'products/blueberry.jpg', home_image: 'jam-blueberry.jpg' },
  'blackberry-jam': { image: 'products/blackberry.jpg', home_image: 'jam-blackberry.jpg' },
  'raspberry-jam': { image: 'products/raspberry.jpg' },
  'mixed-berry-jam': { image: 'products/mixed-berry.jpg' },
  'strawberry-jalapeno-jam': { image: 'products/strawberry-jalapeno.jpg' },
  'peach-jam': { image: 'products/peach.jpg', home_image: 'jam-peach.jpg' },
  'pumpkin-bread': { image: 'products/pumpkin-bread.jpg' },
};

async function api(method, route, body) {
  const res = await fetch(`${BASE}/_emdash/api${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body && !(body instanceof FormData) && { 'Content-Type': 'application/json' }),
    },
    body: body instanceof FormData ? body : body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${route} -> ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  }
  return json.data ?? json;
}

const uploaded = new Map();

/** Upload a file (once) and return an image field value. */
async function upload(file, alt) {
  if (uploaded.has(file)) return { ...uploaded.get(file), alt };
  const form = new FormData();
  const bytes = await readFile(img(file));
  form.append('file', new File([bytes], path.basename(file), { type: 'image/jpeg' }));
  form.append('alt', alt);
  form.append('deduplicate', 'true');
  const { item } = await api('POST', '/media', form);
  const value = {
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
  uploaded.set(file, value);
  console.log(`  uploaded ${file}`);
  return value;
}

const { items } = await api('GET', '/content/products?limit=100');
for (const entry of items) {
  const set = photos[entry.slug];
  if (!set) continue;
  const name = entry.data?.name ?? entry.slug;
  const label = entry.data?.kind === 'baked' ? `Jamn Good ${name.toLowerCase()}` : `Jar of Jamn Good ${name.toLowerCase()}`;
  console.log(name);

  const data = { ...entry.data };
  data.image = await upload(set.image, label);
  if (set.hero_image) data.hero_image = await upload(set.hero_image, label);
  if (set.home_image) data.home_image = await upload(set.home_image, label);
  if (set.gallery) {
    data.gallery = [];
    for (const [i, file] of set.gallery.entries()) {
      data.gallery.push({ photo: await upload(file, `${name}, photo ${i + 2}`) });
    }
  }

  await api('PUT', `/content/products/${entry.id}`, { data });
  await api('POST', `/content/products/${entry.id}/publish`, {});
}
console.log('Done.');
