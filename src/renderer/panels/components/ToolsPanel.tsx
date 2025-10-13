import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Wrench,
  Package,
  CheckCircle,
  XCircle,
  FileCode,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Play,
  Loader,
  X,
  Info,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { Theme } from '@a24z/industry-theme';
import type {
  PackageLayer,
  ConfigFile,
  PackageCommand,
} from '@principal-ai/codebase-composition';
import type { HighlightLayer } from '@principal-ai/code-city-react';
import type { LensResult } from '@principal-ai/codebase-quality-lenses';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import type {
  ToolExecutionRequest,
  ToolExecutionResponse,
} from '../../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

interface ToolsPanelProps {
  packageLayers?: PackageLayer[] | null;
  repositoryPath: string;
  onHighlightLayersChange?: (layers: HighlightLayer[]) => void;
}

interface ToolInfo {
  name: string;
  category:
    | 'linting'
    | 'testing'
    | 'types'
    | 'formatting'
    | 'documentation'
    | 'deadCode'
    | 'build'
    | 'other';
  hasConfig: boolean;
  configFile?: ConfigFile;
  isInstalled: boolean;
  version?: string;
  commands: string[];
  packageCommands: PackageCommand[]; // Full command objects for execution
}

interface PackageToolsInfo {
  packagePath: string;
  packageName: string;
  tools: ToolInfo[];
  summary: {
    totalTools: number;
    configuredTools: number;
    installedTools: number;
  };
}

// Map config keys to tool names and categories
const TOOL_MAPPING: Record<
  string,
  { displayName: string; category: ToolInfo['category'] }
> = {
  eslint: { displayName: 'ESLint', category: 'linting' },
  prettier: { displayName: 'Prettier', category: 'formatting' },
  typescript: { displayName: 'TypeScript', category: 'types' },
  jest: { displayName: 'Jest', category: 'testing' },
  vitest: { displayName: 'Vitest', category: 'testing' },
  webpack: { displayName: 'Webpack', category: 'build' },
  vite: { displayName: 'Vite', category: 'build' },
  rollup: { displayName: 'Rollup', category: 'build' },
  babel: { displayName: 'Babel', category: 'build' },
  knip: { displayName: 'Knip', category: 'deadCode' },

  // Python tools
  pytest: { displayName: 'Pytest', category: 'testing' },
  flake8: { displayName: 'Flake8', category: 'linting' },
  mypy: { displayName: 'MyPy', category: 'types' },
  black: { displayName: 'Black', category: 'formatting' },
  ruff: { displayName: 'Ruff', category: 'linting' },
  pylint: { displayName: 'PyLint', category: 'linting' },

  // Rust tools
  rustfmt: { displayName: 'Rustfmt', category: 'formatting' },
  clippy: { displayName: 'Clippy', category: 'linting' },
};

const CATEGORY_COLORS: Record<ToolInfo['category'], string> = {
  linting: '#f59e0b', // amber
  testing: '#10b981', // emerald
  types: '#3b82f6', // blue
  formatting: '#a855f7', // purple
  documentation: '#06b6d4', // cyan
  deadCode: '#ef4444', // red
  build: '#6b7280', // gray
  other: '#9ca3af', // gray-400
};

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  packageLayers,
  repositoryPath,
  onHighlightLayersChange,
}) => {
  const { theme } = useTheme();
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [runningTools, setRunningTools] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [toolResults, setToolResults] = useState<
    Map<string, ToolExecutionResponse>
  >(new Map());
  const [showingResult, setShowingResult] = useState<string | null>(null);

  // Process package layers to extract tool information
  const packageTools = useMemo(() => {
    if (!packageLayers) return [];

    return packageLayers.map((layer): PackageToolsInfo => {
      const tools: ToolInfo[] = [];
      const deps = {
        ...layer.packageData.dependencies,
        ...layer.packageData.devDependencies,
      };

      // Check each known tool
      Object.entries(TOOL_MAPPING).forEach(([toolKey, toolInfo]) => {
        const configFile = layer.configFiles?.[toolKey];
        const isInstalled = !!(
          deps[toolKey] ||
          // Check for scoped packages
          Object.keys(deps).some((dep) => dep.includes(toolKey))
        );

        // Find related commands
        const packageCommands =
          layer.packageData.availableCommands?.filter(
            (cmd) =>
              cmd.lensId === toolKey ||
              cmd.name.includes(toolKey) ||
              cmd.command.includes(toolKey),
          ) || [];

        const commands = packageCommands.map((cmd) => cmd.name);

        // Only include if tool is configured or installed
        if (configFile || isInstalled || commands.length > 0) {
          tools.push({
            name: toolInfo.displayName,
            category: toolInfo.category,
            hasConfig: !!configFile,
            configFile,
            isInstalled,
            version: deps[toolKey] || deps[`@types/${toolKey}`],
            commands,
            packageCommands,
          });
        }
      });

      // Check for additional tools in scripts that might not be in our mapping
      layer.packageData.availableCommands?.forEach((cmd) => {
        if (cmd.isLensCommand && cmd.lensId) {
          // Check if we already have this tool
          if (!tools.some((t) => t.name.toLowerCase() === cmd.lensId)) {
            tools.push({
              name: cmd.lensId,
              category: 'other',
              hasConfig: false,
              isInstalled: false,
              commands: [cmd.name],
              packageCommands: [cmd],
            });
          }
        }
      });

      return {
        packagePath: layer.packageData.path || '',
        packageName: layer.packageData.name,
        tools,
        summary: {
          totalTools: tools.length,
          configuredTools: tools.filter((t) => t.hasConfig).length,
          installedTools: tools.filter((t) => t.isInstalled).length,
        },
      };
    });
  }, [packageLayers]);

  // Update highlight layers when results change
  useEffect(() => {
    if (!onHighlightLayersChange) {
      console.info('[ToolsTab] No onHighlightLayersChange callback provided');
      return;
    }

    // Create highlight layers for all packages with results
    const allLayers: HighlightLayer[] = [];

    packageTools.forEach((pkg) => {
      const packageResults = new Map<string, ToolExecutionResponse>();

      // Collect all results for this package
      toolResults.forEach((result, key) => {
        // For root packages, packagePath might be empty string
        const keyPrefix = pkg.packagePath ? `${pkg.packagePath}:` : ':';
        if (
          key.startsWith(keyPrefix) ||
          (pkg.packagePath === '' && key.startsWith(':'))
        ) {
          console.info(
            `[ToolsTab] Found result for package "${pkg.packagePath}":`,
            key,
          );
          packageResults.set(key, result);
        }
      });

      if (packageResults.size > 0) {
        const layers = createHighlightLayersFromLensResults(
          packageResults,
          pkg.packagePath,
        );
        console.info(
          `[ToolsTab] Created ${layers.length} layers for package ${pkg.packagePath}`,
        );
        allLayers.push(...layers);
      }
    });

    console.info(
      `[ToolsTab] Calling onHighlightLayersChange with ${allLayers.length} total layers`,
    );
    onHighlightLayersChange(allLayers);
  }, [toolResults, packageTools, onHighlightLayersChange]);

  const togglePackage = (packagePath: string) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(packagePath)) {
        next.delete(packagePath);
      } else {
        next.add(packagePath);
      }
      return next;
    });
  };

  const runTool = useCallback(
    async (
      packagePath: string,
      packageCommand: PackageCommand,
      toolName: string,
    ) => {
      // Use command name for key
      const key = `${packagePath}:${packageCommand.name}`;

      console.info(
        `[ToolsTab] Running tool: ${toolName} with command: ${packageCommand.command} in package: ${packagePath}`,
      );

      // Mark tool as running
      setRunningTools((prev) => new Map(prev).set(key, true));
      setShowingResult(null);

      try {
        // Find the PackageLayer for this package
        const packageLayer = packageLayers?.find(
          (layer) => (layer.packageData.path || '') === packagePath,
        );

        // Validate that we have the required data
        if (!packageLayer || !packageCommand) {
          throw new Error(
            'PackageLayer and PackageCommand are required to execute tools',
          );
        }

        console.info(
          `[ToolsTab] Executing tool with lensId: ${packageCommand.lensId}`,
        );

        const request: ToolExecutionRequest = {
          repoPath: repositoryPath,
          packageLayer,
          packageCommand,
        };

        const result = await RepositoryMonitoringService.executeTool(request);

        if (result) {
          console.info(
            `[ToolsTab] Tool execution result for key "${key}":`,
            result,
          );
          if (result.qualityContext) {
            console.info(
              `[ToolsTab] Quality context:`,
              result.qualityContext,
            );
          }
          setToolResults((prev) => {
            const newMap = new Map(prev);
            newMap.set(key, result);
            console.info(
              `[ToolsTab] Stored result with key "${key}", total results: ${newMap.size}`,
            );
            return newMap;
          });

          // Show result modal for any execution (success or failure) to display output
          setShowingResult(key);
        } else {
          console.info(`[ToolsTab] No result returned from tool execution`);
        }
      } catch (error) {
        console.error('Error running tool:', error);
      } finally {
        setRunningTools((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [repositoryPath, packageLayers],
  );

  if (!packageLayers || packageLayers.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: theme.colors.textSecondary,
        }}
      >
        <Package size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
        <div style={{ fontSize: 16, marginBottom: 8 }}>No packages found</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          Package information will appear here once loaded
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Add CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
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
              gap: 8,
            }}
          >
            <Wrench size={16} color={theme.colors.primary} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Development Tools
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: theme.colors.textSecondary,
            }}
          >
            {packageTools.length} package{packageTools.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Package list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
        }}
      >
        {packageTools.map((pkg) => {
          const isExpanded = expandedPackages.has(pkg.packagePath);
          const isRoot = pkg.packagePath === '';

          return (
            <div
              key={pkg.packagePath || 'root'}
              style={{
                marginBottom: 16,
                borderRadius: 8,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                overflow: 'hidden',
              }}
            >
              {/* Package header */}
              <div
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isExpanded
                    ? theme.colors.background
                    : 'transparent',
                  transition: 'background-color 0.2s',
                }}
                onClick={() => togglePackage(pkg.packagePath)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isExpanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  <Package size={16} color={theme.colors.primary} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {pkg.packageName}
                  </span>
                  {isRoot && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: `${theme.colors.primary}20`,
                        color: theme.colors.primary,
                      }}
                    >
                      ROOT
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: theme.colors.textSecondary }}>
                    {pkg.summary.totalTools} tool
                    {pkg.summary.totalTools !== 1 ? 's' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color:
                          pkg.summary.configuredTools > 0
                            ? theme.colors.success
                            : theme.colors.textSecondary,
                      }}
                    >
                      <FileCode size={12} />
                      {pkg.summary.configuredTools}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color:
                          pkg.summary.installedTools > 0
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                      }}
                    >
                      <CheckCircle size={12} />
                      {pkg.summary.installedTools}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tool details */}
              {isExpanded && (
                <div
                  style={{
                    padding: '0 16px 16px',
                    borderTop: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {pkg.tools.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: theme.colors.textSecondary,
                        fontSize: 13,
                      }}
                    >
                      No tools detected in this package
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 12,
                        marginTop: 12,
                      }}
                    >
                        {pkg.tools.map((tool) => (
                          <div
                            key={`${pkg.packagePath || 'root'}-${tool.name}`}
                            style={{
                              padding: 12,
                            borderRadius: 6,
                            backgroundColor: theme.colors.background,
                            border: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          {/* Tool header */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor:
                                    CATEGORY_COLORS[tool.category],
                                }}
                              />
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: 13,
                                }}
                              >
                                {tool.name}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {tool.hasConfig && (
                                <FileCode
                                  size={14}
                                  color={theme.colors.success}
                                  title="Has configuration file"
                                />
                              )}
                              {tool.isInstalled ? (
                                <CheckCircle
                                  size={14}
                                  color={theme.colors.primary}
                                  title="Installed"
                                />
                              ) : (
                                <XCircle
                                  size={14}
                                  color={theme.colors.textSecondary}
                                  title="Not installed"
                                />
                              )}
                            </div>
                          </div>

                          {/* Tool details */}
                          <div
                            style={{
                              fontSize: 11,
                              color: theme.colors.textSecondary,
                            }}
                          >
                            {/* Category */}
                            <div style={{ marginBottom: 4 }}>
                              Category:{' '}
                              <span
                                style={{
                                  color: CATEGORY_COLORS[tool.category],
                                }}
                              >
                                {tool.category}
                              </span>
                            </div>

                            {/* Version */}
                            {tool.version && (
                              <div style={{ marginBottom: 4 }}>
                                Version: {tool.version}
                              </div>
                            )}

                            {/* Config file */}
                            {tool.configFile && (
                              <div style={{ marginBottom: 4 }}>
                                Config: {tool.configFile.path.split('/').pop()}
                              </div>
                            )}

                            {/* Commands */}
                            {tool.packageCommands.length > 0 && (
                              <div
                                style={{
                                  marginTop: 6,
                                  paddingTop: 6,
                                  borderTop: `1px solid ${theme.colors.border}`,
                                }}
                              >
                                <div style={{ marginBottom: 4 }}>Scripts:</div>
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                  }}
                                >
                                  {tool.packageCommands.map((cmd) => {
                                    const key = `${pkg.packagePath}:${cmd.name}`;
                                    const isRunning = runningTools.get(key);
                                    const result = toolResults.get(key);
                                    const isShowingResult =
                                      showingResult === key;

                                    return (
                                      <div key={cmd.name}>
                                        <button
                                          title={`Run: ${cmd.command}`}
                                          style={{
                                            width: '100%',
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            backgroundColor: isRunning
                                              ? `${theme.colors.primary}30`
                                              : result?.success === false
                                                ? `${theme.colors.error}15`
                                                : result?.success === true
                                                  ? `${theme.colors.success}15`
                                                  : `${theme.colors.primary}10`,
                                            border: `1px solid ${
                                              isRunning
                                                ? theme.colors.primary
                                                : result?.success === false
                                                  ? theme.colors.error
                                                  : result?.success === true
                                                    ? theme.colors.success
                                                    : theme.colors.border
                                            }`,
                                            fontFamily: theme.fonts.monospace,
                                            fontSize: 11,
                                            cursor: isRunning
                                              ? 'wait'
                                              : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'all 0.2s ease',
                                          }}
                                          onClick={() =>
                                            !isRunning &&
                                            runTool(
                                              pkg.packagePath,
                                              cmd,
                                              tool.name,
                                            )
                                          }
                                          disabled={isRunning}
                                        >
                                          <span
                                            style={{
                                              opacity: isRunning ? 0.6 : 1,
                                            }}
                                          >
                                            {cmd.name}
                                          </span>
                                          {isRunning ? (
                                            <Loader
                                              size={12}
                                              style={{
                                                animation:
                                                  'spin 1s linear infinite',
                                              }}
                                            />
                                          ) : result ? (
                                            result.success ? (
                                              <CheckCircle
                                                size={12}
                                                color={theme.colors.success}
                                              />
                                            ) : (
                                              <AlertCircle
                                                size={12}
                                                color={theme.colors.error}
                                              />
                                            )
                                          ) : (
                                            <Play size={12} />
                                          )}
                                        </button>

                                        {/* Show result output on failure */}
                                        {result && isShowingResult && (
                                          <div
                                            style={{
                                              marginTop: 4,
                                              padding: 8,
                                              borderRadius: 4,
                                              backgroundColor:
                                                theme.colors
                                                  .backgroundSecondary,
                                              border: `1px solid ${theme.colors.border}`,
                                              fontSize: 10,
                                              fontFamily: theme.fonts.monospace,
                                              maxHeight: 200,
                                              overflow: 'auto',
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 4,
                                              }}
                                            >
                                              <span
                                                style={{
                                                  color: theme.colors.error,
                                                }}
                                              >
                                                Exit code: {result.exitCode}
                                              </span>
                                              <button
                                                onClick={() =>
                                                  setShowingResult(null)
                                                }
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  padding: 2,
                                                }}
                                              >
                                                <X size={12} />
                                              </button>
                                            </div>
                                            {result.stderr && (
                                              <div
                                                style={{
                                                  color: theme.colors.error,
                                                  whiteSpace: 'pre-wrap',
                                                }}
                                              >
                                                {result.stderr}
                                              </div>
                                            )}
                                            {/* Display lens result stats if available */}
                                            {result.lensResult && (
                                              <div style={{ marginTop: 8 }}>
                                                {renderLensResultStats(
                                                  result.lensResult,
                                                  theme,
                                                )}
                                              </div>
                                            )}
                                            {/* Display raw output if no lens result */}
                                            {!result.lensResult &&
                                              result.stdout && (
                                                <div
                                                  style={{
                                                    whiteSpace: 'pre-wrap',
                                                    marginTop: 4,
                                                  }}
                                                >
                                                  {result.stdout}
                                                </div>
                                              )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          fontSize: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            color: theme.colors.textSecondary,
          }}
        >
          <span>
            Total Tools:{' '}
            {packageTools.reduce((sum, p) => sum + p.summary.totalTools, 0)}
          </span>
          <span>
            Configured:{' '}
            {packageTools.reduce(
              (sum, p) => sum + p.summary.configuredTools,
              0,
            )}
          </span>
          <span>
            Installed:{' '}
            {packageTools.reduce((sum, p) => sum + p.summary.installedTools, 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Render lens result statistics
 */
function renderLensResultStats(
  lensResult: LensResult,
  theme: Theme,
): React.ReactNode {
  const { issues = [], metrics = {} } = lensResult;

  // Count issues by severity
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return (
    <div
      style={{
        padding: 8,
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: 4,
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      {/* Issue summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        {errorCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={14} color={theme.colors.error} />
            <span style={{ color: theme.colors.error, fontWeight: 500 }}>
              {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
            </span>
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={14} color={theme.colors.warning} />
            <span style={{ color: theme.colors.warning, fontWeight: 500 }}>
              {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
            </span>
          </div>
        )}
        {infoCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Info size={14} color={theme.colors.info} />
            <span style={{ color: theme.colors.info, fontWeight: 500 }}>
              {infoCount} Info
            </span>
          </div>
        )}
        {issues.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle size={14} color={theme.colors.success} />
            <span style={{ color: theme.colors.success, fontWeight: 500 }}>
              No Issues Found
            </span>
          </div>
        )}
      </div>

      {/* Key metrics */}
      {Object.keys(metrics).length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            paddingTop: 8,
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          {Object.entries(metrics)
            .slice(0, 6)
            .map(([key, value]) => (
              <div
                key={key}
                style={{
                  padding: '2px 6px',
                  backgroundColor: theme.colors.background,
                  borderRadius: 3,
                  fontSize: 11,
                }}
              >
                <span style={{ color: theme.colors.textSecondary }}>
                  {key.replace(/_/g, ' ')}:
                </span>
                <span style={{ marginLeft: 4, fontWeight: 500 }}>
                  {typeof value === 'number'
                    ? value.toLocaleString()
                    : String(value)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Files with issues */}
      {issues.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: theme.colors.textSecondary,
              marginBottom: 4,
            }}
          >
            Files with issues: {new Set(issues.map((i) => i.file)).size}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Create highlight layers from lens results
 */
export function createHighlightLayersFromLensResults(
  results: Map<string, ToolExecutionResponse>,
  packagePath: string,
): HighlightLayer[] {
  const layers: HighlightLayer[] = [];

  console.info(
    `[createHighlightLayers] Processing results for packagePath: "${packagePath}"`,
  );

  results.forEach((result, key) => {
    console.info(`[createHighlightLayers] Processing result for key: ${key}`, {
      toolName: result.toolName,
      hasLensResult: !!result.lensResult,
      issuesCount: result.lensResult?.issues?.length || 0,
      success: result.lensResult?.success,
      filesAnalyzed: result.lensResult?.metrics?.filesAnalyzed,
    });

    if (result.lensResult) {
      // Check if there are issues
      if (result.lensResult.issues.length > 0) {
        // Group files by severity
        const filesWithErrors = new Set<string>();
        const filesWithWarnings = new Set<string>();

        result.lensResult.issues.forEach((issue) => {
          if (issue.file) {
            // Build the full path, handling empty packagePath
            let fullPath: string;
            if (issue.file.startsWith('/')) {
              // Already absolute
              fullPath = issue.file;
            } else if (packagePath) {
              // Has package path, prepend it
              fullPath = `${packagePath}/${issue.file}`;
            } else {
              // Root package, use relative path as-is
              fullPath = issue.file;
            }

            console.info(`[createHighlightLayers] Issue file path:`, {
              originalPath: issue.file,
              packagePath,
              fullPath,
              severity: issue.severity,
            });
            if (issue.severity === 'error') {
              filesWithErrors.add(fullPath);
            } else if (issue.severity === 'warning') {
              filesWithWarnings.add(fullPath);
            }
          }
        });

        // Create error highlight layer
        if (filesWithErrors.size > 0) {
          layers.push({
            id: `lens-errors-${key}`,
            name: `${result.toolName} Errors`,
            color: '#ff4d4f',
            opacity: 0.8,
            items: Array.from(filesWithErrors).map((path) => ({
              path,
              type: 'file' as const,
              renderStrategy: 'fill' as const,
            })),
            enabled: true,
            priority: 10,
          });
        }

        // Create warning highlight layer
        if (filesWithWarnings.size > 0) {
          layers.push({
            id: `lens-warnings-${key}`,
            name: `${result.toolName} Warnings`,
            color: '#faad14',
            opacity: 0.6,
            items: Array.from(filesWithWarnings).map((path) => ({
              path,
              type: 'file' as const,
              renderStrategy: 'fill' as const,
            })),
            enabled: true,
            priority: 5,
          });
        }
      } else if (
        result.lensResult.success &&
        result.lensResult.metrics?.filesAnalyzed > 0
      ) {
        // Create success layer for clean code
        const filesAnalyzed = result.lensResult.metrics.filesAnalyzed;

        // Check if we have the analyzed files list from the lens result
        const analyzedFiles = result.lensResult.analyzedFiles;

        console.info(`[createHighlightLayers] Checking for analyzedFiles:`, {
          hasAnalyzedFiles: !!analyzedFiles,
          analyzedFilesLength: analyzedFiles?.length,
          lensResultKeys: Object.keys(result.lensResult || {}),
          sampleAnalyzedFile: analyzedFiles?.[0],
        });

        let items: Array<{ path: string; type: 'file' | 'directory' }> = [];

        if (analyzedFiles && analyzedFiles.length > 0) {
          // We have the actual file list - use it!
          console.info(
            `[createHighlightLayers] Using ${analyzedFiles.length} analyzed files for success layer`,
          );

          items = analyzedFiles.map((file) => ({
            path: file.path,
            type: 'file' as const,
            renderStrategy: 'fill' as const,
          }));

          console.info(
            `[createHighlightLayers] Created ${items.length} file items, first few:`,
            items.slice(0, 3),
          );
        } else {
          // Fallback to highlighting the whole package
          const highlightPath = packagePath || '';
          console.info(
            `[createHighlightLayers] No file list, highlighting package: "${highlightPath}"`,
          );

          items = [
            {
              path: highlightPath,
              type: 'directory' as const,
              renderStrategy: 'fill' as const,
            },
          ];
        }

        console.info(`[createHighlightLayers] Creating success layer:`, {
          toolName: result.toolName,
          filesAnalyzed,
          packagePath,
          itemsCount: items.length,
          layerId: `lens-success-${key}`,
        });

        const layer = {
          id: `lens-success-${key}`,
          name: `${result.toolName} ✓ (${filesAnalyzed} files clean)`,
          color: '#10b981', // Green for success
          opacity: 0.5,
          items,
          enabled: true,
          priority: 3,
        };

        console.info(`[createHighlightLayers] Final layer:`, {
          id: layer.id,
          name: layer.name,
          itemsCount: layer.items.length,
          firstFewItems: layer.items.slice(0, 3),
        });

        layers.push(layer);
      }
    }
  });

  return layers;
}
