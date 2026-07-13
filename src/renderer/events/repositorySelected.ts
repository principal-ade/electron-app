import {
  createPurl,
  extractPurlFromRemoteUrl,
} from '@principal-ai/alexandria-core-library';
import type {
  AlexandriaEntry,
  GithubRepository,
  Purl,
} from '@principal-ai/alexandria-core-library';

export interface RepositorySelectedPayload {
  /** Canonical identity. Always present. */
  purl: Purl;
  /** GitHub display metadata, when known. Independent of clone state. */
  github?: GithubRepository;
  /** The registered local entry, when this repo is cloned. */
  localEntry?: AlexandriaEntry;
  /** All local clones of this repository (deduped by path). */
  localClones?: Array<{ path: string; addedAt: number }>;
}

export interface GithubIdentityInput {
  owner: string;
  name: string;
  description?: string;
  stars?: number;
  primaryLanguage?: string;
  topics?: string[];
  isPublic?: boolean;
  defaultBranch?: string;
  lastUpdated?: string;
  /** ISO timestamp when the repository was created on GitHub. */
  createdAt?: string;
}

export function buildGithubMetadata(input: GithubIdentityInput): GithubRepository {
  return {
    id: `${input.owner}/${input.name}`,
    owner: input.owner,
    name: input.name,
    description: input.description,
    stars: input.stars ?? 0,
    primaryLanguage: input.primaryLanguage,
    topics: input.topics,
    isPublic: input.isPublic,
    defaultBranch: input.defaultBranch,
    lastUpdated: input.lastUpdated ?? new Date().toISOString(),
    createdAt: input.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Local-clone extraction (renderer-side extension on AlexandriaEntry)
// ---------------------------------------------------------------------------

/** Shape of the renderer-side `localClones` extension on AlexandriaEntry. */
interface LocalClone {
  path: string;
  addedAt: number;
}

/**
 * Read the renderer-side `localClones` array from an entry, falling back to
 * a single-clone array derived from `entry.path` when the extension is absent.
 */
function extractLocalClones(entry: AlexandriaEntry): LocalClone[] | undefined {
  const maybeClones = (entry as { localClones?: unknown }).localClones;
  if (Array.isArray(maybeClones)) return maybeClones as LocalClone[];
  return entry.path ? [{ path: entry.path, addedAt: Date.now() }] : undefined;
}

/**
 * Aggregate local clones across every entry that shares a repo's purl,
 * deduped by path. Returns undefined when nothing is local.
 */
export function collectLocalClones(
  entries: readonly AlexandriaEntry[],
): LocalClone[] | undefined {
  const byPath = new Map<string, LocalClone>();
  for (const entry of entries) {
    const clones = extractLocalClones(entry);
    if (!clones) continue;
    for (const clone of clones) {
      const existing = byPath.get(clone.path);
      if (!existing || clone.addedAt < existing.addedAt) {
        byPath.set(clone.path, clone);
      }
    }
  }
  if (byPath.size === 0) return undefined;
  return Array.from(byPath.values()).sort(
    (a, b) => a.addedAt - b.addedAt || a.path.localeCompare(b.path),
  );
}

export function payloadFromLocalEntry(
  entry: AlexandriaEntry,
  allMatchingEntries?: readonly AlexandriaEntry[],
): RepositorySelectedPayload {
  const purl =
    entry.purl ??
    entry.github?.purl ??
    (entry.remoteUrl ? extractPurlFromRemoteUrl(entry.remoteUrl) : null) ??
    (entry.github
      ? createPurl({ type: 'github', namespace: entry.github.owner, name: entry.github.name })
      : null);
  if (!purl) {
    throw new Error(
      `payloadFromLocalEntry: cannot derive purl for entry at ${String(entry.path)}`,
    );
  }
  const localClones = allMatchingEntries
    ? collectLocalClones(allMatchingEntries)
    : extractLocalClones(entry);
  return { purl, github: entry.github, localEntry: entry, localClones };
}

export function payloadFromGithub(
  identity: GithubIdentityInput,
  localEntry?: AlexandriaEntry,
  allMatchingEntries?: readonly AlexandriaEntry[],
): RepositorySelectedPayload {
  const localClones = allMatchingEntries
    ? collectLocalClones(allMatchingEntries)
    : localEntry
      ? extractLocalClones(localEntry)
      : undefined;
  return {
    purl: createPurl({ type: 'github', namespace: identity.owner, name: identity.name }),
    github: buildGithubMetadata(identity),
    localEntry,
    localClones,
  };
}

