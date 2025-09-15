import { BaseAgentInstallationService, GitHubRelease } from './BaseAgentInstallationService';
import { AgentInstallStatus } from '../../shared/main-process-api-interfaces/AgentInstallationAPI';
export declare class GeminiInstallationService extends BaseAgentInstallationService {
    private static instance;
    private agentInfo;
    private versionFlag;
    private constructor();
    static getInstance(): GeminiInstallationService;
    protected getAssetNameForRelease(_release: GitHubRelease): string;
    protected getVersionFromBinary(binaryPath: string): Promise<string | null>;
    protected isOurVersion(installPath: string): Promise<boolean>;
    protected createWrapperScript(version: string, bundlePath: string): Promise<string>;
    protected postInstallSetup(versionPath: string, version: string): Promise<void>;
    protected cleanAgentSpecificConfigs(): Promise<void>;
    checkInstallation(): Promise<AgentInstallStatus>;
}
//# sourceMappingURL=GeminiInstallationService.d.ts.map