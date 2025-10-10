import React, { useState, useCallback } from 'react';
import { MapIcon, HelpCircle, File, Folder, Layers } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
  type CityBuilding,
  type CityDistrict,
} from '@principal-ai/code-city-react';
import {
  RepositoryToolbar,
  ToolbarItem,
} from '../../repo-manager/shared/RepositoryToolbar';
import { useHighlightLayers } from '../../contexts/HighlightLayersContext';

interface HoverInfo {
  hoveredDistrict: CityDistrict | null;
  hoveredBuilding: CityBuilding | null;
  fileTooltip: { text: string } | null;
  directoryTooltip: { text: string } | null;
  fileCount: number | null;
}

interface CityVisualizationPanelProps {
  // City data
  cityData: CityData | null;

  // Stats
  treeStats?: { fileCount: number; directoryCount: number } | null;

  // Event handlers
  onFileClick?: (filePath: string) => void;
  onHelpClick?: () => void;

  // Loading state
  loading?: boolean;
  loadingMessage?: string;

  // Empty state
  emptyMessage?: string;
  onRequestCityData?: () => void;

  // Optional header extras
  headerExtra?: React.ReactNode;
  sourceBadges?: React.ReactNode;

  // Toolbar configuration
  toolbarItems?: ToolbarItem[];
  toolbarExpanded?: boolean;
}

export const CityVisualizationPanel: React.FC<CityVisualizationPanelProps> = ({
  cityData,
  treeStats,
  onFileClick,
  onHelpClick,
  loading = false,
  loadingMessage = 'Loading repository structure',
  emptyMessage = 'Select a branch to explore',
  onRequestCityData,
  headerExtra,
  sourceBadges,
  toolbarItems = [],
  toolbarExpanded = false,
}) => {
  const { theme } = useTheme();
  const { getAllLayers } = useHighlightLayers();
  const highlightLayers = getAllLayers();
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // Compute tree stats from cityData if not provided
  const computedTreeStats = React.useMemo(() => {
    if (treeStats) {
      return treeStats;
    }

    if (!cityData) {
      return null;
    }

    // Count files and directories from cityData
    let fileCount = 0;
    let directoryCount = 0;

    const countItems = (districts: CityDistrict[]) => {
      for (const district of districts) {
        directoryCount++;
        if (district.buildings) {
          fileCount += district.buildings.length;
        }
        if (district.subDistricts) {
          countItems(district.subDistricts);
        }
      }
    };

    if (cityData.districts) {
      countItems(cityData.districts);
    }

    return { fileCount, directoryCount };
  }, [cityData, treeStats]);

  // Memoize the hover handler to prevent infinite re-renders
  const handleHover = useCallback((info: HoverInfo) => {
    setHoverInfo(info);
  }, []);

  // Auto-request city data on mount if not provided
  React.useEffect(() => {
    if (!cityData && !loading && onRequestCityData) {
      onRequestCityData();
    }
  }, [cityData, loading, onRequestCityData]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        {/* First row: Title and actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapIcon size={16} style={{ color: theme.colors.primary }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Project Structure</span>

            {/* Stats badges */}
            {computedTreeStats &&
             typeof computedTreeStats.fileCount === 'number' &&
             typeof computedTreeStats.directoryCount === 'number' && (
              <>
                <span
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    backgroundColor: theme.colors.background,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <File size={12} />
                  {computedTreeStats.fileCount.toLocaleString()}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    backgroundColor: theme.colors.background,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Folder size={12} />
                  {computedTreeStats.directoryCount.toLocaleString()}
                </span>
              </>
            )}

            {highlightLayers.length > 0 && (
              <span
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.background,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Layers size={12} />
                {highlightLayers.length} layer{highlightLayers.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {headerExtra}

            {/* Help button */}
            {onHelpClick && (
              <button
                onClick={onHelpClick}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Help"
              >
                <HelpCircle size={12} />
                Help
              </button>
            )}
          </div>
        </div>

        {/* Second row: Toolbar and badges */}
        {(toolbarItems.length > 0 || sourceBadges) && (
          <div
            style={{
              padding: '8px 16px',
              borderBottom: sourceBadges ? `1px solid ${theme.colors.border}` : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            {/* Toolbar */}
            {toolbarItems.length > 0 && (
              <RepositoryToolbar
                items={toolbarItems}
                expanded={toolbarExpanded}
              />
            )}

            {/* Source badges */}
            {sourceBadges && (
              <div>{sourceBadges}</div>
            )}
          </div>
        )}
      </div>

      {/* City visualization content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}
          >
            {loadingMessage}
          </div>
        ) : !cityData ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              gap: '12px',
            }}
          >
            <MapIcon size={32} style={{ opacity: 0.5 }} />
            <div>{emptyMessage}</div>
            {onRequestCityData && (
              <button
                onClick={onRequestCityData}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Load Visualization
              </button>
            )}
          </div>
        ) : (
          <ArchitectureMapHighlightLayers
            cityData={cityData}
            highlightLayers={highlightLayers}
            showLayerControls={false}
            onLayerToggle={() => {}}
            defaultDirectoryColor="#111827"
            onFileClick={onFileClick || (() => {})}
            showFileTypeIcons={true}
            className="w-full h-full"
            showLegend={false}
            showDirectoryLabels={true}
            onHover={handleHover}
          />
        )}
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
        {hoverInfo && (hoverInfo.hoveredBuilding || hoverInfo.hoveredDistrict) ? (
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
                  (hoverInfo.hoveredDistrict?.path?.split('/').pop() ||
                   hoverInfo.hoveredDistrict?.path) ||
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
            Hover over files and directories to see details • Click files to open
          </div>
        )}
      </div>
    </div>
  );
};
