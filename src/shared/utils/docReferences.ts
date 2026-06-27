/**
 * Extract the file/doc *references* from a markdown string: the explicit links
 * (`[label](dest)`) and the inline-code spans (`` `code` ``). This is the pure,
 * I/O-free "layer 1" of topic link validation — given markdown text, it answers
 * *what is referenced and where*, classifying nothing about repos or purls. The
 * caller decides which links must be purl-qualified, resolves them against a
 * repo tree, etc.
 *
 * Deliberately zero-dependency and written portably (no electron/node imports)
 * so it can be lifted verbatim into `@principal-ade/markdown-utils` (a zero-dep
 * package) later. Like that package's `splitSections`, it is a fence-aware line
 * tokenizer rather than a full mdast parse — careful enough to skip fenced code
 * blocks and to never mistake link syntax *inside* inline code for a link, but
 * without pulling in a markdown AST.
 *
 * Known v1 limitations (acceptable for topic descriptions; revisit on promote):
 *  - links must open and close on a single line (no soft-wrapped links);
 *  - reference-style links (`[label][id]` + a `[id]: url` definition) and bare
 *    autolinks are not extracted — only inline `[label](dest)` and `<url>` are
 *    out of scope here too;
 *  - column is a 1-based UTF-16 offset (tabs count as one).
 */

export type DocReferenceKind = 'link' | 'inline-code';

export interface DocReference {
  kind: DocReferenceKind;
  /**
   * For a `link`: the destination (href) with any `<>` wrapper and trailing
   * `"title"` removed. For `inline-code`: the code text (one surrounding space
   * stripped per CommonMark when the span isn't all spaces).
   */
  value: string;
  /** Link label text (between the brackets). Undefined for inline-code. */
  label?: string;
  /** True when the link was an image (`![alt](src)`). Undefined otherwise. */
  image?: boolean;
  /** 1-based line where the reference starts. */
  line: number;
  /** 1-based column (UTF-16 offset) where the reference starts. */
  column: number;
}

/** Strip a `<...>` wrapper and a trailing `"title"` / `'title'` from a link dest. */
const cleanDestination = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return trimmed.slice(1, -1).trim();
  }
  // `url "title"` / `url 'title'` — the URL runs up to the first whitespace.
  const ws = trimmed.search(/\s/);
  return ws === -1 ? trimmed : trimmed.slice(0, ws);
};

/** Apply CommonMark's "strip one surrounding space" rule to inline-code text. */
const normalizeCode = (content: string): string => {
  if (
    content.length >= 2 &&
    content.startsWith(' ') &&
    content.endsWith(' ') &&
    content.trim().length > 0
  ) {
    return content.slice(1, -1);
  }
  return content;
};

/**
 * Scan a single (non-fence) line, emitting references found on it. `lineNo` is
 * the 1-based line number used for positions.
 */
const scanLine = (line: string, lineNo: number, out: DocReference[]): void => {
  let i = 0;
  const len = line.length;

  while (i < len) {
    const ch = line[i];

    // Backslash escapes the next char (so `\[` / `` \` `` are literal text).
    if (ch === '\\') {
      i += 2;
      continue;
    }

    // Inline code: a run of N backticks closes at the next run of exactly N.
    if (ch === '`') {
      const start = i;
      let n = 0;
      while (i < len && line[i] === '`') {
        n++;
        i++;
      }
      const contentStart = i;
      let close = -1;
      let j = i;
      while (j < len) {
        if (line[j] === '`') {
          let m = 0;
          const runStart = j;
          while (j < len && line[j] === '`') {
            m++;
            j++;
          }
          if (m === n) {
            close = runStart;
            break;
          }
        } else {
          j++;
        }
      }
      if (close !== -1) {
        out.push({
          kind: 'inline-code',
          value: normalizeCode(line.slice(contentStart, close)),
          line: lineNo,
          column: start + 1,
        });
        i = close + n;
      }
      // If unclosed, the opening backticks are literal; `i` already advanced
      // past them, so just keep scanning.
      continue;
    }

    // Link / image: `[label](dest)` or `![alt](src)`.
    const isImage = ch === '!' && line[i + 1] === '[';
    if (ch === '[' || isImage) {
      const refStart = i;
      const labelStart = isImage ? i + 2 : i + 1;

      // Find the matching `]`, honoring nesting and escapes.
      let depth = 1;
      let j = labelStart;
      while (j < len && depth > 0) {
        const c = line[j];
        if (c === '\\') {
          j += 2;
          continue;
        }
        if (c === '[') depth++;
        else if (c === ']') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (depth !== 0) {
        i = labelStart; // no closing `]` — treat the `[` as text
        continue;
      }
      const labelEnd = j; // index of the closing `]`

      // An inline link requires `(` immediately after the label.
      if (line[labelEnd + 1] !== '(') {
        i = labelEnd + 1;
        continue;
      }

      // Find the matching `)`, honoring nested parens and escapes.
      const destStart = labelEnd + 2;
      let pdepth = 1;
      let k = destStart;
      while (k < len && pdepth > 0) {
        const c = line[k];
        if (c === '\\') {
          k += 2;
          continue;
        }
        if (c === '(') pdepth++;
        else if (c === ')') {
          pdepth--;
          if (pdepth === 0) break;
        }
        k++;
      }
      if (pdepth !== 0) {
        i = destStart; // no closing `)` — not a link
        continue;
      }

      out.push({
        kind: 'link',
        value: cleanDestination(line.slice(destStart, k)),
        label: line.slice(labelStart, labelEnd),
        ...(isImage ? { image: true } : {}),
        line: lineNo,
        column: refStart + 1,
      });
      i = k + 1;
      continue;
    }

    i++;
  }
};

/**
 * Extract all link and inline-code references from a markdown document, in
 * document order. Content inside fenced code blocks (``` ``` ``` or `~~~`) is
 * skipped entirely.
 */
export const extractDocReferences = (markdown: string): DocReference[] => {
  if (typeof markdown !== 'string' || markdown.length === 0) return [];

  const out: DocReference[] = [];
  const lines = markdown.split('\n');
  let fence: string | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Toggle fenced-code state (mirrors markdown-utils `splitSections`).
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) {
        fence = marker;
        continue; // the opening fence line itself carries no references
      }
      if (marker === fence) {
        fence = null;
        continue; // closing fence line
      }
    }
    if (fence) continue; // inside a fenced code block

    scanLine(line, idx + 1, out);
  }

  return out;
};
