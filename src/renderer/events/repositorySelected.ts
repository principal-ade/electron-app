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
  };
}

export function payloadFromLocalEntry(entry: AlexandriaEntry): RepositorySelectedPayload {
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
  return { purl, github: entry.github, localEntry: entry };
}

export function payloadFromGithub(
  identity: GithubIdentityInput,
  localEntry?: AlexandriaEntry,
): RepositorySelectedPayload {
  return {
    purl: createPurl({ type: 'github', namespace: identity.owner, name: identity.name }),
    github: buildGithubMetadata(identity),
    localEntry,
  };
}

