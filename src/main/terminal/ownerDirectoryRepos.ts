/**
 * ownerDirectoryRepos
 *
 * When a terminal opens in a folder that is not itself a git checkout, the
 * folder may be an owner directory (`~/Developer/acme`) holding one checkout
 * per child. Working from there — cloning, pulling across repos, running a
 * script over all of them — is as strong a signal as sitting inside a single
 * repo, so the terminal watches every repo the folder holds.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Git checkouts that are immediate children of `directory`. Hidden folders
 * are skipped (tool caches, scratch dirs). Returns `[]` for an unreadable
 * directory rather than throwing: this runs on the terminal-open path and
 * must never block a session.
 */
export function findChildRepositories(directory: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const repos: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const childPath = path.join(directory, entry.name);
    try {
      if (fs.existsSync(path.join(childPath, '.git'))) {
        repos.push(childPath);
      }
    } catch {
      // Unreadable child — not a repo we can watch.
    }
  }
  return repos.sort();
}
