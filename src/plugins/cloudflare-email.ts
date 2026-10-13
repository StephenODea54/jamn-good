// EmDash email provider: delivers the CMS's own emails (admin sign-in links, invitations) through
// Cloudflare Email Sending. Registered in astro.config.mjs; as the only provider it is selected
// automatically.
import type { SandboxedPlugin } from 'emdash/plugin';
import { FROM_SITE, sendEmail } from '../lib/email';

export default {
  hooks: {
    'email:deliver': {
      exclusive: true,
      handler: async ({ message }: { message: { to: string; subject: string; text: string; html?: string } }) => {
        await sendEmail({ from: FROM_SITE, to: message.to, subject: message.subject, text: message.text, html: message.html });
      },
    },
  },
} satisfies SandboxedPlugin;
