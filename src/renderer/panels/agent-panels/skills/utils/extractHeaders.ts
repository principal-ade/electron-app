/**
 * Represents a markdown header with its metadata
 */
export interface MarkdownHeader {
  /** Header level (1-6) */
  level: number;
  /** Header text content */
  text: string;
  /** Generated ID for anchor linking */
  id: string;
}

/**
 * Extracts all headers from markdown content
 *
 * @param markdown - Clean markdown content (without frontmatter)
 * @returns Array of header objects with level, text, and ID
 *
 * @example
 * ```typescript
 * const headers = extractHeaders('# Title\n## Subtitle\n### Section');
 * // [
 * //   { level: 1, text: 'Title', id: 'title' },
 * //   { level: 2, text: 'Subtitle', id: 'subtitle' },
 * //   { level: 3, text: 'Section', id: 'section' }
 * // ]
 * ```
 */
export function extractHeaders(markdown: string): MarkdownHeader[] {
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const headers: MarkdownHeader[] = [];
  let match;

  while ((match = headerRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();

    // Generate ID similar to how GitHub does it
    // - Lowercase
    // - Replace spaces with hyphens
    // - Remove special characters except hyphens
    const id = text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');

    headers.push({ level, text, id });
  }

  return headers;
}
