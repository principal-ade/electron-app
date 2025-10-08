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
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flex: 1,
            }}
          >
            <MapIcon size={18} color={theme.colors.primary} />

            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: 0,
              }}
            >
              Project Structure
            </h3>

            {headerExtra}
          </div>

          {/* Stats and layer count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {computedTreeStats &&
             typeof computedTreeStats.fileCount === 'number' &&
             typeof computedTreeStats.directoryCount === 'number' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: theme.colors.textSecondary }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <File size={14} />
                  <span>{computedTreeStats.fileCount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Folder size={14} />
                  <span>{computedTreeStats.directoryCount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {highlightLayers.length > 0 && (
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
                <span>{highlightLayers.length} layer{highlightLayers.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Help button */}
            {onHelpClick && (
              <button
                onClick={onHelpClick}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.colors.textSecondary,
                }}
                title="Help"
              >
                <HelpCircle size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        {toolbarItems.length > 0 && (
          <RepositoryToolbar
            items={toolbarItems}
            expanded={toolbarExpanded}
          />
        )}

        {/* Source badges */}
        {sourceBadges && (
          <div style={{ padding: '8px 16px', paddingTop: 0 }}>
            {sourceBadges}
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
