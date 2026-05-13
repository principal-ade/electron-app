import type { AgentConfigAPI } from './AgentConfigAPI';
import type { AlexandriaAPI } from './AlexandriaAPI';
import type { AlexandriaDocsAPI } from './AlexandriaDocsAPI';
import type { WorkspaceAPI } from './WorkspaceAPI';
import type { AgentInstallationAPI } from './AgentInstallationAPI';
import type { AgentSessionAPI } from './AgentSessionAPI';
import type { AgentSessionSDKAPI } from './AgentSessionSDKAPI';
import type { AuthenticationAPI } from './AuthenticationAPI';
import type { ClipboardAPI } from './ClipboardAPI';
import type { FileSystemAPI } from './FileSystemAPI';
import type { GitAPI } from './GitAPI';
import type { GitHubAPI } from './GitHubAPI';
import type { AppVersionManagerAPI } from './AppVersionManagerAPI';
import type { RepositoryMonitoringAPI } from '@principal-ai/repository-monitoring-server';

// Extended RepositoryMonitoringAPI with app-specific methods
export interface ExtendedRepositoryMonitoringAPI extends RepositoryMonitoringAPI {
  syncWorkspace: (repoPath: string) => Promise<{
    success: boolean;
    registeredScopes?: string[];
    error?: string;
  }>;
}
import type { SecretsAPI } from './SecretsAPI';
import type { LinksAPI } from './LinksAPI';
import type { ShellAPI } from './ShellAPI';
import type { StoreAPI } from './StoreAPI';
import type { SystemAPI } from './SystemAPI';
import type { TerminalAPI } from './TerminalService';
import type { UserPreferencesAPI } from './UserPreferencesAPI';
import type { WindowManagerAPI } from './WindowManagerAPI';
import { AgentSessionEventsAPI } from './AgentSessionEventsAPI';
import type { OrbitAPI } from './OrbitAPI';
import type { ApiProxyAPI } from './ApiProxyAPI';
import type { PackageManagerAPI } from './PackageManagerAPI';
import type { TypeExtractionAPI } from './TypeExtractionAPI';
import type { TypeSchemaAPI } from './TypeSchemaAPI';
import type { DockerAPI } from './DockerAPI';
import type { GitSyncAPI } from './GitSyncAPI';
import type { FastForwardAPI } from './FastForwardAPI';
import type { PresenceAPI } from './PresenceAPI';
import type { SSHSetupAPI } from './SSHSetupAPI';
import type { WindowAPI } from './WindowAPI';
import type { PrincipalAPI } from './PrincipalAPI';
import type { FeedbackAPI } from './FeedbackAPI';
import type { DocumentSearchAPI } from '../ipc/DocumentSearchIPC';
import type { LocalhostDetectionAPI } from './LocalhostDetectionAPI';
import type { GitHubArtifactAPI } from './GitHubArtifactAPI';
import type { RecentReposAPI } from './RecentReposAPI';
import type { SkillLockAPI } from './SkillLockAPI';
import type { OtelCollectorAPI } from './OtelCollectorAPI';
import type { CLIBridgeAPI } from './CLIBridgeAPI';
import type { ExtensionAPI } from './ExtensionAPI';
import type { FileCityImageAPI } from './FileCityImageAPI';
import type { FileCityTrailAPI } from './FileCityTrailAPI';
import type { DocumentNotesAPI } from './DocumentNotesAPI';
import type { OpenCodePromoteAPI } from './OpenCodePromoteAPI';
import type { BrunoAPI } from './BrunoAPI';

/**
 * Terminal Bridge API Interface (Remote Terminal Viewer only)
 * Used to connect the main process bridge to remote terminal sessions
 */
export interface TerminalBridgeAPI {
  connectBridge: (args: {
    token: string;
    userId: string;
    githubHandle: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

// Re-export for convenience
export type {
  AgentSessionEvent,
  AgentSessionEventsAPI,
} from './AgentSessionEventsAPI';
export { AgentSessionEventsAPIEvent } from './AgentSessionEventsAPI';
export type {
  AuthenticationAPI,
  AuthUser,
  AuthResult,
  AuthStatus,
  AuthState,
  TokenResult,
  TokenWithMetadata,
} from './AuthenticationAPI';
export interface MainProcessAPI {
  agentConfig: AgentConfigAPI;
  alexandria: AlexandriaAPI;
  alexandriaDocs: AlexandriaDocsAPI;
  workspace: WorkspaceAPI;
  agentInstallation: AgentInstallationAPI;
  agentSession: AgentSessionAPI;
  agentSessionSDK: AgentSessionSDKAPI;
  agentSessionEvents: AgentSessionEventsAPI;
  appVersionManager: AppVersionManagerAPI;
  authentication: AuthenticationAPI;
  clipboard: ClipboardAPI;
  fileSystem: FileSystemAPI;
  git: GitAPI;
  github: GitHubAPI;
  store: StoreAPI;
  repositoryMonitoring: ExtendedRepositoryMonitoringAPI;
  otelCollector: OtelCollectorAPI;
  cliBridge: CLIBridgeAPI;
  secrets: SecretsAPI;
  links: LinksAPI;
  shell: ShellAPI;
  system: SystemAPI;
  terminal: TerminalAPI;
  userPreferences: UserPreferencesAPI;
  windowManager: WindowManagerAPI;
  orbit: OrbitAPI;
  apiProxy: ApiProxyAPI;
  packageManager: PackageManagerAPI;
  typeExtraction: TypeExtractionAPI;
  typeSchema: TypeSchemaAPI;
  docker: DockerAPI;
  gitSync: GitSyncAPI;
  fastForward: FastForwardAPI;
  presence: PresenceAPI;
  sshSetup: SSHSetupAPI;
  window: WindowAPI;
  principal: PrincipalAPI;
  feedback: FeedbackAPI;
  testDebug: TestDebugAPI;
  documentSearch: DocumentSearchAPI;
  localhostDetection: LocalhostDetectionAPI;
  githubArtifact: GitHubArtifactAPI;
  recentRepos: RecentReposAPI;
  skillLock: SkillLockAPI;
  extension: ExtensionAPI;
  fileCityImage: FileCityImageAPI;
  fileCityTrail: FileCityTrailAPI;
  documentNotes: DocumentNotesAPI;
  openCodePromote: OpenCodePromoteAPI;
  bruno: BrunoAPI;
  /** Only available in Remote Terminal Viewer window */
  terminalBridge?: TerminalBridgeAPI;
}

/**
 * Test and Debug API Interface
 *
 * IMPORTANT: These are debug/test utilities and should NOT be used in production code.
 * They are only exposed to support development and debugging features.
 */
export interface TestDebugAPI {
  processEvent: (agent: string, rawEvent: unknown) => Promise<unknown>;
}
