/**
 * Storybook/desktop shim for `next/link`.
 *
 * The ported page comes from web-ade (Next.js App Router). In the desktop app
 * there is no Next router, so links degrade to plain anchors. Navigation
 * intents will be wired through the workspace tab system later.
 */

import React from 'react';

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
  { href, children, prefetch, replace, scroll, passHref, legacyBehavior, ...rest },
  ref,
) {
  // Strip Next-only props so they don't reach the DOM.
  void prefetch;
  void replace;
  void scroll;
  void passHref;
  void legacyBehavior;
  return (
    <a ref={ref} href={hrefToString(href)} {...rest}>
      {children}
    </a>
  );
});

export default Link;
