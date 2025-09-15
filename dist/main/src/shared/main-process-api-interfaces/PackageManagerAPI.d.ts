export declare enum PackageManagerAPIEvent {
    CHECK_VERSIONS = "package-manager:check-versions",
    CHECK_VULNERABILITIES = "package-manager:check-vulnerabilities",
    CHECK_LICENSES = "package-manager:check-licenses",
    VERSION_CHECK_PROGRESS = "package-manager:version-check-progress",
    VULNERABILITY_CHECK_PROGRESS = "package-manager:vulnerability-check-progress",
    LICENSE_CHECK_PROGRESS = "package-manager:license-check-progress"
}
export interface PackageVersionInfo {
    name: string;
    currentVersion: string;
}
export interface CheckOptions {
    batchSize?: number;
    maxConcurrent?: number;
    skipCache?: boolean;
}
export type PackageManager = 'npm' | 'pnpm' | 'yarn';
export interface CheckVersionsParams {
    packages: PackageVersionInfo[];
    packageManager: PackageManager;
    options?: CheckOptions;
}
export interface VersionCheckResult {
    packageName: string;
    currentVersion: string;
    latestVersion?: string;
    updateType?: 'major' | 'minor' | 'patch' | 'none';
    isOutdated: boolean;
    error?: string;
}
export interface VulnerabilityCheckResult {
    packageName: string;
    version: string;
    vulnerabilities: Array<{
        severity: 'low' | 'moderate' | 'high' | 'critical';
        title: string;
        description?: string;
    }>;
}
export interface LicenseCheckResult {
    packageName: string;
    license?: string;
    licenseType?: 'permissive' | 'copyleft' | 'proprietary' | 'unknown';
    isCompatible?: boolean;
}
export interface CheckProgressData {
    completed: number;
    total: number;
    current?: string;
    result?: VersionCheckResult | VulnerabilityCheckResult | LicenseCheckResult;
}
export interface PackageManagerAPI {
    checkVersions: (params: CheckVersionsParams) => Promise<VersionCheckResult[]>;
    checkVulnerabilities: (params: CheckVersionsParams) => Promise<VulnerabilityCheckResult[]>;
    checkLicenses: (params: CheckVersionsParams) => Promise<LicenseCheckResult[]>;
    onVersionCheckProgress: (callback: (data: CheckProgressData) => void) => () => void;
    onVulnerabilityCheckProgress: (callback: (data: CheckProgressData) => void) => () => void;
    onLicenseCheckProgress: (callback: (data: CheckProgressData) => void) => () => void;
    removeAllListeners: () => void;
}
//# sourceMappingURL=PackageManagerAPI.d.ts.map