// When a Newsletter is published in EmDash, create (or update) a matching draft in Buttondown so it
// can be reviewed and sent from there. Nothing is ever sent automatically. Once Buttondown has sent
// or scheduled an issue, later edits in EmDash only change the website copy.
import type { SandboxedPlugin } from 'emdash/plugin';
import { buttondownEnabled, createButtondownDraft, updateButtondownDraft } from '../lib/buttondown';
import { SITE_URL } from '../lib/email';
import { portableTextToMarkdown } from '../lib/portable-text-markdown';

type Entry = { id?: string; slug?: string; data?: Record<string, unknown> } & Record<string, unknown>;
type Ctx = {
  kv: { get<T>(key: string): Promise<T | null>; set(key: string, value: unknown): Promise<void> };
  log: { info(msg: string, data?: unknown): void; warn(msg: string, data?: unknown): void; error(msg: string, data?: unknown): void };
};

export default {
  hooks: {
    'content:afterPublish': {
      handler: async (event: { collection: string; content: Entry }, ctx: Ctx) => {
        if (event.collection !== 'newsletters') return;
        if (!buttondownEnabled()) {
          ctx.log.warn('Newsletter published, but BUTTONDOWN_API_KEY is not set; no Buttondown draft created.');
          return;
        }
        const entry = event.content;
        const data = (entry.data ?? entry) as Record<string, unknown>;
        const id = String(entry.id ?? '');
        const slug = String(entry.slug ?? data.slug ?? '');
        const subject = String(data.title ?? '').trim();
        if (!id || !subject) return;

        const webUrl = `${SITE_URL}/newsletter/${slug}`;
        const markdown = [
          '<!-- buttondown-editor-mode: plaintext -->',
          portableTextToMarkdown((data.body ?? []) as unknown[], SITE_URL),
          '---',
          `[Read this newsletter on the website](${webUrl})`,
        ].join('\n\n');

        try {
          const key = `buttondown-draft:${id}`;
          const draftId = await ctx.kv.get<string>(key);
          if (draftId) {
            const updated = await updateButtondownDraft(draftId, subject, markdown);
            ctx.log.info(updated ? 'Updated Buttondown draft' : 'Buttondown email already sent; left it alone', { draftId });
          } else {
            await ctx.kv.set(key, await createButtondownDraft(subject, markdown));
            ctx.log.info('Created Buttondown draft', { subject });
          }
        } catch (error) {
          // Publishing on the website still succeeds; the draft can be created by publishing again.
          ctx.log.error('Buttondown draft failed', error instanceof Error ? error.message : error);
        }
      },
    },
  },
} satisfies SandboxedPlugin;
