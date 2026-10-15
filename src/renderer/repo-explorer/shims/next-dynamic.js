import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Storybook/desktop shim for `next/dynamic`.
 *
 * web-ade uses `dynamic(() => import(...).then((m) => m.X), { ssr: false })` to
 * keep heavy panels (File City, Monaco) client-only. In the desktop renderer
 * everything is client-side, so this just wraps the loader in `React.lazy`.
 * The loader may resolve to either a component or a `{ default }` module.
 */
import React from 'react';
export default function dynamic(loader, _options) {
    const Lazy = React.lazy(async () => {
        const mod = await loader();
        const component = (mod.default ??
            mod);
        return { default: component };
    });
    const DynamicComponent = (props) => (_jsx(React.Suspense, { fallback: null, children: _jsx(Lazy, { ...props }) }));
    DynamicComponent.displayName = 'DynamicComponent';
    return DynamicComponent;
}
