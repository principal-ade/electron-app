import React, { useState, useEffect, useCallback } from 'react';
import { Map as MapIcon, Layers } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import {
  ArchitectureMapHighlightLayers,
  MultiVersionCityBuilder,
} from '@principal-ai/code-city-react';
import type { FileTree as RepositoryFileTree } from '@principal-ai/repository-abstraction';
import type {
  CityBuilding,
  CityDistrict,
  FileTree as CityFileTree,
} from '@principal-ai/code-city-builder';
import type {
  EnhancedAlexandriaEntry,
  Repository as NormalizedRepository,
} from '../../../../../shared/types/repository.types';
import { FileTreeSourceService } from '../../../../services/FileTreeSourceService';
import { CityDataCacheService } from '../../../../services/CityDataCacheService';
import { WindowService } from '../../../../main-process-api/WindowService';

export interface RepositoryCityVisualizationProps {
  /** The repository to visualize */
  repository: EnhancedAlexandriaEntry;

  /** Optional highlight layers for visualization */
  highlightLayers?: HighlightLayer[];

  /** Whether to show git changes (HEAD vs working tree) */
  showGitChanges?: boolean;

  /** Height of the visualization container */
  height?: string | number;

  /** Whether to show the toolbar with controls */
  showToolbar?: boolean;

  /** Custom loading message */
  loadingMessage?: string;

  /** Custom empty state message */
  emptyMessage?: string;

  /** Callback when a file is clicked */
  onFileClick?: (filePath: string) => void;
}

interface HoverInfo {
  hoveredDistrict: CityDistrict | null;
  hoveredBuilding: CityBuilding | null;
  fileTooltip: { text: string } | null;
  directoryTooltip: { text: string } | null;
  fileCount: number | null;
  mousePos: { x: number; y: number };
}

/**
 * Self-contained city visualization component for repositories.
 * Encapsulates all the functionality from CityMapManager and RightPaneContainer
 * to provide a simple, reusable component for repository visualization.
 */
export const RepositoryCityVisualization: React.FC<
  RepositoryCityVisualizationProps
> = ({
  repository,
  highlightLayers = [],
  showGitChanges = false,
  height = '400px',
  showToolbar = true,
  loadingMessage = 'Building repository visualization',
  emptyMessage = 'No repository data available',
  onFileClick,
}) => {
  const { theme } = useTheme();

  // State management
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [treeStats, setTreeStats] = useState<{
    fileCount: number;
    directoryCount: number;
  } | null>(null);

  // Services - initialize once
  const [services] = useState(() => ({
    fileTreeService: new FileTreeSourceService(),
    cacheService: new CityDataCacheService(),
  }));

  // Memoize the hover handler to prevent infinite re-renders
  const handleHover = useCallback((info: HoverInfo) => {
    setHoverInfo(info);
  }, []);

  // Handle file click with default behavior
  const handleFileClick = useCallback(
    async (filePath: string) => {
      if (onFileClick) {
        onFileClick(filePath);
        return;
      }

      // Default behavior: open file in multi-file editor
      try {
        const absolutePath = `${repository.path}/${filePath}`;
        const files = [
          {
            path: absolutePath,
            relativePath: filePath,
            lastModified: Date.now(),
          },
        ];

        let owner = 'local';
        let repo = repository.name;

        if (repository.github?.owner) {
          owner = repository.github.owner;
        }
        if (repository.github?.name) {
          repo = repository.github.name;
        }

        await WindowService.openLocalFiles({
          windowId: `view-${owner}-${repo}-${Date.now()}`,
          windowTitle: `View ${filePath}`,
          files,
        });
      } catch (error) {
        console.error(
          '[RepositoryCityVisualization] Error opening file:',
          error,
        );
      }
    },
    [repository, onFileClick],
  );

  // Build city data
  useEffect(() => {
    const buildCity = async () => {
      if (!repository?.path) {
        setCityData(null);
        setTreeStats(null);
        return;
      }

      setIsBuilding(true);
      setError(null);

      try {
        // Initialize sources from repository
        const repositoryForService = {
          ...repository,
          localClones: repository.path
            ? [
                {
                  path: repository.path,
                  addedAt: Date.now(),
                  lastAccessed: Date.now(),
                },
              ]
            : [],
        } as unknown as NormalizedRepository;

        const sources =
          services.fileTreeService.initializeFromRepository(
            repositoryForService,
          );

        if (sources.length === 0) {
          throw new Error('No valid sources found for repository');
        }

        const primarySource = sources[0];

        // Load the file tree
        const loadedSource = await services.fileTreeService.loadFileTree(
          primarySource.id,
        );
        if (!loadedSource) {
          throw new Error('Failed to load file tree');
        }

        // Set tree stats
        setTreeStats({
          fileCount: loadedSource.treeStats.fileCount,
          directoryCount: loadedSource.treeStats.directoryCount,
        });

        // Prepare trees for city building
        const versions = new Map<string, CityFileTree>();
        versions.set(
          primarySource.id,
          loadedSource.tree as RepositoryFileTree as unknown as CityFileTree,
        );

        // Optionally add HEAD tree for git changes
        if (showGitChanges) {
          try {
            // Try to get HEAD tree (this would need to be implemented)
            // For now, we'll just use the working tree
            console.info(
              '[RepositoryCityVisualization] Git changes requested but HEAD tree loading not implemented yet',
            );
          } catch (gitError) {
            console.warn(
              '[RepositoryCityVisualization] Could not load HEAD tree:',
              gitError,
            );
          }
        }

        // Build city using MultiVersionCityBuilder
        const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(
          versions,
          {},
        );

        // Get presence data for primary source
        const presence = presenceByVersion.get(primarySource.id);
        if (!presence) {
          throw new Error('No presence data for primary source');
        }

        // Get version view
        const city = MultiVersionCityBuilder.getVersionView(
          unionCity,
          presence,
        );
        setCityData(city);
      } catch (err) {
        console.error(
          '[RepositoryCityVisualization] Error building city:',
          err,
        );
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setCityData(null);
        setTreeStats(null);
      } finally {
        setIsBuilding(false);
      }
    };

    buildCity();
  }, [repository?.path, showGitChanges, services.fileTreeService]);

  // Render loading state
  if (isBuilding) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: `3px solid ${theme.colors.border}`,
            borderTop: `3px solid ${theme.colors.primary}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px',
          }}
        />
        <div
          style={{
            color: theme.colors.textSecondary,
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          {loadingMessage}
          {treeStats && (
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              {treeStats.fileCount.toLocaleString()} files •{' '}
              {treeStats.directoryCount.toLocaleString()} directories
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.textSecondary,
        }}
      >
        <div style={{ fontSize: '14px', textAlign: 'center', padding: '20px' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  // Render empty state
  if (!cityData) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.textSecondary,
        }}
      >
        <MapIcon size={32} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <div style={{ fontSize: '14px', textAlign: 'center' }}>
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      {showToolbar && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundLight,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MapIcon size={18} color={theme.colors.primary} />
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: 0,
              }}
            >
              Repository Structure
            </h3>
            {treeStats && (
              <span
                style={{ fontSize: '13px', color: theme.colors.textSecondary }}
              >
                {treeStats.fileCount.toLocaleString()} files •{' '}
                {treeStats.directoryCount.toLocaleString()} directories
              </span>
            )}
          </div>

          {highlightLayers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: theme.colors.primary + '15',
                  color: theme.colors.primary,
                  fontSize: '11px',
                  fontWeight: 500,
                }}
              >
                <Layers size={12} />
                <span>
                  {highlightLayers.length} layer
                  {highlightLayers.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* City Visualization */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ArchitectureMapHighlightLayers
          cityData={cityData}
          highlightLayers={highlightLayers}
          showLayerControls={false}
          onLayerToggle={() => {}}
          defaultDirectoryColor="#111827"
          onFileClick={handleFileClick}
          showFileTypeIcons={true}
          className="w-full h-full"
          showLegend={false}
          showDirectoryLabels={true}
          onHover={handleHover}
        />
      </div>

      {/* Hover Information Bar */}
      <div
        style={{
          height: '56px',
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: '13px',
          color: theme.colors.text,
          gap: '16px',
          flexShrink: 0,
        }}
      >
        {hoverInfo &&
        (hoverInfo.hoveredBuilding || hoverInfo.hoveredDistrict) ? (
          <>
            {/* File/Directory name and path */}
            <div
              style={{
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                minWidth: 0,
              }}
            >
              {/* Name (filename or last directory part) */}
              <div
                style={{
                  fontWeight: 600,
                  color: theme.colors.primary,
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {hoverInfo.fileTooltip?.text ||
                  hoverInfo.hoveredDistrict?.path?.split('/').pop() ||
                  hoverInfo.hoveredDistrict?.path ||
                  'Unknown'}
              </div>
              {/* Full path */}
              <div
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: '11px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {hoverInfo.hoveredBuilding?.path ||
                  hoverInfo.hoveredDistrict?.path ||
                  '/'}
              </div>
            </div>

            {/* File count for directories */}
            {hoverInfo.hoveredDistrict && hoverInfo.fileCount !== null && (
              <div
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                {hoverInfo.fileCount}{' '}
                {hoverInfo.fileCount === 1 ? 'file' : 'files'}
              </div>
            )}
          </>
        ) : (
          /* Default help text when not hovering */
          <div
            style={{
              color: theme.colors.textSecondary,
              fontStyle: 'italic',
            }}
          >
            Hover over files and directories to see details • Click files to
            open
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
