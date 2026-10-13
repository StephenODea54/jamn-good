// robots.txt (replaces EmDash's default): keeps crawlers out of the admin, the API and order pages,
// and lists both sitemaps: EmDash's for products and newsletters, ours for the fixed pages.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site, url }) => {
  const origin = (site ?? url).origin;
  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /_emdash/',
      'Disallow: /api/',
      'Disallow: /checkout/',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      `Sitemap: ${origin}/sitemap-pages.xml`,
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } },
  );
};
