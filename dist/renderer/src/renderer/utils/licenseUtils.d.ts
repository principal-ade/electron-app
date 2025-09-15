/**
 * Utility functions for handling license information and styling
 */
export interface LicenseInfo {
    key: string;
    name: string;
    spdxId: string;
    url?: string;
}
/**
 * Get the color for a license based on its permissiveness
 * @param licenseKey - The license key (e.g., 'mit', 'gpl-3.0')
 * @returns Hex color string
 */
export declare function getLicenseColor(licenseKey?: string): string;
/**
 * Get a human-friendly description of the license type
 * @param licenseKey - The license key
 * @returns Description string
 */
export declare function getLicenseDescription(licenseKey?: string): string;
/**
 * Get a shortened display name for the license
 * @param license - The license info object
 * @returns Display string
 */
export declare function getLicenseDisplayName(license?: LicenseInfo): string;
//# sourceMappingURL=licenseUtils.d.ts.map