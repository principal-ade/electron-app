/**
 * Type-only stub for web-ade's `lib/repo-analysis/identity-cache`.
 *
 * The ported `RepoAnalysisContext` imports `IdentityByEmail` as a type only
 * (the Redis client is server-only and erased at build). This file keeps that
 * type import resolvable without pulling in the cache client.
 */

/** A blame email resolved to its GitHub account. */
export interface ResolvedIdentity {
  login: string;
  id: number;
  avatarUrl: string;
  htmlUrl: string;
  /** GitHub profile display name. Optional — absent until the profile is fetched. */
  name?: string;
}

/**
 * Lowercased-email → resolved account (or null when GitHub can't attribute it).
 * An email absent from the map was never resolved; a present `null` is a
 * confident "no account".
 */
export type IdentityByEmail = Record<string, ResolvedIdentity | null>;
