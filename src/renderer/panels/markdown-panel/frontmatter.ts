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
    if (rest === '' || rest === '>' || rest === '|' || rest === '>-' || rest === '|-') {
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

    data[key] = rest.startsWith('[') ? parseInlineList(rest) : stripQuotes(rest);
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
