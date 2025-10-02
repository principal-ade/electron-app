import React, { useState, useEffect, useCallback } from 'react';
import { Map as MapIcon, Layers, File, Folder } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import { ArchitectureMapHighlightLayers } from '@principal-ai/code-city-react';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';

export interface SimpleCityVisualizationProps {
  /** The repository to visualize */
  repository: EnhancedAlexandriaEntry;
  
  /** Pre-built city data (optional - will be built if not provided) */
  cityData?: CityData | null;
  
  /** Optional highlight layers for visualization */
  highlightLayers?: HighlightLayer[];
  
  /** Height of the visualization container */
  height?: string | number;
  
  /** Whether to show the toolbar with controls */
  showToolbar?: boolean;
  
  /** Whether the city is currently being built */
  isBuilding?: boolean;
  
  /** Custom loading message */
  loadingMessage?: string;
  
  /** Custom empty state message */
  emptyMessage?: string;
  
  /** Tree statistics */
  treeStats?: { fileCount: number; directoryCount: number } | null;
  
  /** Callback when a file is clicked */
  onFileClick?: (filePath: string) => void;
  
  /** Callback to request city data building */
  onRequestCityData?: () => void;
}

interface HoverInfo {
  hoveredDistrict: any | null;
  hoveredBuilding: any | null;
  fileTooltip: { text: string } | null;
  directoryTooltip: { text: string } | null;
  fileCount: number | null;
}

/**
 * Simplified city visualization component that accepts pre-built city data.
 * This version has minimal dependencies and can be easily integrated into existing panels.
 * The parent component is responsible for building the city data.
 */
export const SimpleCityVisualization: React.FC<SimpleCityVisualizationProps> = ({
  repository,
  cityData,
  highlightLayers = [],
  height = '400px',
  showToolbar = true,
  isBuilding = false,
  loadingMessage = 'Building repository visualization',
  emptyMessage = 'No repository data available',
  treeStats,
  onFileClick,
  onRequestCityData,
}) => {
  const { theme } = useTheme();
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // Request city data on mount if not provided
  useEffect(() => {
    if (!cityData && !isBuilding && onRequestCityData) {
      onRequestCityData();
    }
  }, [cityData, isBuilding, onRequestCityData]);

  // Memoize the hover handler to prevent infinite re-renders
  const handleHover = useCallback((info: HoverInfo) => {
    setHoverInfo(info);
  }, []);

  // Handle file click with default behavior
  const handleFileClick = useCallback(
    (filePath: string) => {
      if (onFileClick) {
        onFileClick(filePath);
      } else {
        console.log('[SimpleCityVisualization] File clicked:', filePath);
      }
    },
    [onFileClick],
  );

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
            <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <File size={12} />
                <span>{treeStats.fileCount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Folder size={12} />
                <span>{treeStats.directoryCount.toLocaleString()}</span>
              </div>
            </div>
          )}
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
        {onRequestCityData && (
          <button
            onClick={onRequestCityData}
            style={{
              marginTop: '12px',
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {treeStats && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: theme.colors.textSecondary }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <File size={14} />
                  <span>{treeStats.fileCount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Folder size={14} />
                  <span>{treeStats.directoryCount.toLocaleString()}</span>
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
          </div>
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