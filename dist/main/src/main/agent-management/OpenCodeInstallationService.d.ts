import { BaseAgentInstallationService, GitHubRelease } from './BaseAgentInstallationService';
interface OpenCodeHook {
    id: string;
    [key: string]: unknown;
}
interface OpenCodeConfig {
    hooks?: OpenCodeHook[];
    [key: string]: unknown;
}
export declare class OpenCodeInstallationService extends BaseAgentInstallationService {
    private static instance;
    private agentInfo;
    private constructor();
    static getInstance(): OpenCodeInstallationService;
    protected getAssetNameForRelease(release: GitHubRelease): string | undefined;
    protected getVersionFromBinary(binaryPath: string): Promise<string | null>;
    protected isOurVersion(installPath: string): Promise<boolean>;
    protected postInstallSetup(versionPath: string, _version: string): Promise<void>;
    protected cleanAgentSpecificConfigs(): Promise<void>;
    installOpenCode(version?: string): Promise<void>;
    uninstallOpenCode(): Promise<void>;
    updateOpenCode(): Promise<void>;
    isOurOpenCodeVersion(installPath: string): Promise<boolean>;
    getOpenCodeConfig(): Promise<OpenCodeConfig>;
    private expandHomePath;
    updateOpenCodeConfig(newConfig: OpenCodeConfig): Promise<void>;
    testOpenCodeConnection(): Promise<{
        success: boolean;
        message: string;
    }>;
    private isObject;
    private deepMerge;
}
export {};
//# sourceMappingURL=OpenCodeInstallationService.d.ts.map