/**
 * Quote a string so it survives being pasted into a shell as a single argument.
 *
 * Used by drag-and-drop sources (project cards, recent-repository rows) that
 * drop a filesystem path onto an xterm terminal: xterm pastes `text/plain`
 * verbatim, so the payload must already be shell-safe. Bare paths made of safe
 * characters pass through unquoted; anything else is wrapped in single quotes
 * with embedded single quotes escaped.
 */
export function shellQuote(s: string): string {
  if (/^[\w@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
