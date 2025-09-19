import { SupportedAgent } from '@principal-ai/agent-monitoring';
export interface AgentVersion {
  version: string;
  releaseDate: string;
  downloadUrl: string;
  checksum?: string;
  size: number;
  releaseNotes?: string;
}

export interface AgentUpdateStatus {
  hasUpdate: boolean;
  currentVersion?: string;
  latestVersion: string;
}

export interface AgentInstallStatus {
  agentType: SupportedAgent;
  installed: boolean;
  version?: string;
  installPath?: string;
  isOurVersion: boolean;
  lastChecked: Date;
}

export type AgentInstallProgressStage =
  | 'downloading'
  | 'installing'
  | 'configuring'
  | 'completed'
  | 'error';
export interface AgentInstallProgress {
  agentType: SupportedAgent;
  stage: AgentInstallProgressStage;
  progress: number;
  message: string;
  error?: string;
}

export enum AgentInstallationEvents {
  INSTALL = 'agent:install',
  INSTALL_PROGRESS = 'agent:install-progress',
  INSTALL_COMPLETE = 'agent:install-complete',
  INSTALL_ERROR = 'agent:install-error',
  CHECK_INSTALLATION = 'agent:check-installation',
  UNINSTALL = 'agent:uninstall',
  UNINSTALL_COMPLETE = 'agent:uninstall-complete',
  CHECK_FOR_UPDATES = 'agent:check-for-updates',
  GET_AVAILABLE_VERSIONS = 'agent:get-available-versions',
  GET_LATEST_VERSION = 'agent:get-latest-version',
  UPDATE = 'agent:update',
}

export interface AgentInstallationAPI {
  // Detection
  checkInstallation: (agentType: SupportedAgent) => Promise<AgentInstallStatus>;
  //getInstalledVersion: (agentType: SupportedAgent) => Promise<string | null>;
  //isOurVersion: (agentType: SupportedAgent, path: string) => Promise<boolean>;

  // Version Management
  getAvailableVersions: (agentType: SupportedAgent) => Promise<AgentVersion[]>;
  getLatestVersion: (agentType: SupportedAgent) => Promise<AgentVersion>;
  checkForUpdates: (agentType: SupportedAgent) => Promise<AgentUpdateStatus>;

  // Installation
  install: (agentType: SupportedAgent, version?: string) => Promise<void>;
  uninstall: (agentType: SupportedAgent) => Promise<void>;
  update: (agentType: SupportedAgent) => Promise<void>;

  // Events
  onInstallProgress: (
    agentType: SupportedAgent,
    callback: (progress: AgentInstallProgress) => void,
  ) => () => void;
  onInstallComplete: (
    agentType: SupportedAgent,
    callback: (status: AgentInstallStatus) => void,
  ) => () => void;
  onInstallError: (
    agentType: SupportedAgent,
    callback: (error: string) => void,
  ) => () => void;
  onUninstallComplete: (
    agentType: SupportedAgent,
    callback: () => void,
  ) => () => void;
}
