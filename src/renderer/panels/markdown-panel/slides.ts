// Slide detection for the Markdown panel.
//
// We treat a document as a slide deck when it follows the conventional
// markdown-slides format: slides separated by a `---` thematic-break line
// (the convention used by Marp, reveal.js, remark, etc.). This is deliberately
// NOT themed-markdown's `parseMarkdownIntoPresentation`, which splits *any*
// multi-heading document on `#`/`##` headings and would turn ordinary READMEs
// into "decks".
//
// Callers pass the front-matter-stripped body (see `parseFrontmatter`), so the
// leading `---` YAML fence is never mistaken for a slide separator.

// A line that is exactly a `---` thematic break (allowing surrounding spaces).
const SEPARATOR = /^\s*---\s*$/;

// Opens/closes a fenced code block: ``` or ~~~ (optionally indented, with an
// info string). We must not split on `---` lines that live inside code.
const FENCE = /^\s{0,3}(```+|~~~+)/;

/**
 * Split a markdown body into slides on `---` separator lines.
 *
 * Returns one entry per slide with empty segments dropped. A body with no
 * separators yields a single slide (the whole document); two or more slides
 * means it's a real deck.
 */
export const splitIntoSlides = (body: string): string[] => {
  const lines = body.split('\n');
  const slides: string[] = [];
  let current: string[] = [];
  let inCodeBlock = false;
  let fenceDelimiter = '';

  const flush = () => {
    const slide = current.join('\n').trim();
    if (slide.length > 0) slides.push(slide);
    current = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const delimiter = fenceMatch[1][0]; // '`' or '~'
      if (!inCodeBlock) {
        inCodeBlock = true;
        fenceDelimiter = delimiter;
      } else if (delimiter === fenceDelimiter) {
        inCodeBlock = false;
      }
    }

    if (!inCodeBlock && SEPARATOR.test(line)) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();

  return slides;
};

/** True when the body is a real `---`-separated slide deck (2+ slides). */
export const isSlideshow = (body: string): boolean =>
  splitIntoSlides(body).length > 1;
