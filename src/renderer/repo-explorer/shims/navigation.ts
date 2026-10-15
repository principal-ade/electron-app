/**
 * Navigation seam for the ported page.
 *
 * The port (web-ade) navigated with `next/link` + `next/navigation`, which are
 * shimmed under `shims/`. This module lets the desktop host register a handler
 * that turns those navigations into workspace intents. If no handler is set
 * (e.g. Storybook), the shims fall back to plain anchor behaviour / no-ops.
 */

export type NavigationHandler = (href: string) => boolean;

let handler: NavigationHandler | undefined;

/** Register (or clear) the navigation handler. */
export function setNavigationHandler(fn: NavigationHandler | undefined): void {
  handler = fn;
}

/**
 * Attempt to handle a navigation. Returns `true` when the handler took it
 * (the caller should `preventDefault`); `false` to fall back to default
 * behaviour (e.g. an external `target="_blank"` link).
 */
export function navigate(href: string): boolean {
  if (!handler) return false;
  try {
    return handler(href);
  } catch {
    return false;
  }
}
