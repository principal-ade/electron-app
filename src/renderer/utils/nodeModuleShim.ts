/**
 * Browser-build stand-in for Node's `module` built-in.
 *
 * agent-monitoring uses `createRequire` in its Node-only session readers. The
 * renderer imports browser-safe agent metadata and event helpers, not those
 * readers; fail clearly if a Node-only reader is ever called from the UI.
 */
export const createRequire = (_url: string | URL) => (specifier: string) => {
  throw new Error(
    `Node module "${specifier}" is unavailable in the renderer process`,
  );
};
