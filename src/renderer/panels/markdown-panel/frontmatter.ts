import yaml from 'js-yaml';

/**
 * Result of splitting a markdown document into its YAML front matter and the
 * remaining body. `data` is the parsed front matter (empty object when there
 * is none or it fails to parse); `body` is the markdown with the leading
 * `---\n…\n---` fence removed.
 */
export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
  /** True when a well-formed front matter fence was found and parsed. */
  hasFrontmatter: boolean;
}

// Matches a leading YAML front matter fence: `---` on its own first line,
// any content, then a closing `---` line. Tolerates CRLF and a trailing
// newline after the closing fence.
const FENCE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

/** Strip a matched pair of surrounding single/double quotes, if present. */
const stripQuotes = (value: string): string => {
  const t = value.trim();
  if (t.length >= 2) {
    const first = t[0];
    const last = t[t.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return t.slice(1, -1);
    }
  }
  return t;
};

/** Parse an inline YAML flow list: `[a, "b", c]` -> ['a', 'b', 'c']. */
const parseInlineList = (value: string): string[] =>
  value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((part) => stripQuotes(part))
    .filter((part) => part.length > 0);

const TOP_LEVEL_KEY = /^([A-Za-z0-9_-]+):[ \t]?(.*)$/;
const BLOCK_LIST_ITEM = /^\s*-\s+(.*)$/;

/**
 * Best-effort, line-based front matter parser used as a fallback when strict
 * YAML parsing fails. Real-world front matter is often slightly malformed
 * (e.g. a quoted segment followed by trailing text, or literal markdown inside
 * a value), and a document header shouldn't vanish because of it. Handles
 * top-level scalars, inline `[a, b]` lists, block `- ` lists, and folded /
 * literal (`>` / `|`) block scalars. It does not attempt nested mappings.
 */
const parseLenient = (text: string): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const keyMatch = lines[i].match(TOP_LEVEL_KEY);
    if (!keyMatch) {
      i++;
      continue;
    }

    const key = keyMatch[1];
    const rest = keyMatch[2].trim();

    // An empty or block-scalar marker means the value continues on the
    // following (indented) lines: either a `- ` list or a wrapped scalar.
    if (
      rest === '' ||
      rest === '>' ||
      rest === '|' ||
      rest === '>-' ||
      rest === '|-'
    ) {
      const isBlockScalar = rest.startsWith('>') || rest.startsWith('|');
      const items: string[] = [];
      const blockLines: string[] = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const next = lines[j];
        if (TOP_LEVEL_KEY.test(next)) break; // next top-level key ends the value
        const listItem = next.match(BLOCK_LIST_ITEM);
        if (!isBlockScalar && listItem) {
          items.push(stripQuotes(listItem[1]));
        } else if (isBlockScalar && (next.trim() === '' || /^\s/.test(next))) {
          blockLines.push(next.trim());
        } else if (!isBlockScalar && next.trim() === '') {
          continue; // tolerate blank lines between list items
        } else {
          break;
        }
      }
      if (items.length) data[key] = items;
      else if (blockLines.length) data[key] = blockLines.join(' ').trim();
      i = j;
      continue;
    }

    data[key] = rest.startsWith('[')
      ? parseInlineList(rest)
      : stripQuotes(rest);
    i++;
  }

  return data;
};

/**
 * Split markdown into parsed front matter and body. Never throws. Tries strict
 * YAML first; if that fails (or yields a non-mapping), falls back to a lenient
 * line-based parse so imperfect front matter still produces a header. Only
 * strips the fence from `body` when we actually extracted data — otherwise the
 * original content is returned untouched so nothing is silently lost.
 */
export const parseFrontmatter = (content: string): ParsedFrontmatter => {
  const match = content.match(FENCE);
  if (!match) {
    return { data: {}, body: content, hasFrontmatter: false };
  }

  let data: Record<string, unknown> | null = null;

  try {
    const parsed = yaml.load(match[1]);
    // Only a key/value mapping counts as front matter for our header UI.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // Strict parse failed — fall through to the lenient parser below.
  }

  if (!data) {
    const lenient = parseLenient(match[1]);
    if (Object.keys(lenient).length > 0) {
      data = lenient;
    }
  }

  if (data) {
    return { data, body: content.slice(match[0].length), hasFrontmatter: true };
  }

  return { data: {}, body: content, hasFrontmatter: false };
};

/** Raw split of a document into its front matter pieces (no parsing). */
export interface SplitFrontmatter {
  /** The full fence block, including the `---` lines and trailing newline.
   *  Empty string when the document has no front matter. */
  raw: string;
  /** The YAML text between the fences (no fences). Empty when none. */
  inner: string;
  /** Everything after the closing fence. The whole document when no fence. */
  body: string;
}

/**
 * Split a document into its (verbatim) front matter block and body without
 * parsing the YAML. Lets a host edit the body in isolation and re-attach the
 * original front matter byte-for-byte on save, so a document the strict parser
 * can't read is still safely editable.
 */
export const splitFrontmatter = (content: string): SplitFrontmatter => {
  const match = content.match(FENCE);
  if (!match) return { raw: '', inner: '', body: content };
  return {
    raw: match[0],
    inner: match[1],
    body: content.slice(match[0].length),
  };
};

/**
 * Wrap a block of YAML in `---` fences, or return an empty string when the YAML
 * is blank (so clearing the editor removes the front matter entirely). The
 * inverse of {@link splitFrontmatter}'s `inner`.
 */
export const buildFrontmatter = (inner: string): string => {
  const trimmed = inner.replace(/\s+$/, '');
  return trimmed.trim() ? `---\n${trimmed}\n---\n` : '';
};

/**
 * Inspect a document's YAML front matter the way a *strict* parser would.
 * Returns the YAML error message when the front matter would make a strict
 * `yaml.load` throw, or `null` when there's no front matter or it loads cleanly.
 *
 * Our own {@link parseFrontmatter} tolerates broken front matter, but the
 * third-party MDX editor used for the *edit* surface calls `yaml.load` with no
 * guard and crashes the whole panel. Hosts can call this before mounting that
 * editor to detect the problem and offer a fix instead of white-screening. The
 * most common breakage is a folded / literal (`>` / `|`) block scalar whose
 * continuation lines are indented less than its first line — js-yaml then reads
 * a later line as a new mapping entry and throws `bad indentation of a mapping
 * entry`.
 */
export const getFrontmatterError = (content: string): string | null => {
  const match = content.match(FENCE);
  if (!match) return null;
  try {
    yaml.load(match[1]);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
};

/**
 * Rewrite a document so its YAML front matter loads under a strict parser,
 * returning the (possibly rewritten) full document.
 *
 * No-op when there is no front matter or it already loads — valid documents are
 * returned byte-for-byte. Only when a strict load *throws* do we recover the
 * fields with the lenient parser and re-emit them as well-formed YAML via
 * `yaml.dump`. The original content is returned untouched when nothing can be
 * recovered, so we never make a document worse. Recovery flattens block scalars
 * and drops any nested mappings the lenient parser doesn't model — an
 * acceptable trade vs. an uneditable document. Intended to back a user-initiated
 * "fix front matter" action (see {@link getFrontmatterError}), not silent
 * rewrites on read.
 */
export const repairFrontmatter = (content: string): string => {
  const match = content.match(FENCE);
  if (!match) return content;

  try {
    yaml.load(match[1]);
    return content; // already loads — leave the document exactly as-is
  } catch {
    // Strict load failed — fall through and attempt a recovery rewrite.
  }

  const recovered = parseLenient(match[1]);
  if (Object.keys(recovered).length === 0) return content;

  // `lineWidth: -1` keeps long values on a single line instead of folding them
  // back into the kind of multi-line scalar that caused the original breakage.
  const dumped = yaml.dump(recovered, { lineWidth: -1 }).replace(/\n$/, '');
  const body = content.slice(match[0].length);
  return `---\n${dumped}\n---\n${body}`;
};

/**
 * Drop the body's leading H1 heading when it merely repeats the front matter
 * `title`, so the title isn't shown twice (once in the styled header, once as
 * the document's first heading). Returns the body unchanged unless the very
 * first non-blank line is an H1 (ATX `# Title` or setext `Title\n===`) whose
 * text equals `title` (trimmed, case-insensitive).
 *
 * Safe for note highlights: anchoring is text-quote based, so only a note
 * anchored to the removed title line itself is affected (its text now lives in
 * the header) — every other note still resolves by its quote. Intended for the
 * document render only; leave slide decks untouched so their title slide stays.
 */
export const stripRedundantTitleHeading = (
  body: string,
  title: string | undefined,
): string => {
  const wanted = title?.trim().toLowerCase();
  if (!wanted) return body;

  const lines = body.split('\n');
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  if (start >= lines.length) return body;

  const line = lines[start];
  let headingText: string | null = null;
  let consumed = 0;

  const atx = line.match(/^#\s+(.*?)\s*#*\s*$/); // H1 only (single `#`)
  if (atx) {
    headingText = atx[1];
    consumed = 1;
  } else if (
    line.trim() !== '' &&
    start + 1 < lines.length &&
    /^=+\s*$/.test(lines[start + 1])
  ) {
    headingText = line.trim(); // setext H1: `Title` underlined with `===`
    consumed = 2;
  }

  if (headingText === null || headingText.trim().toLowerCase() !== wanted) {
    return body;
  }

  // Remove the heading and any blank lines immediately following it so the body
  // doesn't open with a gap.
  let end = start + consumed;
  while (end < lines.length && lines[end].trim() === '') end++;
  return lines.slice(end).join('\n');
};

/** Coerce an unknown front matter value to a trimmed string, or undefined. */
export const fmString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

/**
 * Coerce an unknown front matter value to a list of strings. Accepts a YAML
 * array (`[a, b]`) or a single scalar (returned as a one-element list).
 */
export const fmStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => fmString(v)).filter((v): v is string => !!v);
  }
  const single = fmString(value);
  return single ? [single] : [];
};
