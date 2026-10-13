import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { d1, r2 } from '@emdash-cms/cloudflare';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import emdash from 'emdash/astro';

export default defineConfig({
  // Public address; used for absolute URLs in link previews.
  site: 'https://jamn-good.com',
  // EmDash content is read per request, so pages render on the Worker instead of at build time.
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    // React is only used by the EmDash admin at /_emdash/admin.
    react(),
    emdash({
      database: d1({ binding: 'DB', session: 'auto' }),
      storage: r2({ binding: 'MEDIA' }),
      plugins: [
        {
          // Sends the CMS's emails (sign-in links etc.) via Cloudflare Email Sending
          id: 'cloudflare-email',
          version: '1.0.0',
          format: 'standard',
          entrypoint: fileURLToPath(new URL('./src/plugins/cloudflare-email.ts', import.meta.url)),
          capabilities: ['hooks.email-transport:register'],
        },
      ],
    }),
  ],
  devToolbar: { enabled: false },
});
