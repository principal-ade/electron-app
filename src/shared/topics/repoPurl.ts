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
export function repoPurlFromEntry(repository: AlexandriaEntry | Purl): Purl | null {
  if (typeof repository === 'string') return repository;
  if (repository.purl) return repository.purl;
  if (repository.github?.purl) return repository.github.purl;
  return repository.path ? createLocalRepoPurl(repository.path) : null;
}