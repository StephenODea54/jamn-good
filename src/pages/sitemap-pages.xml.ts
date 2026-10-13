// Sitemap for the site's fixed pages. EmDash's /sitemap.xml covers products and newsletters.
import type { APIRoute } from 'astro';

const PAGES = ['/', '/shop', '/where-to-find-us', '/newsletter', '/faq', '/contact'];

export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? url).origin;
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PAGES.map((p) => `  <url><loc>${origin}${p}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
};
