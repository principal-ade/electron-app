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
export function getLicenseColor(licenseKey?: string): string {
  if (!licenseKey) return '#6b7280'; // Gray for unknown

  const key = licenseKey.toLowerCase();

  // Very permissive licenses (green)
  if (
    [
      'mit',
      'bsd',
      'bsd-2-clause',
      'bsd-3-clause',
      'isc',
      'apache-2.0',
      'unlicense',
      '0bsd',
    ].includes(key)
  ) {
    return '#10b981'; // Green
  }

  // Permissive with conditions (blue)
  if (['mpl-2.0', 'lgpl-2.1', 'lgpl-3.0', 'epl-1.0', 'epl-2.0'].includes(key)) {
    return '#3b82f6'; // Blue
  }

  // Copyleft licenses (orange)
  if (['gpl-2.0', 'gpl-3.0', 'agpl-3.0', 'cc-by-sa-4.0'].includes(key)) {
    return '#f59e0b'; // Orange
  }

  // Proprietary or restrictive (red)
  if (['proprietary', 'cc-by-nc', 'cc-by-nc-sa'].includes(key)) {
    return '#ef4444'; // Red
  }

  // Default for other licenses
  return '#8b5cf6'; // Purple
}

/**
 * Get a human-friendly description of the license type
 * @param licenseKey - The license key
 * @returns Description string
 */
export function getLicenseDescription(licenseKey?: string): string {
  if (!licenseKey) return 'Unknown license';

  const key = licenseKey.toLowerCase();

  if (
    [
      'mit',
      'bsd',
      'bsd-2-clause',
      'bsd-3-clause',
      'isc',
      'apache-2.0',
      'unlicense',
      '0bsd',
    ].includes(key)
  ) {
    return 'Permissive license - minimal restrictions';
  }

  if (['mpl-2.0', 'lgpl-2.1', 'lgpl-3.0', 'epl-1.0', 'epl-2.0'].includes(key)) {
    return 'Weak copyleft - some restrictions apply';
  }

  if (['gpl-2.0', 'gpl-3.0', 'agpl-3.0'].includes(key)) {
    return 'Strong copyleft - derivative works must use same license';
  }

  if (['proprietary', 'cc-by-nc', 'cc-by-nc-sa'].includes(key)) {
    return 'Restrictive license - commercial use may be limited';
  }

  return 'Check license terms for details';
}

/**
 * Get a shortened display name for the license
 * @param license - The license info object
 * @returns Display string
 */
export function getLicenseDisplayName(license?: LicenseInfo): string {
  if (!license) return '';
  return license.spdxId || license.key || license.name || 'License';
}
