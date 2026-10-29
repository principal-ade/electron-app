/**
 * ownerDirectories
 *
 * Reconstructs the "owner directories" shown in Quick Open: the folders that
 * hold an owner's checkouts (`~/Developer/acme`, `~/Developer/principal-ade`).
 *
 * Clones are registered one entry per checkout, so the folders are derived from
 * each entry's parent path. A folder only counts as an owner directory when its
 * name matches the GitHub owner of the clones inside it — the layout the clone
 * flow writes (`<base>/<owner>/<repo>`, see `joinClonePath` in GitCloneModal).
 * Flat clone roots, shared folders and agent/temp scratch dirs are not owner
 * folders, so they're left to the Clones list.
 *
 * Selecting an owner directory opens a terminal rooted there, ready to clone a
 * sibling repo into it.
 */

import os from 'node:os';
import path from 'node:path';

/** The slice of a registry entry this needs. */
export interface OwnerDirectorySource {
  path?: string | null;
  github?: { owner?: string | null } | null;
}

export interface CloneOwnerDirectory {
  /** Folder the checkouts live in. */
  directory: string;
  /** Owner login the folder is named after (drives the label). */
  label: string;
  /** GitHub owner login — drives the avatar. */
  ownerLogin: string;
  /** How many registered clones live directly in this folder. */
  cloneCount: number;
}

/** Temp/scratch locations and hidden paths are never owner directories. */
function isScratchDirectory(directory: string): boolean {
  const tmp = os.tmpdir();
  if (
    directory === tmp ||
    directory.startsWith(`${tmp}${path.sep}`) ||
    directory.startsWith('/var/folders/') ||
    directory.startsWith('/private/var/folders/') ||
    directory.startsWith('/tmp/')
  ) {
    return true;
  }

  // Hidden segments mean tool caches and agent scratch dirs (`.local`,
  // `.codex/.tmp`, …), not a developer's checkout folder.
  return path
    .normalize(directory)
    .split(path.sep)
    .some((segment) => segment.length > 1 && segment.startsWith('.'));
}

/**
 * Group registered clones by their parent folder, keeping only folders named
 * after the GitHub owner they contain. Sorted by clone count (so the busiest
 * owner comes first), then by label. Never throws, never touches disk.
 */
export function collectOwnerDirectories(
  repositories: ReadonlyArray<OwnerDirectorySource>,
): CloneOwnerDirectory[] {
  const byDirectory = new Map<
    string,
    { owners: Map<string, string>; count: number }
  >();

  for (const repo of repositories) {
    if (!repo.path) continue;

    const directory = path.dirname(repo.path);
    // Skip root-level checkouts and temp/scratch locations.
    if (
      directory === repo.path ||
      directory === path.dirname(directory) ||
      isScratchDirectory(directory)
    ) {
      continue;
    }

    let bucket = byDirectory.get(directory);
    if (!bucket) {
      bucket = { owners: new Map(), count: 0 };
      byDirectory.set(directory, bucket);
    }
    bucket.count += 1;

    // GitHub logins are case-insensitive; keep the first spelling seen.
    const owner = repo.github?.owner?.trim();
    if (owner && !bucket.owners.has(owner.toLowerCase())) {
      bucket.owners.set(owner.toLowerCase(), owner);
    }
  }

  const directories: CloneOwnerDirectory[] = [];
  for (const [directory, { owners, count }] of byDirectory) {
    // The folder must be named after an owner it holds, otherwise it isn't an
    // owner directory (flat clone root, shared dir, stray checkout).
    const folderName = path.basename(directory);
    const ownerLogin = owners.get(folderName.toLowerCase());
    if (!ownerLogin) continue;
    directories.push({
      directory,
      // Label with the folder's own casing (what's on disk); the avatar uses
      // the login GitHub returned.
      label: folderName,
      ownerLogin,
      cloneCount: count,
    });
  }

  return directories.sort(
    (a, b) =>
      b.cloneCount - a.cloneCount ||
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
}
