/**
 * GitHub Artifact Service - Renderer process API
 * Fetches quality metrics from GitHub Actions artifacts
 */

import type {
  ArtifactInfo,
  QualityArtifactResponse,
} from '../../shared/main-process-api-interfaces/GitHubArtifactAPI';

export class GitHubArtifactService {
  /**
   * List quality lens artifacts for a repository
   */
  static async listQualityArtifacts(
    owner: string,
    repo: string,
    limit?: number,
  ): Promise<ArtifactInfo[]> {
    try {
      return await window.mainProcess.githubArtifact.listQualityArtifacts({
        owner,
        repo,
        limit,
      });
    } catch (error) {
      console.error('[GitHubArtifactService] Error listing artifacts:', error);
      return [];
    }
  }

  /**
   * Get quality metrics for the latest commit on a branch
   */
  static async getLatestQualityMetrics(
    owner: string,
    repo: string,
    branch?: string,
  ): Promise<QualityArtifactResponse | null> {
    try {
      return await window.mainProcess.githubArtifact.getLatestQualityMetrics({
        owner,
        repo,
        branch,
      });
    } catch (error) {
      console.error(
        '[GitHubArtifactService] Error getting latest metrics:',
        error,
      );
      return null;
    }
  }

  /**
   * Get quality metrics for a specific commit
   */
  static async getQualityMetricsForCommit(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<QualityArtifactResponse | null> {
    try {
      return await window.mainProcess.githubArtifact.getQualityMetricsForCommit(
        {
          owner,
          repo,
          commitSha,
        },
      );
    } catch (error) {
      console.error(
        '[GitHubArtifactService] Error getting metrics for commit:',
        error,
      );
      return null;
    }
  }

  /**
   * Clear the artifact cache
   */
  static async clearCache(): Promise<void> {
    try {
      await window.mainProcess.githubArtifact.clearCache();
    } catch (error) {
      console.error('[GitHubArtifactService] Error clearing cache:', error);
    }
  }
}
