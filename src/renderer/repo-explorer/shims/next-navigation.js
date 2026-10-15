/**
 * Storybook/desktop shim for `next/navigation`.
 *
 * Provides no-op router primitives so the ported page renders outside a Next
 * app. Real navigation will route through the workspace tab intents later.
 */
export function useRouter() {
    return {
        push: (...args) => {
            console.info('[repo-explorer shim] router.push', args);
        },
        replace: (...args) => {
            console.info('[repo-explorer shim] router.replace', args);
        },
        back: () => { },
        forward: () => { },
        refresh: () => { },
        prefetch: () => { },
    };
}
export function usePathname() {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
}
export function useSearchParams() {
    return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
}
export function useParams() {
    return {};
}
export function redirect() {
    // no-op outside Next
}
export function notFound() {
    throw new Error('notFound');
}
