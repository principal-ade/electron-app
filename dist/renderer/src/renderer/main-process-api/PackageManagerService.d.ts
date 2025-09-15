/**
 * Service layer for Package Manager functionality
 * ALL window.mainProcess.packageManager calls MUST be encapsulated here
 */
import { PackageVersionInfo, PackageManager, CheckOptions, VersionCheckResult, VulnerabilityCheckResult, LicenseCheckResult, CheckProgressData } from '../../shared/main-process-api-interfaces/PackageManagerAPI';
export declare class PackageManagerService {
    /**
     * Check package versions
     */
    static checkVersions(packages: PackageVersionInfo[], packageManager: PackageManager, options?: CheckOptions): Promise<VersionCheckResult[]>;
    /**
     * Invoke check versions (async operation)
     */
    static invokeCheckVersions(params: {
        packages: PackageVersionInfo[];
        packageManager: PackageManager;
        options?: CheckOptions;
    }): Promise<VersionCheckResult[]>;
    /**
     * Check for vulnerabilities
     */
    static checkVulnerabilities(packages: PackageVersionInfo[], packageManager: PackageManager, options?: CheckOptions): Promise<VulnerabilityCheckResult[]>;
    /**
     * Invoke vulnerability check (async operation)
     */
    static invokeCheckVulnerabilities(params: {
        packages: PackageVersionInfo[];
        packageManager: PackageManager;
        options?: CheckOptions;
    }): Promise<VulnerabilityCheckResult[]>;
    /**
     * Check licenses
     */
    static checkLicenses(packages: PackageVersionInfo[], packageManager: PackageManager, options?: CheckOptions): Promise<LicenseCheckResult[]>;
    /**
     * Invoke license check (async operation)
     */
    static invokeCheckLicenses(params: {
        packages: PackageVersionInfo[];
        packageManager: PackageManager;
        options?: CheckOptions;
    }): Promise<LicenseCheckResult[]>;
    /**
     * Subscribe to version check progress
     * @returns Unsubscribe function
     */
    static onVersionCheckProgress(callback: (data: CheckProgressData) => void): () => void;
    /**
     * Subscribe to vulnerability check progress
     * @returns Unsubscribe function
     */
    static onVulnerabilityCheckProgress(callback: (data: CheckProgressData) => void): () => void;
    /**
     * Subscribe to license check progress
     * @returns Unsubscribe function
     */
    static onLicenseCheckProgress(callback: (data: CheckProgressData) => void): () => void;
}
//# sourceMappingURL=PackageManagerService.d.ts.map