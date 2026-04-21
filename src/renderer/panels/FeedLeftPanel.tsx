/**
 * FeedLeftPanel
 *
 * Left panel for the FeedView that contains the feed mode selector
 * and different list views (my activity, collections with subtabs, team with organizations and coworkers).
 * All sub-components stay mounted to avoid reloading data on mode switch.
 */

import React, { useCallback, useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { SegmentedControl } from '../components/SegmentedControl';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { WatchedItemsList } from './WatchedItemsList';
import { StarredReposList } from './StarredReposList';
import { CollectionsList } from './CollectionsList';
import { OrganizationsList } from './OrganizationsList';
import { CoworkersList } from './CoworkersList';
import { ProjectsList, type CommitTimestamp } from './ProjectsList';
import { useOrganizationsAndCoworkers } from '../hooks/useOrganizationsAndCoworkers';
import { useTeamActivity } from '../hooks/useTeamActivity';
import type { ActivityCommit } from '../hooks/useActivityFeed';

export interface FeedLeftPanelProps {
  /** List of repositories */
  repositories: AlexandriaEntry[];
  /** Event bus for panel communication */
  events: PanelEventEmitter;
  /** Feed mode */
  feedMode: 'my-activity' | 'collections' | 'organizations';
  /** Callback when feed mode changes */
  onFeedModeChange: (mode: 'my-activity' | 'collections' | 'organizations') => void;
  /** Commit timestamps for activity heatmap */
  commits: CommitTimestamp[];
  /** Currently selected time block */
  selectedBlock: string | null;
  /** Full activity commits for team activity tracking */
  activityCommits?: ActivityCommit[];
}

export const FeedLeftPanel: React.FC<FeedLeftPanelProps> = ({
  repositories,
  events,
  feedMode,
  onFeedModeChange,
  commits,
  selectedBlock,
  activityCommits = [],
}) => {
  const { theme } = useTheme();

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  // State for collections subtab
  const [collectionsSubtab, setCollectionsSubtab] = useState<'watching' | 'starred' | 'collections'>('watching');

  // Fetch coworkers and organizations data
  const { coworkers } = useOrganizationsAndCoworkers();

  // Determine which users and orgs have recent activity
  const { activeUsers, activeOrganizations } = useTeamActivity(activityCommits, coworkers);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.xs,
          padding: spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          flexShrink: 0,
        }}
      >
        {/* Feed mode toggle */}
        <SegmentedControl
          options={[
            { value: 'organizations', label: 'Team' },
            { value: 'my-activity', label: 'My Activity' },
            { value: 'collections', label: 'Collections' },
          ]}
          value={feedMode}
          onChange={(value) => onFeedModeChange(value as 'my-activity' | 'collections' | 'organizations')}
          theme={theme}
        />
      </div>

      {/* Panel content - all sub-components stay mounted, only visibility changes */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* My Activity - Projects List */}
        <div
          style={{
            display: feedMode === 'my-activity' ? 'flex' : 'none',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ProjectsList
            commits={commits}
            repositories={repositories}
            events={events}
            selectedBlock={selectedBlock}
          />
        </div>

        {/* Collections Tab with Subtabs */}
        <div
          style={{
            display: feedMode === 'collections' ? 'flex' : 'none',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Second-level segmented control for subtabs */}
          <div
            style={{
              padding: spacing.sm,
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              flexShrink: 0,
            }}
          >
            <SegmentedControl
              options={[
                { value: 'watching', label: 'Watching' },
                { value: 'starred', label: 'Starred' },
                { value: 'collections', label: 'Collections' },
              ]}
              value={collectionsSubtab}
              onChange={(value) => setCollectionsSubtab(value as 'watching' | 'starred' | 'collections')}
              theme={theme}
            />
          </div>

          {/* Subtab content container - all mounted, only visibility changes */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {/* Watching subtab */}
            <div
              style={{
                display: collectionsSubtab === 'watching' ? 'block' : 'none',
                height: '100%',
                width: '100%',
              }}
            >
              <WatchedItemsList events={events} />
            </div>

            {/* Starred subtab */}
            <div
              style={{
                display: collectionsSubtab === 'starred' ? 'block' : 'none',
                height: '100%',
                width: '100%',
              }}
            >
              <StarredReposList events={events} />
            </div>

            {/* Collections subtab */}
            <div
              style={{
                display: collectionsSubtab === 'collections' ? 'block' : 'none',
                height: '100%',
                width: '100%',
              }}
            >
              <CollectionsList events={events} />
            </div>
          </div>
        </div>

        {/* Organizations & Coworkers */}
        <div
          style={{
            display: feedMode === 'organizations' ? 'flex' : 'none',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              overflow: 'auto',
            }}
          >
            <CoworkersList events={events} activeUsers={activeUsers} />
            <OrganizationsList events={events} activeOrganizations={activeOrganizations} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedLeftPanel;
