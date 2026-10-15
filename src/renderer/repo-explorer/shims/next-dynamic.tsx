/**
 * Storybook/desktop shim for `next/dynamic`.
 *
 * web-ade uses `dynamic(() => import(...).then((m) => m.X), { ssr: false })` to
 * keep heavy panels (File City, Monaco) client-only. In the desktop renderer
 * everything is client-side, so this just wraps the loader in `React.lazy`.
 * The loader may resolve to either a component or a `{ default }` module.
 */

import React from 'react';

type Loader<P> = () => Promise<
  React.ComponentType<P> | { default: React.ComponentType<P> }
>;

export interface DynamicOptions {
  ssr?: boolean;
  loading?: React.ComponentType<unknown>;
}

export default function dynamic<P extends object>(
  loader: Loader<P>,
  _options?: DynamicOptions,
): React.ComponentType<P> {
  const Lazy = React.lazy(async () => {
    const mod = await loader();
    const component = (
      (mod as { default?: React.ComponentType<P> }).default ??
      (mod as React.ComponentType<P>)
    );
    return { default: component };
  });

  const DynamicComponent = (props: P) => (
    <React.Suspense fallback={null}>
      <Lazy {...props} />
    </React.Suspense>
  );
  DynamicComponent.displayName = 'DynamicComponent';
  return DynamicComponent;
}
