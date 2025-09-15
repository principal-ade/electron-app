interface PackageVersionInfo {
    name: string;
    currentVersion: string;
}
interface VersionCheckResult {
    packageName: string;
    currentVersion: string;
    latestVersion?: string;
    updateType?: 'major' | 'minor' | 'patch' | 'none';
    isOutdated: boolean;
    isDeprecated?: boolean;
    deprecationMessage?: string;
    error?: string;
}
interface VulnerabilityInfo {
    id: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
    description?: string;
    fixAvailable?: boolean;
}
interface VulnerabilityCheckResult {
    packageName: string;
    version: string;
    vulnerabilities: VulnerabilityInfo[];
    error?: string;
}
interface LicenseInfo {
    license: string;
    licenseType: 'permissive' | 'copyleft' | 'proprietary' | 'unknown';
    requiresAttribution: boolean;
    requiresShareAlike: boolean;
    allowsCommercialUse: boolean;
}
interface LicenseCheckResult {
    packageName: string;
    version: string;
    license?: LicenseInfo;
    error?: string;
}
export declare class PackageManagerService {
    private fetchPackageInfo;
    private compareVersions;
    checkVersions(packages: PackageVersionInfo[], batchSize?: number): AsyncGenerator<VersionCheckResult, void, unknown>;
    checkVulnerabilities(packages: PackageVersionInfo[], batchSize?: number): AsyncGenerator<VulnerabilityCheckResult, void, unknown>;
    checkLicenses(packages: PackageVersionInfo[], batchSize?: number): AsyncGenerator<LicenseCheckResult, void, unknown>;
}
export {};
//# sourceMappingURL=packageManagerService.d.ts.map