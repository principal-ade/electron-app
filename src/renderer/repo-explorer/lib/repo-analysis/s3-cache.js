/**
 * Type-only stub for web-ade's `lib/repo-analysis/s3-cache`.
 *
 * The ported `RepoAnalysisContext` imports `RepoAnalysisErrorRecord` as a type
 * only (the S3/AWS code is server-only and erased at build). This file keeps
 * that type import resolvable without pulling in the AWS SDK.
 */
export {};
