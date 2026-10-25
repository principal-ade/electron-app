'use strict';

/**
 * Build an environment object for spawning sub-processes (npm install, etc.)
 * that live in a different working directory than the project root.
 *
 * Why: build commands in package.json export
 *   NODE_OPTIONS="-r ts-node/register ..." TS_NODE_PROJECT=tsconfig.node.json
 * When those variables are inherited by a child process started in another
 * directory (e.g. `npm install` in release/app), ts-node tries to load a
 * tsconfig that only exists in the project root and aborts the child with:
 *   TSError: error TS5083: Cannot read file '.../release/app/tsconfig.node.json'
 *
 * Stripping the ts-node preload keeps sub-directory installs independent of
 * whatever the calling shell exports.
 */

const TS_NODE_PRELOAD_FLAGS = [
  '-r ts-node/register/transpile-only',
  '--require ts-node/register/transpile-only',
  '-r ts-node/register',
  '--require ts-node/register',
];

const stripTsNodePreload = (nodeOptions) => {
  let result = nodeOptions;
  for (const flag of TS_NODE_PRELOAD_FLAGS) {
    result = result.split(flag).join(' ');
  }
  return result.replace(/\s+/g, ' ').trim();
};

/**
 * @param {Record<string, string | undefined>} [extraEnv]
 * @returns {Record<string, string | undefined>}
 */
const cleanEnv = (extraEnv = {}) => {
  const env = { ...process.env };

  if (env.NODE_OPTIONS) {
    const stripped = stripTsNodePreload(env.NODE_OPTIONS);
    if (stripped) {
      env.NODE_OPTIONS = stripped;
    } else {
      delete env.NODE_OPTIONS;
    }
  }

  delete env.TS_NODE_PROJECT;
  delete env.TS_NODE_TRANSPILE_ONLY;

  return { ...env, ...extraEnv };
};

module.exports = { cleanEnv, stripTsNodePreload };
