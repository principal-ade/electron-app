import React from 'react';
import { MapIcon, HelpCircle } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import {
  ArchitectureMapHighlightLayers,
  type CityData,
  type HighlightLayer,
} from '@principal-ai/code-city-react';
import {
  RepositoryToolbar,
  ToolbarItem,
} from '../shared/RepositoryToolbar';

interface CityVisualizationPanelProps {
  // City data
  cityData: CityData | null;
  highlightLayers?: HighlightLayer[];

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

  // Optional header extras
  headerExtra?: React.ReactNode;
  sourceBadges?: React.ReactNode;

  // Toolbar configuration
  toolbarItems?: ToolbarItem[];
  toolbarExpanded?: boolean;
  _onToolbarExpandedChange?: (expanded: boolean) => void;
}

export const CityVisualizationPanel: React.FC<CityVisualizationPanelProps> = ({
  cityData,
  highlightLayers = [],
  treeStats,
  onFileClick,
  onHelpClick,
  loading = false,
  loadingMessage = 'Loading repository structure',
  emptyMessage = 'Select a branch to explore',
  headerExtra,
  sourceBadges,
  toolbarItems = [],
  toolbarExpanded = false,
  _onToolbarExpandedChange,
}) => {
  const { theme } = useTheme();

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

            {/* Show stats */}
            {treeStats && (
              <span
                style={{ fontSize: '13px', color: theme.colors.textSecondary }}
              >
                {treeStats.fileCount.toLocaleString()} files •{' '}
                {treeStats.directoryCount.toLocaleString()} directories
              </span>
            )}

            {headerExtra}
          </div>

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
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}
          >
            {emptyMessage}
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
          />
        )}
      </div>
    </div>
  );
};
