/**
 * Local skill folder hashing
 *
 * Computes git blob SHAs for the files a skill actually has on disk, so update
 * detection can compare on-disk content against what the source repo currently
 * serves (via the GitHub Trees API) — rather than trusting the recorded lock
 * hash, which a past no-op "Update" could advance without re-downloading files.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

/** OS/editor files that appear inside skill folders but never exist in git. */
const IGNORED_LOCAL_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/**
 * Compute the git blob SHA-1 for a file's bytes.
 * Git hashes `"blob <byteLength>\0" + content`.
 */
export function gitBlobSha(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`, 'utf-8');
  return createHash('sha1').update(Buffer.concat([header, content])).digest('hex');
}

/**
 * Recursively read a skill folder and return a map of
 * path-relative-to-the-folder -> git blob SHA.
 *
 * Returns null when the folder does not exist (or is not a directory), which
 * callers treat as "needs reinstall". Ignores OS cruft and any nested `.git`.
 */
export async function readLocalSkillBlobs(dir: string): Promise<Map<string, string> | null> {
  let rootStat;
  try {
    rootStat = await fs.stat(dir);
  } catch {
    return null;
  }
  if (!rootStat.isDirectory()) {
    return null;
  }

  const blobs = new Map<string, string>();

  async function walk(current: string, relPrefix: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile()) {
        if (IGNORED_LOCAL_FILES.has(entry.name)) continue;
        const content = await fs.readFile(full);
        blobs.set(rel, gitBlobSha(content));
      }
      // Symlinks and other non-regular files are intentionally skipped.
    }
  }

  await walk(dir, '');
  return blobs;
}

/** True when two blob maps have identical paths and SHAs. */
export function blobMapsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false;
  }
  return true;
}
