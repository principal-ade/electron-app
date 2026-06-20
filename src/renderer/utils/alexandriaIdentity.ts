import {
  createPurl,
  extractPurlFromRemoteUrl,
} from '@principal-ai/alexandria-core-library';
import type {
  AlexandriaEntry,
  Purl,
} from '@principal-ai/alexandria-core-library';

export function githubRepoPurl(owner: string, name: string): Purl {
  return createPurl({ type: 'github', namespace: owner, name });
}

// Checks entry.purl / entry.github?.purl first, then derives from remoteUrl
// so entries written before alexandria-core-library 0.4.0 (when purl became
// the canonical identity) still resolve.
export function entryMatchesPurl(entry: AlexandriaEntry, purl: Purl): boolean {
  if (entry.purl === purl) return true;
  if (entry.github?.purl === purl) return true;
  if (entry.remoteUrl && extractPurlFromRemoteUrl(entry.remoteUrl) === purl) {
    return true;
  }
  return false;
}

export function findEntryByPurl(
  entries: readonly AlexandriaEntry[],
  purl: Purl,
): AlexandriaEntry | undefined {
  return entries.find((entry) => entryMatchesPurl(entry, purl));
}

// Returns every entry that shares this purl. Clones are stored as separate
// path-keyed entries, so a repo cloned into N directories yields N matches —
// use this (not the singular `findEntryByPurl`) when listing all clones.
export function findEntriesByPurl(
  entries: readonly AlexandriaEntry[],
  purl: Purl,
): AlexandriaEntry[] {
  return entries.filter((entry) => entryMatchesPurl(entry, purl));
}

export function findClonedGithubEntry(
  entries: readonly AlexandriaEntry[],
  owner: string,
  name: string,
): AlexandriaEntry | undefined {
  return findEntryByPurl(entries, githubRepoPurl(owner, name));
}
