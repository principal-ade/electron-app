/**
 * GitHub Artifact API - Preload bridge implementation
 */

import { ipcRenderer } from 'electron';
import {
  GitHubArtifactAPIEvent,
  type GitHubArtifactAPI,
  type ListArtifactsRequest,
  type GetLatestMetricsRequest,
  type GetMetricsForCommitRequest,
} from '../../shared/main-process-api-interfaces/GitHubArtifactAPI';

export const githubArtifactAPI: GitHubArtifactAPI = {
  listQualityArtifacts: async (request: ListArtifactsRequest) => {
    return ipcRenderer.invoke(GitHubArtifactAPIEvent.LIST_ARTIFACTS, request);
  },

  getLatestQualityMetrics: async (request: GetLatestMetricsRequest) => {
    return ipcRenderer.invoke(
      GitHubArtifactAPIEvent.GET_LATEST_METRICS,
      request,
    );
  },

  getQualityMetricsForCommit: async (request: GetMetricsForCommitRequest) => {
    return ipcRenderer.invoke(
      GitHubArtifactAPIEvent.GET_METRICS_FOR_COMMIT,
      request,
    );
  },

  clearCache: async () => {
    return ipcRenderer.invoke(GitHubArtifactAPIEvent.CLEAR_CACHE);
  },
};
