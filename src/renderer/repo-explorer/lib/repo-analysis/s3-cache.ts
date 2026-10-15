/**
 * Type-only stub for web-ade's `lib/repo-analysis/s3-cache`.
 *
 * The ported `RepoAnalysisContext` imports `RepoAnalysisErrorRecord` as a type
 * only (the S3/AWS code is server-only and erased at build). This file keeps
 * that type import resolvable without pulling in the AWS SDK.
 */

/** A persisted analysis failure. `stage` names the step that broke. */
export interface RepoAnalysisErrorRecord {
  owner: string;
  repo: string;
  stage: string;
  message: string;
  failedAt: string;
  /** When the VM job started (ISO). Optional: pre-tracking records lack it. */
  startedAt?: string;
  /** Wall-clock from job start to failure, ms. Optional for the same reason. */
  durationMs?: number;
}
