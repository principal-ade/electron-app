import type { A24zAPI } from './A24zAPI';
import type { AgentConfigAPI } from './AgentConfigAPI';
import type { AlexandriaAPI } from './AlexandriaAPI';
import type { AgentInstallationAPI } from './AgentInstallationAPI';
import type { AgentSessionAPI } from './AgentSessionAPI';
import type { AgentSessionArchiveAPI } from './AgentSessionArchiveAPI';
import type { AgentUpdateAPI } from './AgentUpdateAPI';
import type { AuthenticationAPI } from './AuthenticationAPI';
import type { ClipboardAPI } from './ClipboardAPI';
import type { FileSystemAPI } from './FileSystemAPI';
import type { GitAPI } from './GitAPI';
import type { GitWatcherAPI } from './GitWatcherAPI';
import type { GitHubAPI } from './GitHubAPI';
import type { LLMModelsAPI } from './LLMModelsAPI';
import type { AppVersionManagerAPI } from './AppVersionManagerAPI';
import type { RepositoryAPI } from './RepositoryAPI';
import type { RepositoryNotesAPI } from './RepositoryNotesAPI';
import type { SecretsAPI } from './SecretsAPI';
import type { ShellAPI } from './ShellAPI';
import type { StoreAPI } from './StoreAPI';
import type { SystemAPI } from './SystemAPI';
import type { TerminalAPI } from './TerminalService';
import type { UserPreferencesAPI } from './UserPreferencesAPI';
import type { ViolationsAPI } from './ViolationsAPI';
import type { UserPromptAPI } from './UserPromptAPI';
import type { WindowManagerAPI } from './WindowManagerAPI';
import { AgentSessionEventsAPI } from './AgentSessionEventsAPI';
import type { OrbitAPI } from './OrbitAPI';
import type { ApiProxyAPI } from './ApiProxyAPI';
import type { ExcalidrawAPI } from './ExcalidrawAPI';
import type { PackageManagerAPI } from './PackageManagerAPI';
import type { TypeExtractionAPI } from './TypeExtractionAPI';
import type { TypeSchemaAPI } from './TypeSchemaAPI';
import type { McpToolsAPI } from './McpToolsAPI';
import type { KnipAPI } from './KnipAPI';
import type { TestCoverageAPI } from './TestCoverageAPI';
import type { DockerAPI } from './DockerAPI';
import type { GitSyncAPI } from './GitSyncAPI';
import type { WindowAPI } from './WindowAPI';
import type { PlanningAPI } from './PlanningAPI';
import type { FeedbackAPI } from './FeedbackAPI';
import type { SessionViewAPI } from './SessionViewAPI';
export type { AgentSessionEvent, AgentSessionEventsAPI } from './AgentSessionEventsAPI';
export { AgentSessionEventsAPIEvent } from './AgentSessionEventsAPI';
export type { AgentUpdateAPI, AgentUpdatePreferences, UpdateCheckResult } from './AgentUpdateAPI';
export type { AuthenticationAPI, AuthUser, AuthResult, AuthStatus, AuthState, TokenResult, TokenWithMetadata } from './AuthenticationAPI';
export type { KnipAPI, KnipAnalysisResult } from './KnipAPI';
export interface MainProcessAPI {
    a24z: A24zAPI;
    agentConfig: AgentConfigAPI;
    alexandria: AlexandriaAPI;
    agentInstallation: AgentInstallationAPI;
    agentSession: AgentSessionAPI;
    agentSessionEvents: AgentSessionEventsAPI;
    agentSessionArchive: AgentSessionArchiveAPI;
    agentUpdate: AgentUpdateAPI;
    appVersionManager: AppVersionManagerAPI;
    authentication: AuthenticationAPI;
    clipboard: ClipboardAPI;
    excalidraw: ExcalidrawAPI;
    fileSystem: FileSystemAPI;
    git: GitAPI;
    gitWatcher: GitWatcherAPI;
    github: GitHubAPI;
    llmModels: LLMModelsAPI;
    store: StoreAPI;
    repository: RepositoryAPI;
    repositoryNotes: RepositoryNotesAPI;
    secrets: SecretsAPI;
    shell: ShellAPI;
    system: SystemAPI;
    terminal: TerminalAPI;
    userPreferences: UserPreferencesAPI;
    violations: ViolationsAPI;
    windowManager: WindowManagerAPI;
    userPrompt: UserPromptAPI;
    orbit: OrbitAPI;
    apiProxy: ApiProxyAPI;
    packageManager: PackageManagerAPI;
    typeExtraction: TypeExtractionAPI;
    typeSchema: TypeSchemaAPI;
    mcpTools: McpToolsAPI;
    knip: KnipAPI;
    testCoverage: TestCoverageAPI;
    docker: DockerAPI;
    gitSync: GitSyncAPI;
    window: WindowAPI;
    planning: PlanningAPI;
    feedback: FeedbackAPI;
    sessionView: SessionViewAPI;
    testDebug: TestDebugAPI;
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
//# sourceMappingURL=index.d.ts.map