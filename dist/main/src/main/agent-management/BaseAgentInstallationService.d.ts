import { RequestInit } from 'node-fetch';
import { AgentInfo, SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentInstallProgress, AgentInstallStatus, AgentVersion } from '../../shared/main-process-api-interfaces/AgentInstallationAPI';
export interface GitHubAsset {
    name: string;
    browser_download_url: string;
    size: number;
}
export interface GitHubRelease {
    tag_name: string;
    name: string;
    body: string;
    created_at: string;
    published_at: string;
    assets: GitHubAsset[];
}
export declare abstract class BaseAgentInstallationService {
    protected agentType: SupportedAgent;
    protected binaryName: string;
    protected githubRepo: string;
    protected installPath: string;
    protected versionsPath: string;
    protected currentSymlink: string;
    protected binPath: string;
    protected progressCallback?: (progress: AgentInstallProgress) => void;
    constructor(agentType: SupportedAgent, agentInfo: AgentInfo);
    protected abstract getAssetNameForRelease(release: GitHubRelease): string | undefined;
    protected abstract getVersionFromBinary(binaryPath: string): Promise<string | null>;
    protected abstract isOurVersion(installPath: string): Promise<boolean>;
    protected createWrapperScript?(version: string, bundlePath: string): Promise<string>;
    protected postInstallSetup?(versionPath: string, version: string): Promise<void>;
    protected cleanAgentSpecificConfigs?(): Promise<void>;
    checkInstallation(): Promise<AgentInstallStatus>;
    getInstalledVersion(): Promise<string | null>;
    getAvailableVersions(): Promise<AgentVersion[]>;
    getLatestVersion(): Promise<AgentVersion>;
    checkForUpdates(): Promise<{
        hasUpdate: boolean;
        currentVersion?: string;
        latestVersion: string;
    }>;
    install(version?: string): Promise<void>;
    uninstall(): Promise<void>;
    update(): Promise<void>;
    setProgressCallback(callback: (progress: AgentInstallProgress) => void): void;
    protected fetchWithFallback(url: string, options?: RequestInit): Promise<Response>;
    protected reportProgress(progress: AgentInstallProgress): void;
    protected compareVersions(v1: string, v2: string): number;
    protected extractChecksumFromRelease(release: GitHubRelease): string | undefined;
    protected downloadFile(url: string, destination: string, onProgress?: (progress: number) => void): Promise<void>;
    protected calculateChecksum(filePath: string): Promise<string>;
    protected ensureInPath(binPath: string): Promise<void>;
    protected cleanShellConfigs(): Promise<void>;
}
//# sourceMappingURL=BaseAgentInstallationService.d.ts.map