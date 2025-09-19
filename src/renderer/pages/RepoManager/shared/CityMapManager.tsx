import React, { useEffect, useState, useMemo, ReactNode } from 'react';
import { GitBranch } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import type { CityData } from '@principal-ai/code-city-react';
import { MultiVersionCityBuilder } from '@principal-ai/code-city-react';
import { FileTree } from '@principal-ai/repository-abstraction';
import { FileTreeSource } from '../../../types/file-tree-source';
import { SourceSelectionService } from '../../../services/SourceSelectionService';

/**
 * View modes that affect how the city and badges are displayed
 */
export type CityViewMode = 'explore' | 'develop' | 'maintain';

/**
 * Props for the CityMapManager component
 */
export interface CityMapManagerProps {
  // Core data
  fileTree: FileTree | null;
  activeSource: FileTreeSource | null;

  // Git integration (optional)
  gitEnabled?: boolean;
  headTree?: FileTree | null;
  hasNoCommits?: boolean; // For repos with no HEAD

  // View mode
  viewMode: CityViewMode;

  // Toggles for develop view
  showWorkingTree?: boolean;
  showHeadTree?: boolean;
  onToggleWorkingTree?: (show: boolean) => void;
  onToggleHeadTree?: (show: boolean) => void;

  // Render props for custom badge content
  renderCustomBadges?: () => ReactNode;

  // Children receive the built city and badges
  children: (props: {
    cityData: CityData | null;
    sourceBadges: ReactNode;
    isBuilding: boolean;
  }) => ReactNode;
}

/**
 * Centralized component for managing city data building and source badges
 * across different repository views (explore, develop, maintain)
 */
export const CityMapManager: React.FC<CityMapManagerProps> = ({
  fileTree,
  activeSource,
  gitEnabled = false,
  headTree = null,
  hasNoCommits = false,
  viewMode,
  showWorkingTree = true,
  showHeadTree = true,
  onToggleWorkingTree,
  onToggleHeadTree,
  renderCustomBadges,
  children,
}) => {
  const { theme } = useTheme();
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  // Build city data whenever inputs change
  useEffect(() => {
    const buildCity = async () => {
      if (!fileTree || !activeSource) {
        setCityData(null);
        return;
      }

      setIsBuilding(true);

      try {
        // Determine which trees to include based on mode and settings
        const versions = new Map<string, FileTree>();

        // Always add the main tree
        versions.set(activeSource.id, fileTree);

        // Add HEAD tree for git-enabled views
        if (gitEnabled && headTree && !hasNoCommits) {
          if (viewMode === 'explore') {
            // Explore: Add HEAD when git changes are enabled
            versions.set(`${activeSource.id}-HEAD`, headTree);
          } else if (viewMode === 'develop') {
            // Develop: Always add HEAD for stable layout
            versions.set(`${activeSource.id}-HEAD`, headTree);
          }
        }

        // Build multi-version city using new API
        const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(
          versions,
          {},
        );

        // Determine which files to show based on mode and toggles
        let finalPresence: Set<string>;

        if (viewMode === 'develop' && headTree) {
          // Develop mode: Filter based on toggle states
          finalPresence = new Set<string>();

          // Get all file paths from the union city
          const allPaths = new Set<string>();
          unionCity.buildings?.forEach((building) => {
            if (building.path) allPaths.add(building.path);
          });

          allPaths.forEach((filePath) => {
            let shouldShow = false;

            // Check working tree visibility
            if (
              showWorkingTree &&
              presenceByVersion.get(activeSource.id)?.has(filePath)
            ) {
              shouldShow = true;
            }

            // Check HEAD tree visibility
            if (
              showHeadTree &&
              presenceByVersion.get(`${activeSource.id}-HEAD`)?.has(filePath)
            ) {
              shouldShow = true;
            }

            if (shouldShow) {
              finalPresence.add(filePath);
            }
          });
        } else if (gitEnabled && headTree) {
          // Git-enabled explore mode: Show union of both trees
          finalPresence = new Set<string>();

          const workingPresence = presenceByVersion.get(activeSource.id);
          const headPresence = presenceByVersion.get(`${activeSource.id}-HEAD`);

          if (workingPresence) {
            workingPresence.forEach((path) => finalPresence.add(path));
          }
          if (headPresence) {
            headPresence.forEach((path) => finalPresence.add(path));
          }
        } else {
          // Default: Show only the main tree
          finalPresence = presenceByVersion.get(activeSource.id) || new Set();
        }

        // Get version view with the appropriate presence
        const city = MultiVersionCityBuilder.getVersionView(
          unionCity,
          finalPresence,
        );
        setCityData(city);
      } catch (error) {
        console.error('[CityMapManager] Error building city:', error);
        setCityData(null);
      } finally {
        setIsBuilding(false);
      }
    };

    buildCity();
  }, [
    fileTree,
    activeSource,
    gitEnabled,
    headTree,
    hasNoCommits,
    viewMode,
    showWorkingTree,
    showHeadTree,
  ]);

  // Generate source badges based on mode and state
  const sourceBadges = useMemo(() => {
    if (!activeSource) return null;

    // Get folder name for local sources
    const getFolderName = () => {
      if (activeSource.type === 'local') {
        return activeSource.location.split('/').pop() || activeSource.name;
      }
      return activeSource.name;
    };

    // Maintain mode: Simple single badge
    if (viewMode === 'maintain') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: theme.colors.primary + '22',
              color: theme.colors.primary,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <GitBranch size={12} />
            {SourceSelectionService.getSourceDisplayName(activeSource)}
          </div>
          {renderCustomBadges?.()}
        </div>
      );
    }

    // Explore mode: Show HEAD badge when git is enabled
    if (viewMode === 'explore') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* HEAD badge (left) when git changes enabled */}
          {gitEnabled && !hasNoCommits && headTree && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '6px',
                backgroundColor: '#64748b22',
                color: '#64748b',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <GitBranch size={12} />
              {getFolderName()} (HEAD)
            </div>
          )}

          {/* Working tree badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: theme.colors.primary + '22',
              color: theme.colors.primary,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <GitBranch size={12} />
            {activeSource.type === 'local'
              ? `${getFolderName()} (${activeSource.metadata?.currentBranch || 'main'})`
              : SourceSelectionService.getSourceDisplayName(activeSource)}
          </div>
          {renderCustomBadges?.()}
        </div>
      );
    }

    // Develop mode: Toggleable badges
    if (viewMode === 'develop') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* HEAD toggle badge (left - past) */}
          {activeSource.type === 'local' && headTree && (
            <button
              onClick={() => onToggleHeadTree?.(!showHeadTree)}
              disabled={showHeadTree && !showWorkingTree}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                borderRadius: '6px',
                backgroundColor: showHeadTree
                  ? theme.colors.primary + '22'
                  : theme.colors.backgroundTertiary,
                color: showHeadTree
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor:
                  showHeadTree && !showWorkingTree ? 'not-allowed' : 'pointer',
                opacity: !showHeadTree ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
              title={showHeadTree ? 'Click to hide HEAD' : 'Click to show HEAD'}
            >
              <GitBranch size={12} />
              {getFolderName()} (HEAD)
            </button>
          )}

          {/* Working tree toggle badge (right - present) */}
          <button
            onClick={() => onToggleWorkingTree?.(!showWorkingTree)}
            disabled={!showHeadTree && showWorkingTree}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: showWorkingTree
                ? theme.colors.primary + '22'
                : theme.colors.backgroundTertiary,
              color: showWorkingTree
                ? theme.colors.primary
                : theme.colors.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor:
                !showHeadTree && showWorkingTree ? 'not-allowed' : 'pointer',
              opacity: !showWorkingTree ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
            title={
              showWorkingTree
                ? 'Click to hide working tree'
                : 'Click to show working tree'
            }
          >
            <GitBranch size={12} />
            {activeSource.type === 'local'
              ? `${getFolderName()} (${activeSource.metadata?.currentBranch || 'Working'})`
              : SourceSelectionService.getSourceDisplayName(activeSource)}
          </button>
          {renderCustomBadges?.()}
        </div>
      );
    }

    return null;
  }, [
    activeSource,
    viewMode,
    gitEnabled,
    headTree,
    hasNoCommits,
    showWorkingTree,
    showHeadTree,
    onToggleWorkingTree,
    onToggleHeadTree,
    theme,
    renderCustomBadges,
  ]);

  // Render children with built data
  return (
    <>
      {children({
        cityData,
        sourceBadges,
        isBuilding,
      })}
    </>
  );
};
