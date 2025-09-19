/**
 * Service layer for Package Manager functionality
 * ALL window.mainProcess.packageManager calls MUST be encapsulated here
 */

import {
  PackageVersionInfo,
  PackageManager,
  CheckOptions,
  VersionCheckResult,
  VulnerabilityCheckResult,
  LicenseCheckResult,
  CheckProgressData,
} from '../../shared/main-process-api-interfaces/PackageManagerAPI';

export class PackageManagerService {
  /**
   * Check package versions
   */
  static async checkVersions(
    packages: PackageVersionInfo[],
    packageManager: PackageManager,
    options?: CheckOptions,
  ): Promise<VersionCheckResult[]> {
    return window.mainProcess.packageManager.checkVersions({
      packages,
      packageManager,
      options,
    });
  }

  /**
   * Invoke check versions (async operation)
   */
  static async invokeCheckVersions(params: {
    packages: PackageVersionInfo[];
    packageManager: PackageManager;
    options?: CheckOptions;
  }): Promise<VersionCheckResult[]> {
    return window.mainProcess.packageManager.checkVersions(params);
  }

  /**
   * Check for vulnerabilities
   */
  static async checkVulnerabilities(
    packages: PackageVersionInfo[],
    packageManager: PackageManager,
    options?: CheckOptions,
  ): Promise<VulnerabilityCheckResult[]> {
    return window.mainProcess.packageManager.checkVulnerabilities({
      packages,
      packageManager,
      options,
    });
  }

  /**
   * Invoke vulnerability check (async operation)
   */
  static async invokeCheckVulnerabilities(params: {
    packages: PackageVersionInfo[];
    packageManager: PackageManager;
    options?: CheckOptions;
  }): Promise<VulnerabilityCheckResult[]> {
    return window.mainProcess.packageManager.checkVulnerabilities(params);
  }

  /**
   * Check licenses
   */
  static async checkLicenses(
    packages: PackageVersionInfo[],
    packageManager: PackageManager,
    options?: CheckOptions,
  ): Promise<LicenseCheckResult[]> {
    return window.mainProcess.packageManager.checkLicenses({
      packages,
      packageManager,
      options,
    });
  }

  /**
   * Invoke license check (async operation)
   */
  static async invokeCheckLicenses(params: {
    packages: PackageVersionInfo[];
    packageManager: PackageManager;
    options?: CheckOptions;
  }): Promise<LicenseCheckResult[]> {
    return window.mainProcess.packageManager.checkLicenses(params);
  }

  /**
   * Subscribe to version check progress
   * @returns Unsubscribe function
   */
  static onVersionCheckProgress(
    callback: (data: CheckProgressData) => void,
  ): () => void {
    return window.mainProcess.packageManager.onVersionCheckProgress(callback);
  }

  /**
   * Subscribe to vulnerability check progress
   * @returns Unsubscribe function
   */
  static onVulnerabilityCheckProgress(
    callback: (data: CheckProgressData) => void,
  ): () => void {
    return window.mainProcess.packageManager.onVulnerabilityCheckProgress(
      callback,
    );
  }

  /**
   * Subscribe to license check progress
   * @returns Unsubscribe function
   */
  static onLicenseCheckProgress(
    callback: (data: CheckProgressData) => void,
  ): () => void {
    return window.mainProcess.packageManager.onLicenseCheckProgress(callback);
  }
}
