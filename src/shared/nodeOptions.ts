/**
 * Helpers for removing ts-node settings from an environment that is handed to
 * a child process.
 *
 * The build scripts in package.json run Node with
 *   NODE_OPTIONS="-r ts-node/register ..." TS_NODE_PROJECT=tsconfig.node.json
 * Those variables are meant for the build process only. When they leak into
 * terminals, the PTY daemon, or other spawned processes, any `node` (or `npm`,
 * `npx`) command started outside the project root dies with
 *   error TS5083: Cannot read file '<cwd>/tsconfig.node.json'
 * because TS_NODE_PROJECT is a relative path resolved against the cwd.
 */

const TS_NODE_PRELOAD_FLAGS = [
  '-r ts-node/register/transpile-only',
  '--require ts-node/register/transpile-only',
  '-r ts-node/register',
  '--require ts-node/register',
];

const TS_NODE_ENV_KEYS = [
  'TS_NODE_PROJECT',
  'TS_NODE_TRANSPILE_ONLY',
  'TS_NODE_COMPILER_OPTIONS',
  'TS_NODE_FILES',
];

/** Remove ts-node preload flags from a NODE_OPTIONS string. */
export function stripTsNodePreload(nodeOptions: string): string {
  let result = nodeOptions;
  for (const flag of TS_NODE_PRELOAD_FLAGS) {
    result = result.split(flag).join(' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Return a copy of `env` with the ts-node preload and TS_NODE_* variables
 * removed. Other Node options are preserved.
 */
export function stripTsNodeEnv<
  T extends Record<string, string | undefined>,
>(env: T): T {
  const cleaned: Record<string, string | undefined> = { ...env };

  for (const key of TS_NODE_ENV_KEYS) {
    delete cleaned[key];
  }

  const nodeOptions = cleaned.NODE_OPTIONS;
  if (typeof nodeOptions === 'string') {
    const stripped = stripTsNodePreload(nodeOptions);
    if (stripped) {
      cleaned.NODE_OPTIONS = stripped;
    } else {
      delete cleaned.NODE_OPTIONS;
    }
  }

  return cleaned as T;
}
