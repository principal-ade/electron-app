/**
 * Storybook/desktop shim for `next/navigation`.
 *
 * Provides no-op router primitives so the ported page renders outside a Next
 * app. Real navigation will route through the workspace tab intents later.
 */

import { navigate } from './navigation';

export interface AppRouterInstance {
  push: (...args: unknown[]) => void;
  replace: (...args: unknown[]) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (...args: unknown[]) => void;
}

export function useRouter(): AppRouterInstance {
  return {
    push: (href: unknown) => {
      if (typeof href === 'string' && navigate(href)) return;
      console.info('[repo-explorer shim] router.push', href);
    },
    replace: (href: unknown) => {
      if (typeof href === 'string' && navigate(href)) return;
      console.info('[repo-explorer shim] router.replace', href);
    },
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  };
}

export function usePathname(): string {
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  );
}

export function useParams(): Record<string, string> {
  return {};
}

export function redirect(): void {
  // no-op outside Next
}

export function notFound(): never {
  throw new Error('notFound');
}
