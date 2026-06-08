/**
 * Replace the platform home prefix with `~` so paths render compactly.
 * Matches macOS (`/Users/<name>`) and Linux (`/home/<name>`); other paths
 * (including Windows and already-tildified paths) pass through untouched.
 *
 * This is the lightweight, env-free variant used for display. When an exact
 * home directory is already known, prefer slicing against it directly so
 * non-standard home locations are handled too.
 */
export const tildifyPath = (path: string): string => {
  const mac = path.match(/^\/Users\/[^/]+/);
  if (mac) return path.replace(mac[0], '~');
  const linux = path.match(/^\/home\/[^/]+/);
  if (linux) return path.replace(linux[0], '~');
  return path;
};
