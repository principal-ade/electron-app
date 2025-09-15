import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';

interface PackageInfo {
  path: string;
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  pythonTool?: 'pip' | 'poetry' | 'pipenv' | 'conda';
}

interface DependencyLayer {
  name: string;
  packageName: string;
  files: string[];
  color: string;
  enabled: boolean;
  loading?: boolean;
  usedBy?: string[];
  versions?: { [packageName: string]: string };
}

interface DependenciesViewProps {
  packageDirs: PackageInfo[];
  workingDirectory: string;
  enabledLayers: Set<string>;
  onToggleLayer: (layerId: string) => void;
  onDependencyFilesFound?: (depName: string, files: string[]) => void;
  onAnalyzePackage?: (pkg: PackageInfo) => void;
}

export const DependenciesView: React.FC<DependenciesViewProps> = ({
  packageDirs,
  workingDirectory,
  enabledLayers,
  onToggleLayer,
  onDependencyFilesFound,
  onAnalyzePackage,
}) => {
  const { theme } = useTheme();
  const [dependencyLayers, setDependencyLayers] = useState<DependencyLayer[]>(
    [],
  );
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [searchingDep, setSearchingDep] = useState<string | null>(null);
  const [dependencyViewMode, setDependencyViewMode] = useState<
    'flat' | 'byPackage'
  >('byPackage');

  useEffect(() => {
    analyzeDependencies();
  }, [packageDirs]);

  const analyzeDependencies = async () => {
    setLoadingDependencies(true);
    const depLayers: DependencyLayer[] = [];

    try {
      // Collect all unique dependencies from all packages
      const allDependencies = new Map<
        string,
        {
          packages: Set<string>;
          versions: Map<string, string>;
        }
      >();

      packageDirs.forEach((pkg) => {
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.peerDependencies,
        };

        Object.entries(deps).forEach(([depName, version]) => {
          if (!allDependencies.has(depName)) {
            allDependencies.set(depName, {
              packages: new Set(),
              versions: new Map(),
            });
          }

          const depInfo = allDependencies.get(depName)!;
          depInfo.packages.add(pkg.name);
          depInfo.versions.set(pkg.name, version);
        });
      });

      // Create dependency layers
      allDependencies.forEach((depInfo, depName) => {
        depLayers.push({
          name: depName,
          packageName: depName,
          files: [], // Will be populated when enabled
          color: getColorForDependency(depName),
          enabled: false,
          usedBy: Array.from(depInfo.packages),
          versions: Object.fromEntries(depInfo.versions),
        });
      });

      // Sort by usage count
      depLayers.sort(
        (a, b) => (b.usedBy?.length || 0) - (a.usedBy?.length || 0),
      );

      setDependencyLayers(depLayers);
    } catch (error) {
      console.error('Failed to analyze dependencies:', error);
    } finally {
      setLoadingDependencies(false);
    }
  };

  const getColorForDependency = (depName: string): string => {
    // Use a hash function to generate consistent colors
    let hash = 0;
    for (let i = 0; i < depName.length; i++) {
      hash = depName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  const searchDependencyFiles = async (dep: DependencyLayer) => {
    if (dep.loading || dep.files.length > 0) return;

    setSearchingDep(dep.packageName);

    // Update the dependency to show loading state
    setDependencyLayers((prev) =>
      prev.map((d) =>
        d.packageName === dep.packageName ? { ...d, loading: true } : d,
      ),
    );

    try {
      // Create search patterns for different import styles
      const patterns = [
        `import.*from\\s+['"]${dep.packageName}['"]`,
        `require\\s*\\(\\s*['"]${dep.packageName}['"]\\s*\\)`,
        `from\\s+${dep.packageName}\\s+import`, // Python
      ];

      const allFiles = new Set<string>();

      // Search for each pattern using shell command (similar to working implementation)
      for (const pattern of patterns) {
        try {
          // Use grep command to search for patterns in JavaScript/TypeScript files
          const grepCommand = `grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.mjs" --include="*.cjs" -l "${pattern}" . 2>/dev/null || true`;

          const result = await window.mainProcess.shell.runCommand(grepCommand, {
            cwd: workingDirectory,
          });

          if (result && result.output) {
            // Parse the output lines as file paths
            const lines = result.output
              .trim()
              .split('\n')
              .filter((line: string) => line.length > 0);
            lines.forEach((filePath: string) => {
              // Remove leading ./ if present
              const cleanPath = filePath.startsWith('./')
                ? filePath.substring(2)
                : filePath;
              if (cleanPath) {
                allFiles.add(cleanPath);
              }
            });
          }
        } catch (error) {
          console.warn(`Failed to search for pattern ${pattern}:`, error);
        }
      }

      const files = Array.from(allFiles);

      // Update the dependency with found files
      setDependencyLayers((prev) =>
        prev.map((d) =>
          d.packageName === dep.packageName
            ? { ...d, files, loading: false, enabled: true }
            : d,
        ),
      );

      // Notify parent
      if (onDependencyFilesFound) {
        onDependencyFilesFound(dep.packageName, files);
      }
    } catch (error) {
      console.error(`Failed to search files for ${dep.packageName}:`, error);
      setDependencyLayers((prev) =>
        prev.map((d) =>
          d.packageName === dep.packageName ? { ...d, loading: false } : d,
        ),
      );
    } finally {
      setSearchingDep(null);
    }
  };

  const toggleDependency = async (dep: DependencyLayer) => {
    const layerId = `dep-layer-${dep.packageName}`;

    if (!dep.enabled && dep.files.length === 0) {
      // Need to search for files first
      await searchDependencyFiles(dep);
    } else {
      // Just toggle the enabled state
      setDependencyLayers((prev) =>
        prev.map((d) =>
          d.packageName === dep.packageName ? { ...d, enabled: !d.enabled } : d,
        ),
      );
    }

    onToggleLayer(layerId);
  };

  const hasVersionConflict = (dep: DependencyLayer): boolean => {
    if (!dep.versions) return false;
    const uniqueVersions = new Set(Object.values(dep.versions));
    return uniqueVersions.size > 1;
  };

  if (loadingDependencies) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: theme.colors.textSecondary,
        }}
      >
        Loading dependencies...
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: theme.colors.text,
          }}
        >
          Dependencies
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '13px',
              color: theme.colors.textSecondary,
            }}
          >
            {dependencyLayers.length} dependencies
          </span>
          <div
            style={{
              display: 'flex',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '4px',
              padding: '2px',
            }}
          >
            <button
              onClick={() => setDependencyViewMode('flat')}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor:
                  dependencyViewMode === 'flat'
                    ? theme.colors.primary
                    : 'transparent',
                color:
                  dependencyViewMode === 'flat' ? 'white' : theme.colors.text,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              All
            </button>
            <button
              onClick={() => setDependencyViewMode('byPackage')}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor:
                  dependencyViewMode === 'byPackage'
                    ? theme.colors.primary
                    : 'transparent',
                color:
                  dependencyViewMode === 'byPackage'
                    ? 'white'
                    : theme.colors.text,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              By Package
            </button>
          </div>
        </div>
      </div>

      {dependencyViewMode === 'flat' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {dependencyLayers.map((dep) => {
            const layerId = `dep-layer-${dep.packageName}`;
            const isEnabled = enabledLayers.has(layerId) || dep.enabled;

            return (
              <div
                key={dep.packageName}
                onClick={() => toggleDependency(dep)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  backgroundColor: theme.colors.backgroundLight,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  opacity: isEnabled ? 1 : 0.8,
                  border: `2px solid ${isEnabled ? dep.color : 'transparent'}`,
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: dep.color,
                    marginRight: '10px',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: theme.colors.text,
                    }}
                  >
                    {dep.name}
                    {hasVersionConflict(dep) && (
                      <span
                        style={{
                          marginLeft: '8px',
                          padding: '1px 4px',
                          backgroundColor: '#ff980050',
                          color: '#ff9800',
                          borderRadius: '3px',
                          fontSize: '10px',
                        }}
                      >
                        version conflict
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      marginTop: '2px',
                    }}
                  >
                    Used by {dep.usedBy?.length || 0} package
                    {(dep.usedBy?.length || 0) !== 1 ? 's' : ''}
                    {dep.files.length > 0 &&
                      ` • ${dep.files.length} file${dep.files.length !== 1 ? 's' : ''}`}
                  </div>
                </div>
                {dep.loading && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.primary,
                    }}
                  >
                    Searching...
                  </div>
                )}
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '3px',
                    border: `2px solid ${isEnabled ? dep.color : theme.colors.border}`,
                    backgroundColor: isEnabled ? dep.color : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '8px',
                  }}
                >
                  {isEnabled && !dep.loading && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3 6L9 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {packageDirs.map((pkg) => {
            const pkgDeps = dependencyLayers.filter((dep) =>
              dep.usedBy?.includes(pkg.name),
            );

            if (pkgDeps.length === 0) return null;

            return (
              <div key={pkg.path}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: theme.colors.text,
                    marginBottom: '6px',
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
                    {pkg.name}
                    <span
                      style={{
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        fontWeight: 'normal',
                      }}
                    >
                      {pkgDeps.length} dependencies
                    </span>
                  </div>
                  {onAnalyzePackage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalyzePackage(pkg);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        backgroundColor: theme.colors.primary,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span style={{ fontSize: '10px' }}>🔍</span>
                      Analyze
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    paddingLeft: '12px',
                  }}
                >
                  {pkgDeps.map((dep) => {
                    const layerId = `dep-layer-${dep.packageName}`;
                    const isEnabled = enabledLayers.has(layerId) || dep.enabled;
                    const version = dep.versions?.[pkg.name];

                    return (
                      <div
                        key={dep.packageName}
                        onClick={() => toggleDependency(dep)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          backgroundColor: theme.colors.backgroundLight,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          opacity: isEnabled ? 1 : 0.8,
                        }}
                      >
                        <div
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: dep.color,
                            marginRight: '8px',
                          }}
                        />
                        <span style={{ flex: 1, color: theme.colors.text }}>
                          {dep.name}
                        </span>
                        {version && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: theme.colors.textSecondary,
                              fontFamily: 'monospace',
                            }}
                          >
                            {version}
                          </span>
                        )}
                        {dep.loading && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: theme.colors.primary,
                              marginLeft: '8px',
                            }}
                          >
                            ...
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
