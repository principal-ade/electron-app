/**
 * FeedLeftPanel
 *
 * Left panel for the FeedView that contains the feed mode selector
 * and different list views (my activity, watched items, team with organizations and coworkers).
 * All sub-components stay mounted to avoid reloading data on mode switch.
 */

import React, { useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Users } from 'lucide-react';
import { SegmentedControl } from '../components/SegmentedControl';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { WatchedItemsList } from './WatchedItemsList';
import { OrganizationsList } from './OrganizationsList';
import { CoworkersList } from './CoworkersList';
import { ProjectsList, type CommitTimestamp } from './ProjectsList';

export interface FeedLeftPanelProps {
  /** List of repositories */
  repositories: AlexandriaEntry[];
  /** Event bus for panel communication */
  events: PanelEventEmitter;
  /** Feed mode */
  feedMode: 'my-activity' | 'watched-activity' | 'organizations';
  /** Callback when feed mode changes */
  onFeedModeChange: (mode: 'my-activity' | 'watched-activity' | 'organizations') => void;
  /** Commit timestamps for activity heatmap */
  commits: CommitTimestamp[];
  /** Currently selected time block */
  selectedBlock: string | null;
}

export const FeedLeftPanel: React.FC<FeedLeftPanelProps> = ({
  repositories,
  events,
  feedMode,
  onFeedModeChange,
  commits,
  selectedBlock,
}) => {
  const { theme } = useTheme();

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  // Open Live Activity tab
  const handleNavigateToActivityCities = useCallback(() => {
    events.emit({
      type: 'live-activity:open',
      source: 'feed-left-panel',
      timestamp: Date.now(),
      payload: null,
    });
  }, [events]);

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
            { value: 'watched-activity', label: 'Watching' },
          ]}
          value={feedMode}
          onChange={(value) => onFeedModeChange(value as 'my-activity' | 'watched-activity' | 'organizations')}
          theme={theme}
        />

        {/* Live Activity button */}
        <button
          onClick={handleNavigateToActivityCities}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            padding: `${spacing.xs}px ${spacing.sm}px`,
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii?.[1] || 4,
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[0],
            fontFamily: theme.fonts.monospace,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            e.currentTarget.style.color = theme.colors.text;
            e.currentTarget.style.borderColor = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textSecondary;
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
        >
          <Users size={14} />
          <span>Live Activity</span>
        </button>
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

        {/* Watched Activity */}
        <div
          style={{
            display: feedMode === 'watched-activity' ? 'flex' : 'none',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <WatchedItemsList events={events} />
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
            <CoworkersList events={events} />
            <OrganizationsList events={events} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedLeftPanel;
