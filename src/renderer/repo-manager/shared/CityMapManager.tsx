import React, { useEffect, useState, useMemo, ReactNode } from 'react';
import { GitBranch } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { CityData } from '@principal-ai/code-city-react';
import { MultiVersionCityBuilder } from '@principal-ai/code-city-react';
import { FileTree } from '@principal-ai/repository-abstraction';
import { FileTreeSource } from '../../types/file-tree-source';
import { SourceSelectionService } from '../../services/SourceSelectionService';

/**
 * View modes that affect how the city and badges are displayed
 */
export type CityViewMode = 'explore' | 'maintain';

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
 * across different repository views (explore, maintain)
 */
export const CityMapManager: React.FC<CityMapManagerProps> = ({
  fileTree,
  activeSource,
  gitEnabled = false,
  headTree = null,
  hasNoCommits = false,
  viewMode,
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
        const versions = new Map<string, FileTree>();
        versions.set(activeSource.id, fileTree);

        if (gitEnabled && headTree && !hasNoCommits) {
          versions.set(`${activeSource.id}-HEAD`, headTree);
        }

        const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(
          versions,
          {},
        );

        let finalPresence: Set<string>;
        if (gitEnabled && headTree && !hasNoCommits) {
          finalPresence = new Set<string>();

          const workingPresence = presenceByVersion.get(activeSource.id);
          const headPresence = presenceByVersion.get(`${activeSource.id}-HEAD`);

          workingPresence?.forEach((path) => finalPresence.add(path));
          headPresence?.forEach((path) => finalPresence.add(path));
        } else {
          finalPresence = presenceByVersion.get(activeSource.id) || new Set();
        }

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
  }, [fileTree, activeSource, gitEnabled, headTree, hasNoCommits, viewMode]);

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

    return null;
  }, [
    activeSource,
    viewMode,
    gitEnabled,
    headTree,
    hasNoCommits,
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
