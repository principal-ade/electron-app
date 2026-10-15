/**
 * Storybook/desktop shim for `next/link`.
 *
 * The ported page comes from web-ade (Next.js App Router). In the desktop app
 * there is no Next router: clicks are routed through the navigation seam
 * (`shims/navigation`) so the host can turn them into workspace intents.
 * Unhandled hrefs (e.g. external `target="_blank"` links) fall back to a plain
 * anchor — which Electron's window-open handler sends to the system browser.
 */

import React from 'react';
import { navigate } from './navigation';

type Href = string | { pathname?: string; query?: Record<string, unknown> };

export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: Href;
  children?: React.ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
}

function hrefToString(href: Href): string {
  if (typeof href === 'string') return href;
  return href?.pathname ?? '#';
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    children,
    onClick,
    prefetch,
    replace,
    scroll,
    passHref,
    legacyBehavior,
    ...rest
  },
  ref,
) {
  // Strip Next-only props so they don't reach the DOM.
  void prefetch;
  void replace;
  void scroll;
  void passHref;
  void legacyBehavior;

  const hrefStr = hrefToString(href);

  return (
    <a
      ref={ref}
      href={hrefStr}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (navigate(hrefStr)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
});

export default Link;
