import React, { useState, useEffect, useCallback } from 'react';
import {
  QualityHexagonCompact,
  QualityHexagonDetailed,
} from '@principal-ai/agent-monitoring-ui';
import { useTheme } from '@a24z/industry-theme';
import { Grid2x2, RefreshCw } from 'lucide-react';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { PackageSummary } from '../../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

interface QualityHexagonPanelProps {
  directory: string;
  compact?: boolean;
}

export const QualityHexagonPanel: React.FC<QualityHexagonPanelProps> = ({
  directory,
  compact = false,
}) => {
  const { theme } = useTheme();
  const [packages, setPackages] = useState<PackageLayer[]>([]);
  const [summary, setSummary] = useState<PackageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rerunningPackages, setRerunningPackages] = useState<Set<string>>(
    new Set(),
  );

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.info('[QualityHexagon] Fetching packages for:', directory);
      const result = await RepositoryMonitoringService.getPackages(directory);

      if (result) {
        console.info('[QualityHexagon] Packages fetched:', result);
        console.info(
          '[QualityHexagon] Quality metrics check:',
          result.packages.map((pkg) => ({
            name: pkg.packageData.name,
            hasQualityMetrics: !!pkg.qualityMetrics,
            qualityMetrics: pkg.qualityMetrics,
          })),
        );
        setPackages(result.packages);
        setSummary(result.summary);
      } else {
        setError('No package information available');
      }
    } catch (err) {
      console.error('[QualityHexagon] Failed to fetch packages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, [directory]);

  useEffect(() => {
    if (directory) {
      setPackages([]);
      setSummary(null);
      setError(null);
      fetchPackages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory]); // fetchPackages intentionally excluded to avoid infinite loop

  const rerunEnrichment = useCallback(
    async (packagePath: string) => {
      const pkgKey = packagePath || 'root';
      setRerunningPackages((prev) => new Set(prev).add(pkgKey));

      try {
        console.info(
          `[QualityHexagon] Rerunning enrichment for repository: ${directory}`,
        );
        // First refresh the repository to clear cache and re-run enrichment
        await RepositoryMonitoringService.refreshRepository(directory);

        // Then fetch the updated packages
        const result = await RepositoryMonitoringService.getPackages(directory);

        if (result) {
          console.info(
            `[QualityHexagon] Enrichment completed, ${result.packages.length} packages updated`,
          );
          setPackages(result.packages);
          setSummary(result.summary);
        }
      } catch (err) {
        console.error('[QualityHexagon] Failed to rerun enrichment:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to rerun enrichment',
        );
      } finally {
        setRerunningPackages((prev) => {
          const next = new Set(prev);
          next.delete(pkgKey);
          return next;
        });
      }
    },
    [directory],
  );

  const renderPackageInfo = (pkg: PackageLayer) => {
    const pkgPath = pkg.packageData.path || 'root';
    const isRerunning = rerunningPackages.has(pkgPath);

    return (
      <div
        key={pkgPath}
        style={{
          padding: '12px',
          background: theme.colors.background,
          borderRadius: '6px',
          marginBottom: '12px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        {/* Package Header - Name, Version, Path inline with Rerun button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              flexWrap: 'wrap',
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: theme.fontSizes[2],
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              {pkg.packageData.name || 'Unnamed Package'}
            </div>
            {pkg.packageData.version && (
              <div
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.monospace,
                }}
              >
                v{pkg.packageData.version}
              </div>
            )}
            {pkg.packageData.path && (
              <div
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.monospace,
                }}
              >
                {pkg.packageData.path}
              </div>
            )}
          </div>

          {/* Rerun Button */}
          <button
            onClick={() => rerunEnrichment(pkgPath)}
            disabled={isRerunning}
            title="Rerun quality lenses for this package"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              background: isRerunning
                ? theme.colors.backgroundSecondary
                : theme.colors.primary,
              color: isRerunning
                ? theme.colors.textSecondary
                : theme.colors.background,
              border: 'none',
              borderRadius: '4px',
              cursor: isRerunning ? 'wait' : 'pointer',
              fontSize: theme.fontSizes[0],
              fontWeight: 500,
              opacity: isRerunning ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            <RefreshCw
              size={12}
              style={{
                animation: isRerunning ? 'spin 1s linear infinite' : 'none',
              }}
            />
            {isRerunning ? 'Running...' : 'Rerun'}
          </button>
        </div>

        {/* Quality Hexagon Visualization */}
        {pkg.qualityMetrics?.hexagon && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '16px',
                marginBottom: '12px',
              }}
            >
              {(() => {
                // Log what we're receiving from the composition package
                console.info('[QualityHexagon] Rendering hexagon for:', pkg.packageData.name);
                console.info('[QualityHexagon] Raw hexagon data:', pkg.qualityMetrics.hexagon);

                // Convert Partial<QualityMetrics> to full QualityMetrics with defaults
                const fullMetrics = {
                  tests: pkg.qualityMetrics.hexagon.tests ?? 0,
                  deadCode: pkg.qualityMetrics.hexagon.deadCode ?? 0,
                  linting: pkg.qualityMetrics.hexagon.linting ?? 0,
                  formatting: pkg.qualityMetrics.hexagon.formatting ?? 0,
                  types: pkg.qualityMetrics.hexagon.types ?? 0,
                  documentation: pkg.qualityMetrics.hexagon.documentation ?? 0,
                };

                console.info('[QualityHexagon] Full metrics with defaults:', fullMetrics);

                return compact ? (
                  <QualityHexagonCompact
                    metrics={fullMetrics}
                    tier="none"
                    theme={theme}
                  />
                ) : (
                  <QualityHexagonDetailed
                    metrics={fullMetrics}
                    tier="none"
                    theme={theme}
                  />
                );
              })()}
            </div>

            {/* Lens Information */}
            {(pkg.qualityMetrics.availableLenses?.length ||
              pkg.qualityMetrics.missingLenses?.length) && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '8px',
                  background: theme.colors.backgroundSecondary,
                  borderRadius: '4px',
                }}
              >
                {pkg.qualityMetrics.availableLenses &&
                  pkg.qualityMetrics.availableLenses.length > 0 && (
                    <div style={{ marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: theme.fontSizes[0],
                          fontWeight: 600,
                          color: theme.colors.success,
                        }}
                      >
                        Available Lenses ({pkg.qualityMetrics.availableLenses.length}):{' '}
                      </span>
                      <span
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.monospace,
                        }}
                      >
                        {pkg.qualityMetrics.availableLenses.join(', ')}
                      </span>
                    </div>
                  )}
                {pkg.qualityMetrics.missingLenses &&
                  pkg.qualityMetrics.missingLenses.length > 0 && (
                    <div>
                      <span
                        style={{
                          fontSize: theme.fontSizes[0],
                          fontWeight: 600,
                          color: theme.colors.warning,
                        }}
                      >
                        Missing Lenses ({pkg.qualityMetrics.missingLenses.length}):{' '}
                      </span>
                      <span
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.monospace,
                        }}
                      >
                        {pkg.qualityMetrics.missingLenses.join(', ')}
                      </span>
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            color: theme.colors.textSecondary,
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              border: `3px solid ${theme.colors.border}`,
              borderTopColor: theme.colors.primary,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ marginTop: '16px' }}>Loading package information...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '32px',
            color: theme.colors.error,
          }}
        >
          <p>❌ {error}</p>
          <button
            onClick={fetchPackages}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    if (!summary || packages.length === 0) {
      return (
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '32px',
            color: theme.colors.textSecondary,
          }}
        >
          <p>No package information available</p>
          <button
            onClick={fetchPackages}
            style={{
              marginTop: '16px',
              padding: '8px 24px',
              background: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Load Packages
          </button>
        </div>
      );
    }

    // Show package information
    // Sort packages by name
    const sortedPackages = [...packages].sort((a, b) => {
      const nameA = a.packageData.name || '';
      const nameB = b.packageData.name || '';
      return nameA.localeCompare(nameB);
    });

    return (
      <div style={{ color: theme.colors.text }}>
        {/* Package List */}
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {sortedPackages.map((pkg) => renderPackageInfo(pkg))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        height: 'fit-content',
      }}
    >
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          marginBottom: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span>Quality Hexagon</span>
        {summary?.isMonorepo && (
          <span
            style={{
              fontWeight: 600,
              color: theme.colors.primary,
              textTransform: 'none',
              fontSize: theme.fontSizes[1],
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Grid2x2 size={14} />
            Monorepo
          </span>
        )}
      </div>
      {renderContent()}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export const QualityHexagonPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 600 }}>Package Quality</div>
      <div
        style={{
          fontSize: '11px',
          color: theme.colors.textSecondary,
        }}
      >
        View package metrics, quality hexagon, and available lenses
      </div>
    </div>
  );
};
