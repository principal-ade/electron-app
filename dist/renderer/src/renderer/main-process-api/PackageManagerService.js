/**
 * Service layer for Package Manager functionality
 * ALL window.mainProcess.packageManager calls MUST be encapsulated here
 */
export class PackageManagerService {
    /**
     * Check package versions
     */
    static async checkVersions(packages, packageManager, options) {
        return window.mainProcess.packageManager.checkVersions({ packages, packageManager, options });
    }
    /**
     * Invoke check versions (async operation)
     */
    static async invokeCheckVersions(params) {
        return window.mainProcess.packageManager.checkVersions(params);
    }
    /**
     * Check for vulnerabilities
     */
    static async checkVulnerabilities(packages, packageManager, options) {
        return window.mainProcess.packageManager.checkVulnerabilities({ packages, packageManager, options });
    }
    /**
     * Invoke vulnerability check (async operation)
     */
    static async invokeCheckVulnerabilities(params) {
        return window.mainProcess.packageManager.checkVulnerabilities(params);
    }
    /**
     * Check licenses
     */
    static async checkLicenses(packages, packageManager, options) {
        return window.mainProcess.packageManager.checkLicenses({ packages, packageManager, options });
    }
    /**
     * Invoke license check (async operation)
     */
    static async invokeCheckLicenses(params) {
        return window.mainProcess.packageManager.checkLicenses(params);
    }
    /**
     * Subscribe to version check progress
     * @returns Unsubscribe function
     */
    static onVersionCheckProgress(callback) {
        return window.mainProcess.packageManager.onVersionCheckProgress(callback);
    }
    /**
     * Subscribe to vulnerability check progress
     * @returns Unsubscribe function
     */
    static onVulnerabilityCheckProgress(callback) {
        return window.mainProcess.packageManager.onVulnerabilityCheckProgress(callback);
    }
    /**
     * Subscribe to license check progress
     * @returns Unsubscribe function
     */
    static onLicenseCheckProgress(callback) {
        return window.mainProcess.packageManager.onLicenseCheckProgress(callback);
    }
}
