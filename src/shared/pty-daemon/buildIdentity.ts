/**
 * PTY Daemon Build Identity
 *
 * The daemon outlives the app that spawned it, so after an app update (or a
 * dev rebuild) the running daemon may be executing an older bundle than the
 * one shipped with the app. Both sides describe their bundle the same way so
 * the app can tell when the daemon it found is stale.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';

export interface DaemonBuildInfo {
  /** App version the bundle was built with. Display only. */
  version: string;
  /** SHA-1 of the daemon bundle file, or null when it could not be read. */
  bundleHash: string | null;
}

export interface DaemonBuildMismatch {
  /** Build the running daemon reported, or null for a daemon that predates build reporting. */
  running: DaemonBuildInfo | null;
  /** Build this app would spawn. */
  available: DaemonBuildInfo;
}

/**
 * Hash a bundle file. Resolves null on any read error so a missing or
 * unreadable bundle degrades to "unknown" rather than failing the caller.
 */
export async function hashBundleFile(filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', () => resolve(null));
  });
}

/**
 * Decide whether a running daemon should be replaced by the available build.
 *
 * The hash is the source of truth: the version string does not change between
 * development rebuilds. A daemon that reports no build at all is treated as
 * stale, since every build that reports one is newer than it. When neither
 * side could hash its bundle there is nothing to compare, so the daemon is kept.
 */
export function describeDaemonBuildMismatch(
  running: DaemonBuildInfo | null | undefined,
  available: DaemonBuildInfo,
): DaemonBuildMismatch | null {
  if (!running) {
    return { running: null, available };
  }
  if (running.bundleHash === null && available.bundleHash === null) {
    return null;
  }
  if (running.bundleHash === available.bundleHash) {
    return null;
  }
  return { running, available };
}
