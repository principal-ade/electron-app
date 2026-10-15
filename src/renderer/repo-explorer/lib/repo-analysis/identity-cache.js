/**
 * Type-only stub for web-ade's `lib/repo-analysis/identity-cache`.
 *
 * The ported `RepoAnalysisContext` imports `IdentityByEmail` as a type only
 * (the Redis client is server-only and erased at build). This file keeps that
 * type import resolvable without pulling in the cache client.
 */
export {};
