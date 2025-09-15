import { PackageManagerApiProvider, PackageManager, PackageVersionInfo, VersionCheckResult, VulnerabilityCheckResult, LicenseCheckResult, BatchCheckOptions, DependencyCheckProgress } from "@principal-ai/codebase-composition";
/**
 * Electron implementation of PackageManagerApiProvider that uses IPC
 * to communicate with the main process for NPM registry API calls.
 * This ensures consistent behavior regardless of local package manager installations.
 */
export declare class ElectronPackageManagerApiProvider extends PackageManagerApiProvider {
    private progress;
    checkVersions(packages: PackageVersionInfo[], packageManager: PackageManager, options?: BatchCheckOptions): AsyncGenerator<VersionCheckResult, void, unknown>;
    checkVulnerabilities(packages: PackageVersionInfo[], packageManager: PackageManager, options?: BatchCheckOptions): AsyncGenerator<VulnerabilityCheckResult, void, unknown>;
    checkLicenses(packages: PackageVersionInfo[], packageManager: PackageManager, options?: BatchCheckOptions): AsyncGenerator<LicenseCheckResult, void, unknown>;
    getProgress(): DependencyCheckProgress;
}
//# sourceMappingURL=ElectronPackageManagerApiProvider.d.ts.map