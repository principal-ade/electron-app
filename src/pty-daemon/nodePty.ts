/**
 * node-pty loading for the PTY daemon.
 *
 * node-pty rewrites `app.asar` to `app.asar.unpacked` when it derives the path
 * to its `spawn-helper` binary. The daemon bundle itself is unpacked from asar
 * so it can run as a subprocess, which means a bare `require('node-pty')`
 * resolves to the already-unpacked copy. node-pty then rewrites that path into
 * `.../app.asar.unpacked.unpacked/...`, which does not exist, and every PTY
 * spawn fails with `posix_spawnp failed`.
 *
 * Loading node-pty through the asar path keeps its `__dirname` inside
 * `app.asar`, so the rewrite lands on the real unpacked helper.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface NodePtyResolutionOptions {
  /** Electron's `process.resourcesPath`; undefined outside a packaged app. */
  resourcesPath?: string;
  /** Existence check, injectable for tests. */
  fileExists?: (filePath: string) => boolean;
}

export function resolveNodePtyModule({
  resourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath,
  fileExists = fs.existsSync,
}: NodePtyResolutionOptions = {}): string {
  if (resourcesPath) {
    const asarModule = path.join(
      resourcesPath,
      'app.asar',
      'node_modules',
      'node-pty',
    );
    if (fileExists(asarModule)) {
      return asarModule;
    }
  }

  return 'node-pty';
}
