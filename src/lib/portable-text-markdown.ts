// Converts EmDash Portable Text (the rich-text editor's format) to Markdown for email.
// Relative links and image URLs are made absolute so they work outside the website.

type Span = { _type: 'span'; text?: string; marks?: string[] };
type MarkDef = { _key: string; _type: string; href?: string };
type Block = {
  _type: string;
  style?: string;
  listItem?: 'bullet' | 'number';
  level?: number;
  children?: Span[];
  markDefs?: MarkDef[];
  asset?: { url?: string };
  alt?: string;
  caption?: string;
};

const HEADINGS: Record<string, string> = { h1: '#', h2: '##', h3: '###', h4: '####', h5: '#####', h6: '######' };

/** Escape characters Markdown would otherwise treat as formatting. */
const escape = (text: string) => text.replace(/([\\`*_[\]#<>])/g, '\\$1');

function spans(block: Block, base: string): string {
  const defs = new Map((block.markDefs ?? []).map((d) => [d._key, d]));
  return (block.children ?? [])
    .map((span) => {
      let text = escape(span.text ?? '');
      if (!text.trim()) return text;
      const marks = span.marks ?? [];
      if (marks.includes('code')) text = `\`${span.text}\``;
      if (marks.includes('em')) text = `*${text}*`;
      if (marks.includes('strong')) text = `**${text}**`;
      if (marks.includes('strike-through')) text = `~~${text}~~`;
      for (const key of marks) {
        const def = defs.get(key);
        if (def?._type === 'link' && def.href) text = `[${text}](${new URL(def.href, base).href})`;
      }
      return text;
    })
    .join('');
}

export function portableTextToMarkdown(blocks: unknown[], base: string): string {
  const out: string[] = [];
  const counters = new Map<number, number>(); // numbered-list counters per nesting level
  let prevWasList = false;

  for (const raw of blocks as Block[]) {
    if (raw._type === 'image') {
      const url = raw.asset?.url;
      if (url) out.push(`![${escape(raw.alt ?? '')}](${new URL(url, base).href})${raw.caption ? `\n*${escape(raw.caption)}*` : ''}`);
      prevWasList = false;
      continue;
    }
    if (raw._type !== 'block') continue;

    const text = spans(raw, base);
    if (raw.listItem) {
      const level = Math.max(1, raw.level ?? 1);
      const indent = '   '.repeat(level - 1);
      for (const l of [...counters.keys()]) if (l > level) counters.delete(l);
      let marker = '-';
      if (raw.listItem === 'number') {
        const n = (counters.get(level) ?? 0) + 1;
        counters.set(level, n);
        marker = `${n}.`;
      }
      // List items in the same list are joined with single newlines
      if (prevWasList) out[out.length - 1] += `\n${indent}${marker} ${text}`;
      else out.push(`${indent}${marker} ${text}`);
      prevWasList = true;
      continue;
    }

    counters.clear();
    prevWasList = false;
    if (!text.trim()) continue;
    const heading = HEADINGS[raw.style ?? ''];
    if (heading) out.push(`${heading} ${text}`);
    else if (raw.style === 'blockquote') out.push(text.split('\n').map((l) => `> ${l}`).join('\n'));
    else out.push(text);
  }
  return out.join('\n\n');
}
