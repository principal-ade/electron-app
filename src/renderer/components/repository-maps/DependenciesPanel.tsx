import React, { useState, useCallback, useMemo } from 'react';
import {
  Package,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Filter,
  HelpCircle,
  Shield,
  Zap,
  Scale,
  AlertTriangle,
  Check,
  TrendingUp,
  Copy,
  CheckCircle2,
  Circle,
  Square,
  CheckSquare,
  Search,
  X,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { DependencyInfoModal } from './DependencyInfoModal';
import { PackageManagerService } from '../../main-process-api/PackageManagerService';

interface DependenciesPanelProps {
  packageLayers: PackageLayer[] | null;
  onAnalysisComplete?: (results: DependencyAnalysisResults) => void;
  onPackageAnalysisStart?: (packagePath: string, packageName: string) => void;
  onPackageAnalysisEnd?: () => void;
  onPackageSelected?: (packagePath: string, packageName: string) => void;
  onPackageDeselected?: () => void;
}

export interface DependencyAnalysisResults {
  packageName: string;
  packagePath: string;
  totalDependencies: number;
  outdatedCount: number;
  vulnerabilityCount: number;
  licenseIssues: number;
  versionResults: any[];
  vulnerabilityResults: any[];
  licenseResults: any[];
}

interface DependencyItem {
  name: string;
  currentVersion: string;
  latestVersion?: string;
  updateType?: 'major' | 'minor' | 'patch' | 'none';
  isOutdated: boolean;
  isDeprecated?: boolean;
  license?: string;
  licenseType?: 'permissive' | 'copyleft' | 'proprietary' | 'unknown';
  dependencyType: 'production' | 'development' | 'peer';
  vulnerabilities?: Array<{
    id: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
    description?: string;
    fixAvailable?: boolean;
  }>;
}

export const DependenciesPanel: React.FC<DependenciesPanelProps> = ({
  packageLayers,
  onAnalysisComplete,
  onPackageAnalysisStart,
  onPackageAnalysisEnd,
  onPackageSelected,
  onPackageDeselected,
}) => {
  const { theme } = useTheme();

  // Auto-select if only one package
  const initialPackage = useMemo(() => {
    if (packageLayers && packageLayers.length === 1) {
      return packageLayers[0].packageData.path;
    }
    return '';
  }, [packageLayers]);

  const [selectedPackage, setSelectedPackage] =
    useState<string>(initialPackage);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [analysisResults, setAnalysisResults] =
    useState<DependencyAnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [dependencyItems, setDependencyItems] = useState<DependencyItem[]>([]);
  const [isAnalyzed, setIsAnalyzed] = useState(false); // Track if analysis has been run
  const [filterType, setFilterType] = useState<
    'all' | 'production' | 'development' | 'peer'
  >('all');
  const [showOutdatedOnly, setShowOutdatedOnly] = useState(false);
  const [showVulnerableOnly, setShowVulnerableOnly] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [smartFilter, setSmartFilter] = useState<
    | 'none'
    | 'critical-security'
    | 'deprecated'
    | 'safe-updates'
    | 'license-review'
    | 'production-risk'
  >('none');
  const [selectedDependencies, setSelectedDependencies] = useState<Set<string>>(
    new Set(),
  );
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get selected package data
  const selectedPackageData = useMemo(() => {
    if (selectedPackage === undefined || !packageLayers) return null;
    return packageLayers.find(
      (pkg) => pkg.packageData.path === selectedPackage,
    );
  }, [selectedPackage, packageLayers]);

  // Update selectedPackage when packageLayers changes to single package
  React.useEffect(() => {
    if (packageLayers && packageLayers.length === 1) {
      const singlePackagePath = packageLayers[0].packageData.path;
      // Check if we need to update - avoid infinite loop by checking if it's already set correctly
      if (selectedPackage !== singlePackagePath) {
        setSelectedPackage(singlePackagePath);
        // Notify parent about auto-selection
        onPackageSelected?.(
          singlePackagePath,
          packageLayers[0].packageData.name,
        );
      }
    }
  }, [packageLayers, selectedPackage, onPackageSelected]);

  // Load basic dependencies immediately when package is selected
  React.useEffect(() => {
    if (!selectedPackageData || selectedPackage === '__placeholder__') {
      setDependencyItems([]);
      return;
    }

    // Extract basic dependency info from package.json
    const { dependencies, devDependencies, peerDependencies } =
      selectedPackageData.packageData;

    const basicDeps: DependencyItem[] = [];

    if (dependencies) {
      Object.entries(dependencies).forEach(([name, version]) => {
        basicDeps.push({
          name,
          currentVersion: version,
          isOutdated: false, // Will be determined by analysis
          dependencyType: 'production',
        });
      });
    }

    if (devDependencies) {
      Object.entries(devDependencies).forEach(([name, version]) => {
        basicDeps.push({
          name,
          currentVersion: version,
          isOutdated: false,
          dependencyType: 'development',
        });
      });
    }

    if (peerDependencies) {
      Object.entries(peerDependencies).forEach(([name, version]) => {
        basicDeps.push({
          name,
          currentVersion: version,
          isOutdated: false,
          dependencyType: 'peer',
        });
      });
    }

    // Sort by name
    basicDeps.sort((a, b) => a.name.localeCompare(b.name));

    setDependencyItems(basicDeps);
    setIsAnalyzed(false);
  }, [selectedPackageData, selectedPackage]);

  // Filter dependencies based on current filters
  const filteredDependencies = useMemo(() => {
    let filtered = [...dependencyItems];

    // Apply search query first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((dep) =>
        dep.name.toLowerCase().includes(query),
      );
    }

    // Apply smart filters first
    switch (smartFilter) {
      case 'critical-security':
        // Show only packages with critical or high vulnerabilities
        filtered = filtered.filter(
          (dep) =>
            dep.vulnerabilities &&
            dep.vulnerabilities.some(
              (v) => v.severity === 'critical' || v.severity === 'high',
            ),
        );
        break;
      case 'deprecated':
        // Show only deprecated packages
        filtered = filtered.filter((dep) => dep.isDeprecated === true);
        break;
      case 'safe-updates':
        // Show only outdated packages with patch updates
        filtered = filtered.filter(
          (dep) => dep.isOutdated && dep.updateType === 'patch',
        );
        break;
      case 'license-review':
        // Show packages with copyleft or proprietary licenses
        filtered = filtered.filter(
          (dep) =>
            dep.licenseType === 'copyleft' || dep.licenseType === 'proprietary',
        );
        break;
      case 'production-risk':
        // Show production dependencies with major updates or vulnerabilities
        filtered = filtered.filter(
          (dep) =>
            dep.dependencyType === 'production' &&
            (dep.updateType === 'major' ||
              (dep.vulnerabilities && dep.vulnerabilities.length > 0)),
        );
        break;
    }

    // Apply regular filters only if no smart filter is active
    if (smartFilter === 'none') {
      // Filter by type
      if (filterType !== 'all') {
        filtered = filtered.filter((dep) => dep.dependencyType === filterType);
      }

      // Filter outdated only
      if (showOutdatedOnly) {
        filtered = filtered.filter((dep) => dep.isOutdated);
      }

      // Filter vulnerable only
      if (showVulnerableOnly) {
        filtered = filtered.filter(
          (dep) => dep.vulnerabilities && dep.vulnerabilities.length > 0,
        );
      }
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  }, [
    dependencyItems,
    filterType,
    showOutdatedOnly,
    showVulnerableOnly,
    smartFilter,
    searchQuery,
  ]);

  // Toggle dependency selection
  const toggleDependencySelection = useCallback((depKey: string) => {
    setSelectedDependencies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(depKey)) {
        newSet.delete(depKey);
      } else {
        newSet.add(depKey);
      }
      return newSet;
    });
  }, []);

  // Select all outdated dependencies
  const selectAllOutdated = useCallback(() => {
    const outdatedDeps = filteredDependencies
      .filter((dep) => dep.isOutdated)
      .map((dep) => `${dep.name}-${dep.dependencyType}`);
    setSelectedDependencies(new Set(outdatedDeps));
  }, [filteredDependencies]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedDependencies(new Set());
  }, []);

  // Generate update prompt for agent
  const generateUpdatePrompt = useCallback(() => {
    const selectedDepItems = dependencyItems.filter((dep) =>
      selectedDependencies.has(`${dep.name}-${dep.dependencyType}`),
    );

    const updateList = selectedDepItems
      .map((dep) => {
        let info = `- ${dep.name}: ${dep.currentVersion} → ${dep.latestVersion} (${dep.updateType} update)`;
        if (dep.vulnerabilities && dep.vulnerabilities.length > 0) {
          const criticalCount = dep.vulnerabilities.filter(
            (v) => v.severity === 'critical',
          ).length;
          const highCount = dep.vulnerabilities.filter(
            (v) => v.severity === 'high',
          ).length;
          if (criticalCount > 0 || highCount > 0) {
            info += ` [WARNING] Has ${criticalCount > 0 ? `${criticalCount} critical` : ''}${criticalCount > 0 && highCount > 0 ? ' and ' : ''}${highCount > 0 ? `${highCount} high` : ''} vulnerabilities`;
          }
        }
        if (dep.isDeprecated) {
          info += ` [DEPRECATED] Package is deprecated`;
        }
        return info;
      })
      .join('\n');

    const prompt = `Can you update the following dependencies safely? If so, please update them. If not, tell me why.

Package: ${selectedPackageData?.packageData.name}
Path: ${selectedPackageData?.packageData.path}

Dependencies to update:
${updateList}

Please check for breaking changes and compatibility issues before updating.`;

    // Copy to clipboard
    navigator.clipboard.writeText(prompt).then(() => {
      setShowUpdatePrompt(true);
      setTimeout(() => setShowUpdatePrompt(false), 3000);
    });
  }, [selectedDependencies, dependencyItems, selectedPackageData]);

  // Badge style helpers
  const getUpdateBadgeStyle = (updateType?: string) => {
    const baseStyle = {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '500' as const,
    };

    switch (updateType) {
      case 'major':
        return {
          ...baseStyle,
          backgroundColor: `${theme.colors.error}20`,
          color: theme.colors.error,
        };
      case 'minor':
        return {
          ...baseStyle,
          backgroundColor: `${theme.colors.warning}20`,
          color: theme.colors.warning,
        };
      case 'patch':
        return { ...baseStyle, backgroundColor: '#10b98120', color: '#10b981' };
      default:
        return {
          ...baseStyle,
          backgroundColor: theme.colors.backgroundLight,
          color: theme.colors.textSecondary,
        };
    }
  };

  const getDependencyTypeBadgeStyle = (type: string) => {
    const baseStyle = {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '500' as const,
    };

    switch (type) {
      case 'production':
        return {
          ...baseStyle,
          backgroundColor: `${theme.colors.primary}20`,
          color: theme.colors.primary,
        };
      case 'development':
        return { ...baseStyle, backgroundColor: '#8b5cf620', color: '#8b5cf6' };
      case 'peer':
        return { ...baseStyle, backgroundColor: '#6366f120', color: '#6366f1' };
      default:
        return {
          ...baseStyle,
          backgroundColor: theme.colors.backgroundLight,
          color: theme.colors.textSecondary,
        };
    }
  };

  const getLicenseBadgeStyle = (licenseType?: string) => {
    const baseStyle = {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '500' as const,
    };

    switch (licenseType) {
      case 'permissive':
        return { ...baseStyle, backgroundColor: '#10b98120', color: '#10b981' };
      case 'copyleft':
        return {
          ...baseStyle,
          backgroundColor: `${theme.colors.warning}20`,
          color: theme.colors.warning,
        };
      case 'proprietary':
        return {
          ...baseStyle,
          backgroundColor: `${theme.colors.error}20`,
          color: theme.colors.error,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: theme.colors.backgroundLight,
          color: theme.colors.textSecondary,
        };
    }
  };

  const getSeverityBadgeStyle = (severity: string) => {
    const baseStyle = {
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: '500' as const,
    };

    switch (severity) {
      case 'critical':
        return {
          ...baseStyle,
          backgroundColor: `${theme.colors.error}20`,
          color: theme.colors.error,
        };
      case 'high':
        return { ...baseStyle, backgroundColor: '#f9731620', color: '#f97316' };
      case 'moderate':
        return {
          ...baseStyle,
          backgroundColor: `${theme.colors.warning}20`,
          color: theme.colors.warning,
        };
      case 'low':
        return {
          ...baseStyle,
          backgroundColor: `${theme.colors.primary}20`,
          color: theme.colors.primary,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: theme.colors.backgroundLight,
          color: theme.colors.textSecondary,
        };
    }
  };

  // Handle analysis
  const handleAnalyze = useCallback(async () => {
    if (!selectedPackageData) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalysisStatus('Preparing to analyze dependencies...');
    setAnalysisResults(null);
    setProgress({ current: 0, total: 0, phase: 'starting' });

    // Notify parent that analysis started
    onPackageAnalysisStart?.(
      selectedPackageData.packageData.path,
      selectedPackageData.packageData.name,
    );

    try {
      // Get package data
      const { dependencies, devDependencies, peerDependencies } =
        selectedPackageData.packageData;

      // Extract all dependencies with their types
      const allDeps: Array<{
        name: string;
        currentVersion: string;
        type: 'production' | 'development' | 'peer';
      }> = [];

      if (dependencies) {
        Object.entries(dependencies).forEach(([name, version]) => {
          allDeps.push({ name, currentVersion: version, type: 'production' });
        });
      }

      if (devDependencies) {
        Object.entries(devDependencies).forEach(([name, version]) => {
          allDeps.push({ name, currentVersion: version, type: 'development' });
        });
      }

      if (peerDependencies) {
        Object.entries(peerDependencies).forEach(([name, version]) => {
          allDeps.push({ name, currentVersion: version, type: 'peer' });
        });
      }

      if (allDeps.length === 0) {
        setAnalysisStatus('No dependencies found in this package');
        setIsAnalyzing(false);
        return;
      }

      setProgress({
        current: 0,
        total: allDeps.length,
        phase: 'checking-versions',
      });
      setAnalysisStatus(
        `Checking ${allDeps.length} dependencies for updates...`,
      );

      // Check versions
      const versionResults = await PackageManagerService.checkVersions(
        allDeps.map((d) => ({
          name: d.name,
          currentVersion: d.currentVersion,
        })),
        'npm',
        { batchSize: 5 },
      );

      // Count outdated
      const outdatedCount = versionResults.filter(
        (r: any) => r.isOutdated,
      ).length;

      setProgress({
        current: 0,
        total: allDeps.length,
        phase: 'checking-licenses',
      });
      setAnalysisStatus('Analyzing licenses...');

      // Check licenses
      const licenseResults = await PackageManagerService.checkLicenses(
        allDeps.map((d) => ({
          name: d.name,
          currentVersion: d.currentVersion,
        })),
        'npm',
        { batchSize: 5 },
      );

      // Count license issues (copyleft or proprietary)
      const licenseIssues = licenseResults.filter(
        (r: any) =>
          r.license?.licenseType === 'copyleft' ||
          r.license?.licenseType === 'proprietary',
      ).length;

      setProgress({
        current: 0,
        total: allDeps.length,
        phase: 'checking-vulnerabilities',
      });
      setAnalysisStatus('Scanning for vulnerabilities...');

      // Check vulnerabilities
      const vulnerabilityResults =
        await PackageManagerService.checkVulnerabilities(
          allDeps.map((d) => ({
            name: d.name,
            currentVersion: d.currentVersion,
          })),
          'npm',
          { batchSize: 5 },
        );

      // Count vulnerabilities
      const vulnerabilityCount = vulnerabilityResults.reduce(
        (acc: number, r: any) => acc + (r.vulnerabilities?.length || 0),
        0,
      );

      // Create DependencyItem objects
      const items: DependencyItem[] = allDeps.map((dep) => {
        const versionResult = versionResults.find(
          (r: any) => r.packageName === dep.name,
        );
        const licenseResult = licenseResults.find(
          (r: any) => r.packageName === dep.name,
        );
        const vulnerabilityResult = vulnerabilityResults.find(
          (r: any) => r.packageName === dep.name,
        );

        return {
          name: dep.name,
          currentVersion: dep.currentVersion,
          latestVersion: versionResult?.latestVersion,
          updateType: versionResult?.updateType,
          isOutdated: versionResult?.isOutdated || false,
          isDeprecated: versionResult?.isDeprecated,
          license: licenseResult?.license?.license,
          licenseType: licenseResult?.license?.licenseType,
          dependencyType: dep.type,
          vulnerabilities: vulnerabilityResult?.vulnerabilities || [],
        };
      });

      setDependencyItems(items);
      setIsAnalyzed(true); // Mark as analyzed

      // Prepare results
      const results: DependencyAnalysisResults = {
        packageName: selectedPackageData.packageData.name,
        packagePath: selectedPackageData.packageData.path,
        totalDependencies: allDeps.length,
        outdatedCount,
        vulnerabilityCount,
        licenseIssues,
        versionResults,
        vulnerabilityResults,
        licenseResults,
      };

      setAnalysisResults(results);
      setAnalysisStatus(''); // Clear status after completion
      onAnalysisComplete?.(results);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to analyze dependencies',
      );
      setAnalysisStatus('');
      onPackageAnalysisEnd?.(); // Clear highlight on error
    } finally {
      setIsAnalyzing(false);
      setProgress({ current: 0, total: 0, phase: '' });
    }
  }, [selectedPackageData, onAnalysisComplete]);

  // Progress listener setup
  React.useEffect(() => {
    const cleanupFns: (() => void)[] = [];

    // Version check progress
    const versionCleanup = PackageManagerService.onVersionCheckProgress(
      (data: any) => {
        setProgress((prev) => ({
          ...prev,
          current: data.current,
          total: data.total,
          phase: 'checking-versions',
        }));
        setAnalysisStatus(`Checking versions: ${data.current}/${data.total}`);
      },
    );
    cleanupFns.push(versionCleanup);

    // License check progress
    const licenseCleanup = PackageManagerService.onLicenseCheckProgress(
      (data: any) => {
        setProgress((prev) => ({
          ...prev,
          current: data.current,
          total: data.total,
          phase: 'checking-licenses',
        }));
        setAnalysisStatus(`Checking licenses: ${data.current}/${data.total}`);
      },
    );
    cleanupFns.push(licenseCleanup);

    // Vulnerability check progress
    const vulnCleanup = PackageManagerService.onVulnerabilityCheckProgress(
      (data: any) => {
        setProgress((prev) => ({
          ...prev,
          current: data.current,
          total: data.total,
          phase: 'checking-vulnerabilities',
        }));
        setAnalysisStatus(
          `Scanning vulnerabilities: ${data.current}/${data.total}`,
        );
      },
    );
    cleanupFns.push(vulnCleanup);

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, []);

  return (
    <div
      style={{
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Package size={16} />
            Dependencies Analysis
          </h3>
          <button
            onClick={() => setShowInfoModal(true)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '4px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.primary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${theme.colors.primary}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
          >
            <HelpCircle size={12} />
            Learn More
          </button>
        </div>
        <p
          style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
          }}
        >
          Analyze package dependencies for updates, vulnerabilities, and license
          compliance
        </p>
      </div>

      {/* Package Selection or Summary */}
      {packageLayers && packageLayers.length > 1 && !isAnalyzed ? (
        // Only show selector if more than one package and not analyzed
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: theme.colors.textSecondary,
              marginBottom: '6px',
            }}
          >
            Select Package
          </label>
          <select
            value={selectedPackage}
            onChange={(e) => {
              const newValue = e.target.value;
              const prevValue = selectedPackage;

              setSelectedPackage(newValue);
              setAnalysisResults(null);
              setIsAnalyzed(false);
              setError(null);
              setAnalysisStatus('');

              // Handle package selection/deselection callbacks
              if (prevValue !== undefined && prevValue !== newValue) {
                // Deselect previous package
                onPackageDeselected?.();
              }

              if (newValue !== '__placeholder__' && newValue !== prevValue) {
                // Select new package (newValue can be empty string for root package)
                const selectedPackageData = packageLayers?.find(
                  (pkg) => pkg.packageData.path === newValue,
                );
                if (selectedPackageData) {
                  onPackageSelected?.(
                    selectedPackageData.packageData.path,
                    selectedPackageData.packageData.name,
                  );
                }
              } else if (newValue === '__placeholder__') {
                // This is the placeholder "Choose a package..." option
                onPackageDeselected?.();
              }
            }}
            disabled={
              isAnalyzing || !packageLayers || packageLayers.length === 0
            }
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="__placeholder__">Choose a package...</option>
            {packageLayers?.map((pkg) => (
              <option key={pkg.packageData.path} value={pkg.packageData.path}>
                {pkg.packageData.name} ({pkg.packageData.path || 'root'})
              </option>
            ))}
          </select>
        </div>
      ) : selectedPackageData && dependencyItems.length > 0 && !isAnalyzed ? (
        // Show package info card when dependencies are loaded but not analyzed
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Package size={16} color={theme.colors.primary} />
              <div>
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    margin: 0,
                  }}
                >
                  {selectedPackageData.packageData.name}
                </h4>
                <p
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    margin: 0,
                    marginTop: '2px',
                  }}
                >
                  {selectedPackageData.packageData.path || 'root'} •{' '}
                  {dependencyItems.length} dependencies
                </p>
              </div>
            </div>
            {/* Only show Change Package button if multiple packages */}
            {packageLayers && packageLayers.length > 1 && (
              <button
                onClick={() => {
                  setSelectedPackage('__placeholder__');
                  setAnalysisResults(null);
                  setIsAnalyzed(false);
                  setDependencyItems([]);
                  setSmartFilter('none');
                  setSelectedDependencies(new Set());
                  onPackageDeselected?.();
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                }}
              >
                Change Package
              </button>
            )}
          </div>
        </div>
      ) : isAnalyzed && analysisResults ? (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Package Info Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Package size={16} color={theme.colors.primary} />
              <div>
                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    margin: 0,
                  }}
                >
                  {analysisResults.packageName}
                </h4>
                <p
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    margin: 0,
                    marginTop: '2px',
                  }}
                >
                  {analysisResults.packagePath} •{' '}
                  {analysisResults.totalDependencies} dependencies
                </p>
              </div>
            </div>
            {/* Only show Change Package button if multiple packages */}
            {packageLayers && packageLayers.length > 1 && (
              <button
                onClick={() => {
                  setSelectedPackage('__placeholder__');
                  setAnalysisResults(null);
                  setIsAnalyzed(false);
                  setDependencyItems([]);
                  setSmartFilter('none');
                  setSelectedDependencies(new Set());
                  onPackageAnalysisEnd?.(); // Clear highlight when changing package
                  onPackageDeselected?.();
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                }}
              >
                Change Package
              </button>
            )}
          </div>

          {/* Status Badges */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {(() => {
              const criticalCount = dependencyItems.filter(
                (dep) =>
                  dep.vulnerabilities &&
                  dep.vulnerabilities.some(
                    (v) => v.severity === 'critical' || v.severity === 'high',
                  ),
              ).length;
              const hasCritical = criticalCount > 0;

              return (
                <div
                  onClick={() => {
                    if (hasCritical) {
                      setSmartFilter(
                        smartFilter === 'critical-security'
                          ? 'none'
                          : 'critical-security',
                      );
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: `1px solid ${hasCritical ? theme.colors.error : '#10b981'}`,
                    backgroundColor: hasCritical
                      ? `${theme.colors.error}15`
                      : '#10b98115',
                    color: hasCritical ? theme.colors.error : '#10b981',
                    cursor: hasCritical ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  {hasCritical ? <Shield size={12} /> : <Check size={12} />}
                  {hasCritical
                    ? `${criticalCount} Critical`
                    : 'No Critical Issues'}
                </div>
              );
            })()}

            {(() => {
              const deprecatedCount = dependencyItems.filter(
                (d) => d.isDeprecated,
              ).length;
              const hasDeprecated = deprecatedCount > 0;

              return (
                <div
                  onClick={() => {
                    if (hasDeprecated) {
                      setSmartFilter(
                        smartFilter === 'deprecated' ? 'none' : 'deprecated',
                      );
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: `1px solid ${hasDeprecated ? theme.colors.warning : '#10b981'}`,
                    backgroundColor: hasDeprecated
                      ? `${theme.colors.warning}15`
                      : '#10b98115',
                    color: hasDeprecated ? theme.colors.warning : '#10b981',
                    cursor: hasDeprecated ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {hasDeprecated ? (
                    <AlertCircle size={12} />
                  ) : (
                    <Check size={12} />
                  )}
                  {hasDeprecated
                    ? `${deprecatedCount} Deprecated`
                    : 'No Deprecated'}
                </div>
              );
            })()}

            {(() => {
              const outdatedCount = dependencyItems.filter(
                (dep) => dep.isOutdated,
              ).length;
              const hasOutdated = outdatedCount > 0;

              return (
                <div
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: `1px solid ${hasOutdated ? theme.colors.primary : '#10b981'}`,
                    backgroundColor: hasOutdated
                      ? `${theme.colors.primary}15`
                      : '#10b98115',
                    color: hasOutdated ? theme.colors.primary : '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {hasOutdated ? <TrendingUp size={12} /> : <Check size={12} />}
                  {hasOutdated ? `${outdatedCount} Outdated` : 'All Up-to-date'}
                </div>
              );
            })()}

            {(() => {
              const licenseIssues = dependencyItems.filter(
                (dep) =>
                  dep.licenseType === 'copyleft' ||
                  dep.licenseType === 'proprietary',
              ).length;
              const hasLicenseIssues = licenseIssues > 0;

              return (
                <div
                  onClick={() => {
                    if (hasLicenseIssues) {
                      setSmartFilter(
                        smartFilter === 'license-review'
                          ? 'none'
                          : 'license-review',
                      );
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: `1px solid ${hasLicenseIssues ? theme.colors.warning : '#10b981'}`,
                    backgroundColor: hasLicenseIssues
                      ? `${theme.colors.warning}15`
                      : '#10b98115',
                    color: hasLicenseIssues ? theme.colors.warning : '#10b981',
                    cursor: hasLicenseIssues ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {hasLicenseIssues ? <Scale size={12} /> : <Check size={12} />}
                  {hasLicenseIssues
                    ? `${licenseIssues} License Issues`
                    : 'Licenses OK'}
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}

      {/* Analyze Button - Show when dependencies are loaded but not analyzed */}
      {dependencyItems.length > 0 && !isAnalyzed && (
        <div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isAnalyzing
                ? theme.colors.backgroundLight
                : theme.colors.primary,
              color: isAnalyzing ? theme.colors.textSecondary : '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap size={14} />
                Analyze for Updates & Vulnerabilities
              </>
            )}
          </button>

          {/* Status Text */}
          {analysisStatus && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: theme.colors.backgroundLight,
                fontSize: '12px',
                color: theme.colors.textSecondary,
                textAlign: 'center',
              }}
            >
              {analysisStatus}
              {progress.total > 0 && (
                <div
                  style={{
                    marginTop: '4px',
                    height: '4px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(progress.current / progress.total) * 100}%`,
                      backgroundColor: theme.colors.primary,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: `${theme.colors.error}15`,
                border: `1px solid ${theme.colors.error}30`,
                fontSize: '12px',
                color: theme.colors.error,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Dependency List */}
      {dependencyItems.length > 0 && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Search Bar */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  color: theme.colors.textSecondary,
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Search dependencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 36px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.backgroundColor = theme.colors.background;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundLight;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Clear search"
                >
                  <X size={14} color={theme.colors.textSecondary} />
                </button>
              )}
            </div>

            {/* Smart Filters - Only show when analyzed */}
            {isAnalyzed && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    fontWeight: 500,
                  }}
                >
                  Quick Filters:
                </span>
                {(() => {
                  const criticalCount = dependencyItems.filter(
                    (dep) =>
                      dep.vulnerabilities &&
                      dep.vulnerabilities.some(
                        (v) =>
                          v.severity === 'critical' || v.severity === 'high',
                      ),
                  ).length;
                  const hasCritical = criticalCount > 0;

                  return (
                    <button
                      onClick={() => {
                        if (hasCritical) {
                          setSmartFilter(
                            smartFilter === 'critical-security'
                              ? 'none'
                              : 'critical-security',
                          );
                          setFilterType('all');
                          setShowOutdatedOnly(false);
                          setShowVulnerableOnly(false);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: `1px solid ${
                          smartFilter === 'critical-security'
                            ? theme.colors.error
                            : hasCritical
                              ? theme.colors.error
                              : '#10b981'
                        }`,
                        backgroundColor:
                          smartFilter === 'critical-security'
                            ? `${theme.colors.error}20`
                            : hasCritical
                              ? `${theme.colors.error}15`
                              : '#10b98115',
                        color:
                          smartFilter === 'critical-security'
                            ? theme.colors.error
                            : hasCritical
                              ? theme.colors.error
                              : '#10b981',
                        cursor: hasCritical ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {hasCritical ? <Shield size={10} /> : <Check size={10} />}
                      Critical Security {hasCritical && `(${criticalCount})`}
                    </button>
                  );
                })()}
                {(() => {
                  const deprecatedCount = dependencyItems.filter(
                    (d) => d.isDeprecated,
                  ).length;
                  const hasDeprecated = deprecatedCount > 0;

                  return (
                    <button
                      onClick={() => {
                        if (hasDeprecated) {
                          setSmartFilter(
                            smartFilter === 'deprecated'
                              ? 'none'
                              : 'deprecated',
                          );
                          setFilterType('all');
                          setShowOutdatedOnly(false);
                          setShowVulnerableOnly(false);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: `1px solid ${
                          smartFilter === 'deprecated'
                            ? theme.colors.error
                            : hasDeprecated
                              ? theme.colors.warning
                              : '#10b981'
                        }`,
                        backgroundColor:
                          smartFilter === 'deprecated'
                            ? `${theme.colors.error}20`
                            : hasDeprecated
                              ? `${theme.colors.warning}15`
                              : '#10b98115',
                        color:
                          smartFilter === 'deprecated'
                            ? theme.colors.error
                            : hasDeprecated
                              ? theme.colors.warning
                              : '#10b981',
                        cursor: hasDeprecated ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {hasDeprecated ? (
                        <AlertCircle size={10} />
                      ) : (
                        <Check size={10} />
                      )}
                      Deprecated {hasDeprecated && `(${deprecatedCount})`}
                    </button>
                  );
                })()}
                {(() => {
                  const safeUpdateCount = dependencyItems.filter(
                    (dep) => dep.isOutdated && dep.updateType === 'patch',
                  ).length;
                  const hasSafeUpdates = safeUpdateCount > 0;

                  return (
                    <button
                      onClick={() => {
                        if (hasSafeUpdates) {
                          setSmartFilter(
                            smartFilter === 'safe-updates'
                              ? 'none'
                              : 'safe-updates',
                          );
                          setFilterType('all');
                          setShowOutdatedOnly(false);
                          setShowVulnerableOnly(false);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: `1px solid ${
                          smartFilter === 'safe-updates'
                            ? '#10b981'
                            : hasSafeUpdates
                              ? theme.colors.primary
                              : '#10b981'
                        }`,
                        backgroundColor:
                          smartFilter === 'safe-updates'
                            ? '#10b98120'
                            : hasSafeUpdates
                              ? `${theme.colors.primary}15`
                              : '#10b98115',
                        color:
                          smartFilter === 'safe-updates'
                            ? '#10b981'
                            : hasSafeUpdates
                              ? theme.colors.primary
                              : '#10b981',
                        cursor: hasSafeUpdates ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {hasSafeUpdates ? <Zap size={10} /> : <Check size={10} />}
                      Safe Updates {hasSafeUpdates && `(${safeUpdateCount})`}
                    </button>
                  );
                })()}
                {(() => {
                  const licenseIssues = dependencyItems.filter(
                    (dep) =>
                      dep.licenseType === 'copyleft' ||
                      dep.licenseType === 'proprietary',
                  ).length;
                  const hasLicenseIssues = licenseIssues > 0;

                  return (
                    <button
                      onClick={() => {
                        if (hasLicenseIssues) {
                          setSmartFilter(
                            smartFilter === 'license-review'
                              ? 'none'
                              : 'license-review',
                          );
                          setFilterType('all');
                          setShowOutdatedOnly(false);
                          setShowVulnerableOnly(false);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: `1px solid ${
                          smartFilter === 'license-review'
                            ? theme.colors.warning
                            : hasLicenseIssues
                              ? theme.colors.warning
                              : '#10b981'
                        }`,
                        backgroundColor:
                          smartFilter === 'license-review'
                            ? `${theme.colors.warning}20`
                            : hasLicenseIssues
                              ? `${theme.colors.warning}15`
                              : '#10b98115',
                        color:
                          smartFilter === 'license-review'
                            ? theme.colors.warning
                            : hasLicenseIssues
                              ? theme.colors.warning
                              : '#10b981',
                        cursor: hasLicenseIssues ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {hasLicenseIssues ? (
                        <Scale size={10} />
                      ) : (
                        <Check size={10} />
                      )}
                      License Review {hasLicenseIssues && `(${licenseIssues})`}
                    </button>
                  );
                })()}
                {(() => {
                  const productionRiskCount = dependencyItems.filter(
                    (dep) =>
                      dep.dependencyType === 'production' &&
                      (dep.updateType === 'major' ||
                        (dep.vulnerabilities &&
                          dep.vulnerabilities.length > 0)),
                  ).length;
                  const hasProductionRisk = productionRiskCount > 0;

                  return (
                    <button
                      onClick={() => {
                        if (hasProductionRisk) {
                          setSmartFilter(
                            smartFilter === 'production-risk'
                              ? 'none'
                              : 'production-risk',
                          );
                          setFilterType('all');
                          setShowOutdatedOnly(false);
                          setShowVulnerableOnly(false);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: `1px solid ${
                          smartFilter === 'production-risk'
                            ? theme.colors.error
                            : hasProductionRisk
                              ? theme.colors.error
                              : '#10b981'
                        }`,
                        backgroundColor:
                          smartFilter === 'production-risk'
                            ? `${theme.colors.error}20`
                            : hasProductionRisk
                              ? `${theme.colors.error}15`
                              : '#10b98115',
                        color:
                          smartFilter === 'production-risk'
                            ? theme.colors.error
                            : hasProductionRisk
                              ? theme.colors.error
                              : '#10b981',
                        cursor: hasProductionRisk ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {hasProductionRisk ? (
                        <AlertTriangle size={10} />
                      ) : (
                        <Check size={10} />
                      )}
                      Production Risk{' '}
                      {hasProductionRisk && `(${productionRiskCount})`}
                    </button>
                  );
                })()}
                {smartFilter !== 'none' && (
                  <button
                    onClick={() => setSmartFilter('none')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      borderRadius: '4px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundLight,
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                    }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}

            {/* Regular Filters */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap',
                opacity: smartFilter !== 'none' ? 0.5 : 1,
                pointerEvents: smartFilter !== 'none' ? 'none' : 'auto',
              }}
            >
              {/* Type Filter */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'production', 'development', 'peer'] as const).map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        border: `1px solid ${filterType === type ? theme.colors.primary : theme.colors.border}`,
                        backgroundColor:
                          filterType === type
                            ? `${theme.colors.primary}20`
                            : theme.colors.backgroundSecondary,
                        color:
                          filterType === type
                            ? theme.colors.primary
                            : theme.colors.text,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {type === 'all'
                        ? 'All'
                        : type.charAt(0).toUpperCase() + type.slice(1)}
                      {type !== 'all' && (
                        <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                          (
                          {
                            dependencyItems.filter(
                              (d) => d.dependencyType === type,
                            ).length
                          }
                          )
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>

              {/* Outdated Filter - Only show when analyzed */}
              {isAnalyzed && (
                <button
                  onClick={() => setShowOutdatedOnly(!showOutdatedOnly)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: `1px solid ${showOutdatedOnly ? theme.colors.warning : theme.colors.border}`,
                    backgroundColor: showOutdatedOnly
                      ? `${theme.colors.warning}20`
                      : theme.colors.backgroundSecondary,
                    color: showOutdatedOnly
                      ? theme.colors.warning
                      : theme.colors.text,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Filter size={10} />
                  Outdated Only (
                  {dependencyItems.filter((d) => d.isOutdated).length})
                </button>
              )}

              {/* Vulnerable Filter - Only show when analyzed */}
              {isAnalyzed && (
                <button
                  onClick={() => setShowVulnerableOnly(!showVulnerableOnly)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: `1px solid ${showVulnerableOnly ? theme.colors.error : theme.colors.border}`,
                    backgroundColor: showVulnerableOnly
                      ? `${theme.colors.error}20`
                      : theme.colors.backgroundSecondary,
                    color: showVulnerableOnly
                      ? theme.colors.error
                      : theme.colors.text,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertTriangle size={10} />
                  Vulnerable (
                  {
                    dependencyItems.filter(
                      (d) => d.vulnerabilities && d.vulnerabilities.length > 0,
                    ).length
                  }
                  )
                </button>
              )}

              {/* Results Count */}
              <div
                style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                }}
              >
                Showing {filteredDependencies.length} of{' '}
                {dependencyItems.length} dependencies
              </div>
            </div>

            {/* Selection Actions Bar - Only show when analyzed */}
            {isAnalyzed && selectedDependencies.size > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: `${theme.colors.primary}10`,
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.primary}30`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: theme.colors.text,
                      fontWeight: 500,
                    }}
                  >
                    {selectedDependencies.size} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      borderRadius: '4px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.background,
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
                <button
                  onClick={generateUpdatePrompt}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: theme.colors.primary,
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Copy size={14} />
                  Copy Update Prompt
                </button>
              </div>
            )}

            {/* Quick Actions for Outdated Dependencies - Only show when analyzed */}
            {isAnalyzed &&
              filteredDependencies.filter((d) => d.isOutdated).length > 0 &&
              selectedDependencies.size === 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <button
                    onClick={selectAllOutdated}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      borderRadius: '4px',
                      border: `1px solid ${theme.colors.primary}`,
                      backgroundColor: `${theme.colors.primary}10`,
                      color: theme.colors.primary,
                      cursor: 'pointer',
                    }}
                  >
                    Select All Outdated (
                    {filteredDependencies.filter((d) => d.isOutdated).length})
                  </button>
                </div>
              )}

            {/* Update Prompt Copied Notification */}
            {showUpdatePrompt && (
              <div
                style={{
                  position: 'fixed',
                  top: '20px',
                  right: '20px',
                  padding: '12px 16px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Check size={16} />
                Update prompt copied to clipboard
              </div>
            )}
          </div>

          {/* Dependency List */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '4px',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            {filteredDependencies.map((dep) => {
              const depKey = `${dep.name}-${dep.dependencyType}`;
              const isSelected = selectedDependencies.has(depKey);
              const isClickable = isAnalyzed && dep.isOutdated;

              return (
                <div
                  key={depKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: isSelected
                      ? `${theme.colors.primary}10`
                      : theme.colors.background,
                    borderRadius: '4px',
                    fontSize: '12px',
                    border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                    transition: 'all 0.2s',
                    cursor: isClickable ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (isClickable) {
                      toggleDependencySelection(depKey);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && isClickable) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundLight;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && isClickable) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.background;
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }
                  }}
                >
                  {/* Selection indicator and Package name */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {isAnalyzed && dep.isOutdated && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDependencySelection(depKey);
                        }}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                        }}
                      >
                        {isSelected ? (
                          <CheckCircle2
                            size={18}
                            color={theme.colors.primary}
                            fill={`${theme.colors.primary}20`}
                          />
                        ) : (
                          <Circle
                            size={18}
                            color={theme.colors.textSecondary}
                            style={{ opacity: 0.5 }}
                          />
                        )}
                      </div>
                    )}
                    <span
                      style={{
                        fontWeight: 500,
                        color: isAnalyzed
                          ? dep.isOutdated
                            ? theme.colors.text
                            : '#10b981'
                          : theme.colors.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {dep.name}
                    </span>
                    <span
                      style={getDependencyTypeBadgeStyle(dep.dependencyType)}
                    >
                      {dep.dependencyType === 'production'
                        ? 'prod'
                        : dep.dependencyType === 'development'
                          ? 'dev'
                          : 'peer'}
                    </span>
                  </div>

                  {/* Version and status */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {/* Version info */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span style={{ color: theme.colors.textSecondary }}>
                        {dep.currentVersion}
                      </span>
                      {dep.isOutdated && dep.latestVersion && (
                        <>
                          <span style={{ color: theme.colors.textSecondary }}>
                            →
                          </span>
                          <span
                            style={{
                              fontWeight: 500,
                              color:
                                dep.updateType === 'major'
                                  ? theme.colors.error
                                  : dep.updateType === 'minor'
                                    ? theme.colors.warning
                                    : '#10b981',
                            }}
                          >
                            {dep.latestVersion}
                          </span>
                          <span style={getUpdateBadgeStyle(dep.updateType)}>
                            {dep.updateType}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Vulnerability badges */}
                    {dep.vulnerabilities && dep.vulnerabilities.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <AlertTriangle size={12} color={theme.colors.error} />
                        <span
                          style={{
                            fontSize: '11px',
                            color: theme.colors.error,
                          }}
                        >
                          {dep.vulnerabilities.length}
                        </span>
                        {(() => {
                          // Find highest severity
                          const severities = [
                            'critical',
                            'high',
                            'moderate',
                            'low',
                          ];
                          const highestSeverity = dep.vulnerabilities.reduce(
                            (highest, vuln) => {
                              const currentIndex = severities.indexOf(
                                vuln.severity,
                              );
                              const highestIndex = severities.indexOf(highest);
                              return currentIndex < highestIndex
                                ? vuln.severity
                                : highest;
                            },
                            'low',
                          );
                          return (
                            <span
                              style={getSeverityBadgeStyle(highestSeverity)}
                            >
                              {highestSeverity}
                            </span>
                          );
                        })()}
                      </div>
                    )}

                    {/* Deprecated badge */}
                    {dep.isDeprecated && (
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 500,
                          backgroundColor: `${theme.colors.error}20`,
                          color: theme.colors.error,
                        }}
                      >
                        deprecated
                      </span>
                    )}

                    {/* License badge */}
                    {dep.license && (
                      <span style={getLicenseBadgeStyle(dep.licenseType)}>
                        {dep.license}
                      </span>
                    )}

                    {/* NPM link */}
                    <a
                      href={`https://www.npmjs.com/package/${dep.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundLight;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="View on npm"
                    >
                      <ExternalLink
                        size={12}
                        color={theme.colors.textSecondary}
                      />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add animation styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>

      {/* Info Modal */}
      <DependencyInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />
    </div>
  );
};
