import { net } from 'electron';

interface PackageVersionInfo {
  name: string;
  currentVersion: string;
}

export interface VersionCheckResult {
  packageName: string;
  currentVersion: string;
  latestVersion?: string;
  updateType?: 'major' | 'minor' | 'patch' | 'none';
  isOutdated: boolean;
  isDeprecated?: boolean;
  deprecationMessage?: string;
  error?: string;
}

export interface VulnerabilityInfo {
  id: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description?: string;
  fixAvailable?: boolean;
}

export interface VulnerabilityCheckResult {
  packageName: string;
  version: string;
  vulnerabilities: VulnerabilityInfo[];
  error?: string;
}

export interface LicenseInfo {
  license: string;
  licenseType: 'permissive' | 'copyleft' | 'proprietary' | 'unknown';
  requiresAttribution: boolean;
  requiresShareAlike: boolean;
  allowsCommercialUse: boolean;
}

export interface LicenseCheckResult {
  packageName: string;
  version: string;
  license?: LicenseInfo;
  error?: string;
}

/** NPM package registry data (unvalidated JSON from registry.npmjs.org) */
interface NPMPackageData {
  'dist-tags'?: {
    latest?: string;
    [tag: string]: string | undefined;
  };
  versions?: {
    [version: string]: {
      deprecated?: string;
      [key: string]: any;
    };
  };
  license?: string;
  [key: string]: any;
}

// Simple in-memory cache
const versionCache = new Map<string, { data: NPMPackageData; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export class PackageManagerService {
  private async fetchPackageInfo(packageName: string): Promise<NPMPackageData> {
    const cacheKey = `pkg:${packageName}`;
    const cached = versionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    return new Promise((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        url: `https://registry.npmjs.org/${packageName}`,
        headers: {
          Accept: 'application/json',
        },
      });

      let responseData = '';

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`NPM registry returned ${response.statusCode}`));
          return;
        }

        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          try {
            const data = JSON.parse(responseData);
            versionCache.set(cacheKey, { data, timestamp: Date.now() });
            resolve(data);
          } catch (_error) {
            reject(new Error('Failed to parse NPM registry response'));
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.end();
    });
  }

  private compareVersions(
    current: string,
    latest: string,
  ): 'major' | 'minor' | 'patch' | 'none' {
    // Remove any ^ or ~ prefix
    const cleanCurrent = current.replace(/^[\^~]/, '');
    const cleanLatest = latest.replace(/^[\^~]/, '');

    const currentParts = cleanCurrent
      .split('.')
      .map((p) => parseInt(p, 10) || 0);
    const latestParts = cleanLatest.split('.').map((p) => parseInt(p, 10) || 0);

    // Ensure arrays have same length
    while (currentParts.length < 3) currentParts.push(0);
    while (latestParts.length < 3) latestParts.push(0);

    if (latestParts[0] > currentParts[0]) return 'major';
    if (latestParts[0] === currentParts[0] && latestParts[1] > currentParts[1])
      return 'minor';
    if (
      latestParts[0] === currentParts[0] &&
      latestParts[1] === currentParts[1] &&
      latestParts[2] > currentParts[2]
    )
      return 'patch';

    return 'none';
  }

  async *checkVersions(
    packages: PackageVersionInfo[],
    batchSize: number = 5,
  ): AsyncGenerator<VersionCheckResult, void, unknown> {
    for (let i = 0; i < packages.length; i += batchSize) {
      const batch = packages.slice(i, i + batchSize);
      const promises = batch.map(async (pkg) => {
        try {
          const packageInfo = await this.fetchPackageInfo(pkg.name);
          const latestVersion = packageInfo['dist-tags']?.latest;

          if (!latestVersion) {
            throw new Error('No latest version found');
          }

          const updateType = this.compareVersions(
            pkg.currentVersion,
            latestVersion,
          );
          const isOutdated = updateType !== 'none';

          // Check if current version OR latest version is deprecated
          const cleanVersion = pkg.currentVersion.replace(/^[\^~]/, '');
          const currentVersionData = packageInfo.versions?.[cleanVersion];
          const latestVersionData = packageInfo.versions?.[latestVersion];

          const isDeprecated =
            currentVersionData?.deprecated !== undefined ||
            latestVersionData?.deprecated !== undefined;

          const deprecationMessage =
            currentVersionData?.deprecated ||
            latestVersionData?.deprecated ||
            undefined;

          return {
            packageName: pkg.name,
            currentVersion: pkg.currentVersion,
            latestVersion,
            updateType,
            isOutdated,
            isDeprecated,
            deprecationMessage,
          } as VersionCheckResult;
        } catch (error) {
          return {
            packageName: pkg.name,
            currentVersion: pkg.currentVersion,
            isOutdated: false,
            error: `Failed to check version: ${error instanceof Error ? error.message : 'Unknown error'}`,
          } as VersionCheckResult;
        }
      });

      const results = await Promise.all(promises);
      for (const result of results) {
        yield result;
      }

      // Small delay to prevent overwhelming the NPM registry
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async *checkVulnerabilities(
    packages: PackageVersionInfo[],
    _batchSize: number = 5,
  ): AsyncGenerator<VulnerabilityCheckResult, void, unknown> {
    // For now, we'll use npm audit API or return empty results
    // In a real implementation, this would query vulnerability databases
    for (const pkg of packages) {
      // Mock implementation - in production, query actual vulnerability DB
      yield {
        packageName: pkg.name,
        version: pkg.currentVersion,
        vulnerabilities: [],
      };
    }
  }

  async *checkLicenses(
    packages: PackageVersionInfo[],
    batchSize: number = 5,
  ): AsyncGenerator<LicenseCheckResult, void, unknown> {
    const commonLicenseTypes: Record<string, LicenseInfo['licenseType']> = {
      MIT: 'permissive',
      'Apache-2.0': 'permissive',
      'BSD-3-Clause': 'permissive',
      'BSD-2-Clause': 'permissive',
      ISC: 'permissive',
      'GPL-3.0': 'copyleft',
      'GPL-2.0': 'copyleft',
      'LGPL-3.0': 'copyleft',
      'LGPL-2.1': 'copyleft',
      'AGPL-3.0': 'copyleft',
      'CC-BY-SA-4.0': 'copyleft',
      'CC0-1.0': 'permissive',
      Unlicense: 'permissive',
      WTFPL: 'permissive',
    };

    for (let i = 0; i < packages.length; i += batchSize) {
      const batch = packages.slice(i, i + batchSize);
      const promises = batch.map(async (pkg) => {
        try {
          const packageInfo = await this.fetchPackageInfo(pkg.name);
          const cleanVersion = pkg.currentVersion.replace(/^[\^~]/, '');
          const versionData =
            packageInfo.versions?.[cleanVersion] ||
            packageInfo.versions?.[packageInfo['dist-tags']?.latest];

          const licenseString =
            versionData?.license || packageInfo.license || 'Unknown';
          const licenseType = commonLicenseTypes[licenseString] || 'unknown';

          return {
            packageName: pkg.name,
            version: pkg.currentVersion,
            license: {
              license: licenseString,
              licenseType,
              requiresAttribution: licenseType !== 'unknown',
              requiresShareAlike: licenseType === 'copyleft',
              allowsCommercialUse: licenseType !== 'proprietary',
            },
          } as LicenseCheckResult;
        } catch (error) {
          return {
            packageName: pkg.name,
            version: pkg.currentVersion,
            error: `Failed to check license: ${error instanceof Error ? error.message : 'Unknown error'}`,
          } as LicenseCheckResult;
        }
      });

      const results = await Promise.all(promises);
      for (const result of results) {
        yield result;
      }

      // Small delay to prevent overwhelming the NPM registry
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
