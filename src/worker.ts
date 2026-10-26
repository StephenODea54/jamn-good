import handler, { createScheduledHandler, PluginBridge } from '@emdash-cms/cloudflare/worker';

export { PluginBridge };

// The canonical address is jamn-good.com; send www visitors there.
const CANONICAL_HOST = 'jamn-good.com';

export default {
  ...handler,
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    const response = await handler.fetch!(request, env, ctx);
    // Preview deploys (scripts/deploy-preview.mjs) live on workers.dev: keep them out of search results.
    if (url.hostname.endsWith('.workers.dev')) {
      const preview = new Response(response.body, response);
      preview.headers.set('X-Robots-Tag', 'noindex');
      return preview;
    }
    return response;
  },
  scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
