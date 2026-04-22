/**
 * FeedLeftPanel
 *
 * Left panel for the FeedView that contains the feed mode selector
 * and different list views (my activity, collections with subtabs, team with organizations and coworkers).
 * All sub-components stay mounted to avoid reloading data on mode switch.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Github, ChevronDown, ChevronUp } from 'lucide-react';
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
import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';

const GitLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 92 92" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.673 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66l-9.5-9.497V59.36a7.04 7.04 0 0 1 1.86 11.29 7.04 7.04 0 0 1-9.957 0 7.04 7.04 0 0 1 0-9.958 7.034 7.034 0 0 1 2.308-1.539V33.926a7.001 7.001 0 0 1-2.308-1.535 7.049 7.049 0 0 1-1.516-7.7L29.242 14.273 1.734 41.777a5.918 5.918 0 0 0 0 8.371l40.12 40.118a5.918 5.918 0 0 0 8.371 0l39.931-39.934a5.925 5.925 0 0 0 0-8.367" fill="#F05032" />
  </svg>
);

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

  // Local git identity (shown when signed out)
  const [localGitName, setLocalGitName] = useState<string | null>(null);
  const [localGitEmail, setLocalGitEmail] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) return;
    const dir = process.env.HOME || '/';
    (async () => {
      try {
        const [nameResult, emailResult] = await Promise.all([
          GitService.execCommand(dir, ['config', '--global', 'user.name']),
          GitService.execCommand(dir, ['config', '--global', 'user.email']),
        ]);
        setLocalGitName(nameResult.stdout.trim() || null);
        setLocalGitEmail(emailResult.stdout.trim() || null);
      } catch {
        // no global git config available
      }
    })();
  }, [currentUser]);

  // Auth card expand state + GH CLI status
  const [showAuthCard, setShowAuthCard] = useState(false);
  const [ghCliStatus, setGhCliStatus] = useState<{ isAuthenticated: boolean; username?: string } | null>(null);
  const [ghCliLoading, setGhCliLoading] = useState(false);

  useEffect(() => {
    if (!showAuthCard || currentUser) return;
    setGhCliLoading(true);
    GithubService.checkAuthStatus()
      .then(setGhCliStatus)
      .catch(() => setGhCliStatus({ isAuthenticated: false }))
      .finally(() => setGhCliLoading(false));
  }, [showAuthCard, currentUser]);

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
          <>
            <button
              onClick={() => setShowAuthCard(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                width: '100%',
                padding: spacing.sm,
                backgroundColor: 'transparent',
                border: `1px solid ${showAuthCard ? theme.colors.primary : theme.colors.border}`,
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
                e.currentTarget.style.borderColor = showAuthCard ? theme.colors.primary : theme.colors.border;
              }}
            >
              {/* Avatar icon */}
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
                {localGitName
                  ? <GitLogo size={24} />
                  : <Github size={24} color={theme.colors.textSecondary} />
                }
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
                  {localGitName || 'Sign in with GitHub'}
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
                  {localGitEmail || 'Connect your account'}
                </div>
              </div>

              {/* Expand chevron */}
              {showAuthCard
                ? <ChevronUp size={14} color={theme.colors.textSecondary} />
                : <ChevronDown size={14} color={theme.colors.textSecondary} />
              }
            </button>

            {/* Auth status cards */}
            {showAuthCard && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginBottom: spacing.xs }}>

                {/* GH CLI card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radii?.[1] || 4,
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Github size={24} color={theme.colors.textSecondary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      GitHub CLI
                    </div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: ghCliStatus?.isAuthenticated ? theme.colors.success : theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ghCliLoading ? '…' : ghCliStatus?.isAuthenticated ? (ghCliStatus.username ? `@${ghCliStatus.username}` : 'Connected') : 'Not connected'}
                    </div>
                  </div>
                </div>

                {/* OAuth card */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radii?.[1] || 4,
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Github size={24} color={theme.colors.textSecondary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      OAuth
                    </div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Not connected
                    </div>
                  </div>
                </div>

                {/* Sign in card */}
                <button
                  onClick={handleSignInClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.colors.primary}`,
                    borderRadius: theme.radii?.[1] || 4,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Github size={24} color={theme.colors.primary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.primary, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Sign in with GitHub
                    </div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Connect your account
                    </div>
                  </div>
                </button>
              </div>
            )}
          </>
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
