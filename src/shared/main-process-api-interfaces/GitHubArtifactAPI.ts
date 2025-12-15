/**
 * GitHub Artifact API - IPC events and interfaces for quality metrics artifacts
 */

import type { QualityHexagonMetrics } from '@principal-ai/codebase-quality-lenses';

/**
 * IPC events for GitHub artifact operations
 */
export enum GitHubArtifactAPIEvent {
  LIST_ARTIFACTS = 'github-artifact:list',
  GET_LATEST_METRICS = 'github-artifact:get-latest',
  GET_METRICS_FOR_COMMIT = 'github-artifact:get-for-commit',
  CLEAR_CACHE = 'github-artifact:clear-cache',
}

/**
 * Artifact info returned when listing
 */
export interface ArtifactInfo {
  id: number;
  name: string;
  size_in_bytes: number;
  created_at: string;
  expires_at: string;
  commitSha: string | null;
}

/**
 * Per-file quality metric from a lens
 */
export interface FileMetricData {
  file: string;
  score: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
  fixableCount?: number;
  categories?: Record<string, number>;
}

/**
 * Per-package quality metrics (from CLI output)
 */
export interface PackageQualityMetrics {
  name: string;
  path?: string;
  hexagon: QualityHexagonMetrics;
}

/**
 * Response shape for the API
 */
export interface QualityArtifactResponse {
  commitSha: string;
  branch: string;
  timestamp: string;
  qualityMetrics: {
    /** Per-package hexagons for monorepo support */
    packages: PackageQualityMetrics[];
  };
  /** Per-file coverage percentages from Jest (path -> line coverage %) */
  fileCoverage?: Record<string, number>;
  /** Per-file quality metrics from all lenses, keyed by lens name */
  fileMetrics?: {
    eslint?: FileMetricData[];
    typescript?: FileMetricData[];
    prettier?: FileMetricData[];
    knip?: FileMetricData[];
    alexandria?: FileMetricData[];
  };
  artifactId: number;
  artifactName: string;
}

/**
 * Request to list artifacts
 */
export interface ListArtifactsRequest {
  owner: string;
  repo: string;
  limit?: number;
}

/**
 * Request to get latest metrics
 */
export interface GetLatestMetricsRequest {
  owner: string;
  repo: string;
  branch?: string;
}

/**
 * Request to get metrics for a specific commit
 */
export interface GetMetricsForCommitRequest {
  owner: string;
  repo: string;
  commitSha: string;
}

/**
 * GitHub Artifact API interface for renderer process
 */
export interface GitHubArtifactAPI {
  listQualityArtifacts(request: ListArtifactsRequest): Promise<ArtifactInfo[]>;
  getLatestQualityMetrics(
    request: GetLatestMetricsRequest,
  ): Promise<QualityArtifactResponse | null>;
  getQualityMetricsForCommit(
    request: GetMetricsForCommitRequest,
  ): Promise<QualityArtifactResponse | null>;
  clearCache(): Promise<void>;
}
