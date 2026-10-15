import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Storybook/desktop shim for `next/link`.
 *
 * The ported page comes from web-ade (Next.js App Router). In the desktop app
 * there is no Next router, so links degrade to plain anchors. Navigation
 * intents will be wired through the workspace tab system later.
 */
import React from 'react';
function hrefToString(href) {
    if (typeof href === 'string')
        return href;
    return href?.pathname ?? '#';
}
const Link = React.forwardRef(function Link({ href, children, prefetch, replace, scroll, passHref, legacyBehavior, ...rest }, ref) {
    // Strip Next-only props so they don't reach the DOM.
    void prefetch;
    void replace;
    void scroll;
    void passHref;
    void legacyBehavior;
    return (_jsx("a", { ref: ref, href: hrefToString(href), ...rest, children: children }));
});
export default Link;
