/**
 * FeedLeftPanel
 *
 * Left panel for the FeedView that contains the feed mode selector
 * and different list views (my activity, collections with subtabs, team with organizations and coworkers).
 * All sub-components stay mounted to avoid reloading data on mode switch.
 */

import React, { useCallback, useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Github } from 'lucide-react';
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
import { useAuth } from '../hooks/useAuthState';

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
  const { user: currentUser } = useAuth();

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

  const handleCurrentUserClick = useCallback(() => {
    if (currentUser) {
      events.emit({
        type: 'user:profile-selected',
        source: 'feed-left-panel',
        timestamp: Date.now(),
        payload: { username: currentUser.login },
      });
    }
  }, [currentUser, events]);

  const handleSignInClick = useCallback(() => {
    events.emit({
      type: 'panel:switch',
      source: 'feed-left-panel',
      timestamp: Date.now(),
      payload: { view: 'auth' },
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
        {/* Current User Section / Sign In */}
        {currentUser ? (
          <button
            onClick={handleCurrentUserClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              width: '100%',
              padding: spacing.sm,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii?.[1] || 4,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
              position: 'relative',
              marginBottom: spacing.xs,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            {/* Avatar with activity indicator */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.login}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                }}
              />
              {activeUsers.has(currentUser.login) && (
                <div
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: theme.colors.success,
                    border: `2px solid ${theme.colors.background}`,
                  }}
                  title="Recent activity"
                />
              )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[1],
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentUser.name || currentUser.login}
              </div>
              <div
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentUser.name ? `@${currentUser.login}` : 'You'}
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={handleSignInClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              width: '100%',
              padding: spacing.sm,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii?.[1] || 4,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
              position: 'relative',
              marginBottom: spacing.xs,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            {/* GitHub icon as avatar */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: theme.colors.backgroundSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Github size={24} color={theme.colors.textSecondary} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[1],
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign in with GitHub
              </div>
              <div
                style={{
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Connect your account
              </div>
            </div>
          </button>
        )}

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
