/**
 * Canonical repository PURL derivation, shared by the workspace↔topic sync
 * (which writes PURLs into {@link Topic.repos}) and the dev-workspace Topics
 * panel filter (which resolves the window's repo to a PURL and matches it
 * against those `repos`). Routing both through one function guarantees the two
 * derivations produce identical strings, so "This repo" actually matches what
 * the sync wrote.
 *
 * The form mirrors `WorkspaceMembership.repositoryId`: the alexandria
 * WorkspaceManager stores `repository.purl ?? repository.github?.purl ??
 * createLocalRepoPurl(path)`, and an {@link AlexandriaEntry}'s `purl` is
 * auto-generated from its `remoteUrl`. So a github repo is
 * `pkg:github/owner/repo`; a local-only repo is `pkg:generic/local/<path>`.
 */

import {
  createLocalRepoPurl,
  parsePurl,
  type AlexandriaEntry,
  type Purl,
} from '@principal-ai/alexandria-core-library';

/**
 * PURL for an {@link AlexandriaEntry} or an already-minted {@link Purl} — the
 * input the workspace membership API takes, and the registry entry the Topics
 * panel resolves the window's repo path to. Replicates the WorkspaceManager's
 * `getRepositoryId`, so the value written into a topic's `repos` is exactly the
 * one stored as the membership `repositoryId`.
 */
export function repoPurlFromEntry(
  repository: AlexandriaEntry | Purl,
): Purl | null {
  if (typeof repository === 'string') return repository;
  if (repository.purl) return repository.purl;
  if (repository.github?.purl) return repository.github.purl;
  return repository.path ? createLocalRepoPurl(repository.path) : null;
}

/**
 * Short display name for a repo PURL — its trailing segment. A provider PURL
 * names the repo directly (`pkg:github/acme/web` → `web`); a local PURL encodes
 * the whole filesystem path (`pkg:generic/local/Users-me-dev-my-app`), so the
 * name is the final dash-delimited segment. That encoding flattens `/` and `-`
 * to the same character, so a hyphenated folder name (`my-app`) is
 * unrecoverable and reads as its last fragment (`app`) — pre-existing behavior
 * shared with the topic projects rail. Mirrors the owner/name split the rail and
 * repo cards use, so a topic's repos read the same wherever they surface. Falls
 * back to the raw string when the PURL can't be parsed.
 */
export function repoDisplayNameFromPurl(purl: string): string {
  const parsed = parsePurl(purl);
  if (!parsed) return purl;
  if (parsed.namespace && parsed.namespace !== 'local') return parsed.name;
  const segments = parsed.name.split('-').filter(Boolean);
  return segments[segments.length - 1] || parsed.name;
}

/**
 * One-line label for a topic's declared repos, e.g. `web, api, +2 more`.
 * Returns null when there's nothing to show, so callers can omit the whole
 * segment. `max` caps how many names appear inline; the rest collapse into
 * `+N more`.
 */
export function repoDisplayLabel(
  repos: string[] | undefined,
  max = 3,
): string | null {
  const names = (repos ?? []).map(repoDisplayNameFromPurl).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')}, +${names.length - max} more`;
}
