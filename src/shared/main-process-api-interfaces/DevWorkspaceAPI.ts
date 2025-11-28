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
 * - repository: Repository management and avatar loading
 */

import type { TerminalAPI } from './TerminalService';
import type { FileSystemAPI } from './FileSystemAPI';
import type { RepositoryMonitoringAPI } from './RepositoryMonitoringAPI';
import type { UserPreferencesAPI } from './UserPreferencesAPI';
import type { RepositoryAPI } from './RepositoryAPI';

export interface DevWorkspaceMainProcessAPI {
  terminal: TerminalAPI;
  fileSystem: FileSystemAPI;
  repositoryMonitoring: RepositoryMonitoringAPI;
  userPreferences: UserPreferencesAPI;
  repository: RepositoryAPI;
}

// Re-export the individual API types for convenience
export type { TerminalAPI } from './TerminalService';
export type { FileSystemAPI } from './FileSystemAPI';
export type { RepositoryMonitoringAPI } from './RepositoryMonitoringAPI';
export type { UserPreferencesAPI } from './UserPreferencesAPI';
export type { RepositoryAPI } from './RepositoryAPI';
