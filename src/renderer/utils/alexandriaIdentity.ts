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
export function findEntryByPurl(
  entries: readonly AlexandriaEntry[],
  purl: Purl,
): AlexandriaEntry | undefined {
  return entries.find((entry) => {
    if (entry.purl === purl) return true;
    if (entry.github?.purl === purl) return true;
    if (entry.remoteUrl && extractPurlFromRemoteUrl(entry.remoteUrl) === purl) {
      return true;
    }
    return false;
  });
}

export function findClonedGithubEntry(
  entries: readonly AlexandriaEntry[],
  owner: string,
  name: string,
): AlexandriaEntry | undefined {
  return findEntryByPurl(entries, githubRepoPurl(owner, name));
}
