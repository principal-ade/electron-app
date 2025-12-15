/**
 * IPC Handlers for GitHub Artifact Service
 */

import { ipcMain } from 'electron';
import {
  GitHubArtifactAPIEvent,
  type ListArtifactsRequest,
  type GetLatestMetricsRequest,
  type GetMetricsForCommitRequest,
} from '../../../shared/main-process-api-interfaces/GitHubArtifactAPI';
import { gitHubArtifactService } from '../GitHubArtifactService';

export function registerGitHubArtifactHandlers(): void {
  console.log('[GitHubArtifact] Registering IPC handlers');

  ipcMain.handle(
    GitHubArtifactAPIEvent.LIST_ARTIFACTS,
    async (_event, request: ListArtifactsRequest) => {
      console.log(
        `[GitHubArtifact] LIST_ARTIFACTS for ${request.owner}/${request.repo}`,
      );
      try {
        return await gitHubArtifactService.listQualityArtifacts(
          request.owner,
          request.repo,
          { limit: request.limit },
        );
      } catch (error) {
        console.error('[GitHubArtifact] Error listing artifacts:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    GitHubArtifactAPIEvent.GET_LATEST_METRICS,
    async (_event, request: GetLatestMetricsRequest) => {
      console.log(
        `[GitHubArtifact] GET_LATEST_METRICS for ${request.owner}/${request.repo}@${request.branch || 'main'}`,
      );
      try {
        return await gitHubArtifactService.getLatestQualityMetrics(
          request.owner,
          request.repo,
          request.branch,
        );
      } catch (error) {
        console.error('[GitHubArtifact] Error getting latest metrics:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    GitHubArtifactAPIEvent.GET_METRICS_FOR_COMMIT,
    async (_event, request: GetMetricsForCommitRequest) => {
      console.log(
        `[GitHubArtifact] GET_METRICS_FOR_COMMIT for ${request.owner}/${request.repo}@${request.commitSha}`,
      );
      try {
        return await gitHubArtifactService.getQualityMetricsForCommit(
          request.owner,
          request.repo,
          request.commitSha,
        );
      } catch (error) {
        console.error(
          '[GitHubArtifact] Error getting metrics for commit:',
          error,
        );
        throw error;
      }
    },
  );

  ipcMain.handle(GitHubArtifactAPIEvent.CLEAR_CACHE, async () => {
    console.log('[GitHubArtifact] CLEAR_CACHE');
    gitHubArtifactService.clearCache();
  });

  console.log('[GitHubArtifact] IPC handlers registered');
}
