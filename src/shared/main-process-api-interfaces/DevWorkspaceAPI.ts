/**
 * Minimal API interface for the dev-workspace window.
 *
 * This is a strict subset of MainProcessAPI - it only includes the APIs
 * required by the panel framework. When adding new APIs to the dev-workspace
 * preload, add them here first.
 *
 * Current APIs:
 * - terminal: Terminal session management (MessagePort-based data streaming)
 * - fileSystem: File read/write operations
 * - repositoryMonitoring: Git status and file tree
 * - userPreferences: User settings and preferences
 * - shell: Shell operations (opening external URLs, etc.)
 * - window: Window management (opening repo-manager, etc.)
 * - alexandria: Alexandria repository registry events
 */

import type { TerminalAPI } from './TerminalService';
import type { FileSystemAPI } from './FileSystemAPI';
import type { RepositoryMonitoringAPI } from '@principal-ai/repository-monitoring-server';
import type { UserPreferencesAPI } from './UserPreferencesAPI';
import type { ShellAPI } from './ShellAPI';
import type { WindowAPI } from './WindowAPI';
import type { AlexandriaAPI } from './AlexandriaAPI';
import type { GitSyncAPI } from './GitSyncAPI';
import type { AuthenticationAPI } from './AuthenticationAPI';
import type { AgentSessionSDKAPI } from './AgentSessionSDKAPI';
import type { GitHubArtifactAPI } from './GitHubArtifactAPI';
import type { LocalhostDetectionAPI } from './LocalhostDetectionAPI';
import type { OtelCollectorAPI } from './OtelCollectorAPI';
import type { GitAPI } from './GitAPI';
import type { FileCityImageAPI } from './FileCityImageAPI';
import type { SkillLockAPI } from './SkillLockAPI';

export interface DevWorkspaceMainProcessAPI {
  terminal: TerminalAPI;
  fileSystem: FileSystemAPI;
  repositoryMonitoring: RepositoryMonitoringAPI;
  userPreferences: UserPreferencesAPI;
  shell: ShellAPI;
  window: WindowAPI;
  alexandria: AlexandriaAPI;
  gitSync: GitSyncAPI;
  authentication: AuthenticationAPI;
  agentSessionSDK: AgentSessionSDKAPI;
  githubArtifact: GitHubArtifactAPI;
  localhostDetection: LocalhostDetectionAPI;
  otelCollector: OtelCollectorAPI;
  git: GitAPI;
  fileCityImage: FileCityImageAPI;
  skillLock: SkillLockAPI;
}

// Re-export the individual API types for convenience
export type { TerminalAPI } from './TerminalService';
export type { FileSystemAPI } from './FileSystemAPI';
export type { RepositoryMonitoringAPI } from '@principal-ai/repository-monitoring-server';
export type { UserPreferencesAPI } from './UserPreferencesAPI';
export type { ShellAPI } from './ShellAPI';
export type { WindowAPI } from './WindowAPI';
export type { AlexandriaAPI } from './AlexandriaAPI';
export type { GitSyncAPI } from './GitSyncAPI';
export type { AuthenticationAPI } from './AuthenticationAPI';
export type { AgentSessionSDKAPI } from './AgentSessionSDKAPI';
export type { GitHubArtifactAPI } from './GitHubArtifactAPI';
export type { LocalhostDetectionAPI } from './LocalhostDetectionAPI';
export type { OtelCollectorAPI } from './OtelCollectorAPI';
export type { GitAPI } from './GitAPI';
export type { FileCityImageAPI } from './FileCityImageAPI';
export type { SkillLockAPI } from './SkillLockAPI';
