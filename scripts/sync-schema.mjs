// Adds collections and fields from seed/seed.json that an EmDash site doesn't have yet, and turns on
// SEO for collections the seed marks hasSeo.
// The site's content types are created once at setup, so run this after adding a collection or
// field to the seed. Apart from switching SEO on, it never changes or removes anything that exists.
//
//   EMDASH_URL=https://jamn-good.com EMDASH_TOKEN=ec_pat_... node scripts/sync-schema.mjs
//
// Locally, get a token from /_emdash/api/setup/dev-bypass?token=1. On the live site, create one in
// the admin under your user settings (API tokens).
import { readFile } from 'node:fs/promises';

const BASE = (process.env.EMDASH_URL ?? 'http://localhost:4321').replace(/\/$/, '');
const TOKEN = process.env.EMDASH_TOKEN;
if (!TOKEN) {
  console.error('Set EMDASH_TOKEN (see the comment at the top of this file).');
  process.exit(1);
}
const seed = JSON.parse(await readFile('seed/seed.json', 'utf8'));

async function api(method, route, body, okStatuses = []) {
  const res = await fetch(`${BASE}/_emdash/api${route}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const title = text.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    throw new Error(`${method} ${route} -> ${res.status}: got a web page${title ? ` ("${title}")` : ''} instead of the EmDash API. Check EMDASH_URL and that this network can reach the site.`);
  }
  if (okStatuses.includes(res.status)) return { status: res.status, json };
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${route} -> ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  }
  return { status: res.status, json };
}

for (const collection of seed.collections) {
  const { fields, titleField, dateField, ...meta } = collection;
  const found = await api('GET', `/schema/collections/${collection.slug}?includeFields=true`, undefined, [404]);
  let have = new Set();
  if (found.status === 404) {
    await api('POST', '/schema/collections', meta);
    console.log(`+ collection ${collection.slug}`);
  } else {
    const data = found.json.data ?? {};
    const current = data.item ?? data;
    have = new Set((current.fields ?? data.fields ?? []).map((f) => f.slug));
    // Turn on SEO (sitemap + per-entry SEO settings) where the seed asks for it.
    if (collection.hasSeo && !current.hasSeo) {
      await api('PUT', `/schema/collections/${collection.slug}`, { hasSeo: true });
      console.log(`  ~ ${collection.slug}: SEO turned on`);
    }
  }
  let added = 0;
  for (const [i, field] of fields.entries()) {
    if (have.has(field.slug)) continue;
    await api('POST', `/schema/collections/${collection.slug}/fields`, { validation: null, sortOrder: i, ...field });
    console.log(`  + field ${collection.slug}.${field.slug}`);
    added++;
  }
  if (found.status === 404 && (titleField || dateField)) {
    await api('PUT', `/schema/collections/${collection.slug}`, { titleField, dateField });
  }
  if (found.status !== 404 && added === 0) console.log(`  ${collection.slug} up to date`);
}
console.log('Done.');
