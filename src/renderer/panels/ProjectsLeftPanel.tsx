/**
 * ProjectsLeftPanel
 *
 * Left panel for the ProjectsView that contains the feed mode selector
 * and different list views (my activity, collections with subtabs, team with organizations and coworkers).
 * All sub-components stay mounted to avoid reloading data on mode switch.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Github, ChevronDown, ChevronUp, Settings, FolderOpen } from 'lucide-react';
import { SegmentedControl } from '../components/SegmentedControl';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { StarredReposList } from './StarredReposList';
import { CollectionsList } from './CollectionsList';
import { FollowingList } from './FollowingList';
import { OrganizationsList } from './OrganizationsList';
import { CoworkersList } from './CoworkersList';
import { ProjectsList } from './ProjectsList';
import { useOrganizationsAndCoworkers } from '../hooks/useOrganizationsAndCoworkers';
import { useTeamActivity } from '../hooks/useTeamActivity';
import type { ActivityCommit } from '../hooks/useActivityFeed';
import { useAuthState } from '../hooks/useAuthState';
import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { GitGlobalConfigModal } from '../components/GitGlobalConfigModal';

const GitLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 92 92" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M90.156 41.965L50.036 1.848a5.918 5.918 0 0 0-8.372 0l-8.328 8.332 10.566 10.566a7.03 7.03 0 0 1 7.23 1.684 7.043 7.043 0 0 1 1.673 7.277l10.183 10.184a7.026 7.026 0 0 1 7.278 1.672 7.04 7.04 0 0 1 0 9.957 7.045 7.045 0 0 1-9.961 0 7.038 7.038 0 0 1-1.532-7.66l-9.5-9.497V59.36a7.04 7.04 0 0 1 1.86 11.29 7.04 7.04 0 0 1-9.957 0 7.04 7.04 0 0 1 0-9.958 7.034 7.034 0 0 1 2.308-1.539V33.926a7.001 7.001 0 0 1-2.308-1.535 7.049 7.049 0 0 1-1.516-7.7L29.242 14.273 1.734 41.777a5.918 5.918 0 0 0 0 8.371l40.12 40.118a5.918 5.918 0 0 0 8.371 0l39.931-39.934a5.925 5.925 0 0 0 0-8.367" fill="#F05032" />
  </svg>
);

export interface ProjectsLeftPanelProps {
  /** List of repositories */
  repositories: AlexandriaEntry[];
  /** Event bus for panel communication */
  events: PanelEventEmitter;
  /** Feed mode */
  feedMode: 'my-activity' | 'collections' | 'organizations';
  /** Callback when feed mode changes */
  onFeedModeChange: (mode: 'my-activity' | 'collections' | 'organizations') => void;
  /** Full activity commits for team activity tracking */
  activityCommits?: ActivityCommit[];
}

export const ProjectsLeftPanel: React.FC<ProjectsLeftPanelProps> = ({
  repositories,
  events,
  feedMode,
  onFeedModeChange,
  activityCommits = [],
}) => {
  const { theme } = useTheme();
  const { user: currentUser, login, logout } = useAuthState();

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  // State for collections subtab
  const [collectionsSubtab, setCollectionsSubtab] = useState<'starred' | 'following' | 'collections'>('starred');

  // Collections live on the OAuth backend, so the subtab is only available when
  // signed in via OAuth (currentUser comes from useAuthState). When signed out,
  // fall back to Starred so a previously-selected Collections tab doesn't leave
  // the pane blank.
  const isOAuthSignedIn = !!currentUser;
  const effectiveSubtab =
    !isOAuthSignedIn && collectionsSubtab === 'collections' ? 'starred' : collectionsSubtab;

  // Local git identity (shown when signed out)
  const [localGitName, setLocalGitName] = useState<string | null>(null);
  const [localGitEmail, setLocalGitEmail] = useState<string | null>(null);

  useEffect(() => {
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

  // Home directory
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string | null>(null);

  useEffect(() => {
    UserPreferencesService.getPreferences().then((prefs) => {
      setBaseDefaultDirectory(prefs.baseDefaultDirectory || null);
    });
    return UserPreferencesService.onPreferencesUpdated((prefs) => {
      setBaseDefaultDirectory(prefs.baseDefaultDirectory || null);
    });
  }, []);

  const handleSelectBaseDirectory = async () => {
    const result = await FileSystemService.selectDirectory({
      title: 'Select Home Folder',
      buttonLabel: 'Select',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!result || result.canceled || !result.filePaths?.[0]) return;
    const selected = result.filePaths[0];
    await UserPreferencesService.updatePreferences({ baseDefaultDirectory: selected });
    setBaseDefaultDirectory(selected);
  };

  const getDirectoryDisplayName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  // Git config modal
  const [isGitConfigModalOpen, setIsGitConfigModalOpen] = useState(false);

  // Auth card expand state + GH CLI status
  const [showAuthCard, setShowAuthCard] = useState(false);
  const [ghCliStatus, setGhCliStatus] = useState<{ isAuthenticated: boolean; username?: string } | null>(null);
  const [ghCliLoading, setGhCliLoading] = useState(false);

  useEffect(() => {
    if (!showAuthCard) return;
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
          backgroundColor: theme.colors.background,
          flexShrink: 0,
        }}
      >
        {/* Current User Section / Sign In */}
        {currentUser ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                width: '100%',
                border: `1px solid ${showAuthCard ? theme.colors.primary : theme.colors.border}`,
                borderRadius: theme.radii?.[1] || 4,
                marginBottom: spacing.xs,
                overflow: 'hidden',
              }}
            >
              {/* Profile click area */}
              <button
                onClick={handleCurrentUserClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  flex: 1,
                  minWidth: 0,
                  padding: spacing.sm,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* Avatar with activity indicator */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.login}
                    style={{ width: 40, height: 40, borderRadius: '50%' }}
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
                  <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.name || currentUser.login}
                  </div>
                  <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.name ? `@${currentUser.login}` : 'You'}
                  </div>
                </div>
              </button>

              {/* Settings toggle */}
              <button
                onClick={() => setShowAuthCard(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.sm,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderLeft: `1px solid ${theme.colors.border}`,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease',
                  alignSelf: 'stretch',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="Auth settings"
              >
                <Settings size={14} color={showAuthCard ? theme.colors.primary : theme.colors.textSecondary} />
              </button>
            </div>

            {/* Auth status cards (signed-in) */}
            {showAuthCard && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, marginBottom: spacing.xs }}>
                {/* GitHub OAuth card with sign out */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radii?.[1] || 4 }}>
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.login}
                    style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>GitHub OAuth</div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.success, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentUser.name ? `@${currentUser.login}` : 'Connected'}
                    </div>
                  </div>
                  <button
                    onClick={() => logout()}
                    style={{
                      flexShrink: 0,
                      padding: `2px ${spacing.sm}px`,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      fontFamily: theme.fonts.monospace,
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.error;
                      e.currentTarget.style.color = theme.colors.error;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    Sign out
                  </button>
                </div>

                {/* GitHub CLI card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radii?.[1] || 4 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Github size={24} color={theme.colors.textSecondary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>GitHub CLI</div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: ghCliStatus?.isAuthenticated ? theme.colors.success : theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ghCliLoading ? '…' : ghCliStatus?.isAuthenticated ? (ghCliStatus.username ? `@${ghCliStatus.username}` : 'Connected') : 'Not connected'}
                    </div>
                  </div>
                </div>
                {/* Git local identity card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radii?.[1] || 4 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GitLogo size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {localGitName || 'Git'}
                    </div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {localGitEmail || 'No global identity set'}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsGitConfigModalOpen(true)}
                    style={{
                      flexShrink: 0,
                      padding: `2px ${spacing.sm}px`,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      fontFamily: theme.fonts.monospace,
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    Config
                  </button>
                </div>

                {/* Home folder card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radii?.[1] || 4 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FolderOpen size={20} color={theme.colors.textSecondary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2 }}>
                      Home Folder
                    </div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={baseDefaultDirectory || undefined}>
                      {baseDefaultDirectory ? getDirectoryDisplayName(baseDefaultDirectory) : 'Not set'}
                    </div>
                  </div>
                  <button
                    onClick={handleSelectBaseDirectory}
                    style={{
                      flexShrink: 0,
                      padding: `2px ${spacing.sm}px`,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      fontFamily: theme.fonts.monospace,
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </>
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

                {/* OAuth card — clickable to trigger OAuth login */}
                <button
                  onClick={() => login()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radii?.[1] || 4,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    width: '100%',
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
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Github size={24} color={theme.colors.textSecondary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      GitHub OAuth
                    </div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Sign in
                    </div>
                  </div>
                </button>

                {/* Git local identity card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radii?.[1] || 4 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GitLogo size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {localGitName || 'Git'}
                    </div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {localGitEmail || 'No global identity set'}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsGitConfigModalOpen(true)}
                    style={{
                      flexShrink: 0,
                      padding: `2px ${spacing.sm}px`,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      fontFamily: theme.fonts.monospace,
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    Config
                  </button>
                </div>

                {/* Home folder card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radii?.[1] || 4 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FolderOpen size={20} color={theme.colors.textSecondary} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text, marginBottom: 2 }}>
                      Home Folder
                    </div>
                    <div style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={baseDefaultDirectory || undefined}>
                      {baseDefaultDirectory ? getDirectoryDisplayName(baseDefaultDirectory) : 'Not set'}
                    </div>
                  </div>
                  <button
                    onClick={handleSelectBaseDirectory}
                    style={{
                      flexShrink: 0,
                      padding: `2px ${spacing.sm}px`,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii?.[1] || 4,
                      fontFamily: theme.fonts.monospace,
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Feed mode toggle — pulled flush to the panel edges by undoing
            the header wrapper's horizontal padding. */}
        <div style={{ marginLeft: -spacing.sm, marginRight: -spacing.sm }}>
          <SegmentedControl
            options={[
              { value: 'my-activity', label: 'My Projects' },
              { value: 'organizations', label: 'Team' },
              { value: 'collections', label: 'Social' },
            ]}
            value={feedMode}
            onChange={(value) => onFeedModeChange(value as 'my-activity' | 'collections' | 'organizations')}
            theme={theme}
            variant="underline"
          />
        </div>
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
            repositories={repositories}
            events={events}
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
              backgroundColor: theme.colors.background,
              flexShrink: 0,
            }}
          >
            <SegmentedControl
              options={[
                { value: 'starred', label: 'Starred' },
                { value: 'following', label: 'Following' },
                // Collections require an OAuth sign-in.
                ...(isOAuthSignedIn
                  ? [{ value: 'collections', label: 'Collections' }]
                  : []),
              ]}
              value={effectiveSubtab}
              onChange={(value) => setCollectionsSubtab(value as 'starred' | 'following' | 'collections')}
              theme={theme}
              variant="pill-flat"
            />
          </div>

          {/* Subtab content container - all mounted, only visibility changes */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {/* Starred subtab */}
            <div
              style={{
                display: effectiveSubtab === 'starred' ? 'block' : 'none',
                height: '100%',
                width: '100%',
              }}
            >
              <StarredReposList events={events} />
            </div>

            {/* Following subtab */}
            <div
              style={{
                display: effectiveSubtab === 'following' ? 'block' : 'none',
                height: '100%',
                width: '100%',
              }}
            >
              <FollowingList events={events} />
            </div>

            {/* Collections subtab — only mounted when signed in via OAuth */}
            {isOAuthSignedIn && (
              <div
                style={{
                  display: effectiveSubtab === 'collections' ? 'block' : 'none',
                  height: '100%',
                  width: '100%',
                }}
              >
                <CollectionsList events={events} />
              </div>
            )}
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

      <GitGlobalConfigModal
        isOpen={isGitConfigModalOpen}
        onClose={() => setIsGitConfigModalOpen(false)}
      />
    </div>
  );
};

export default ProjectsLeftPanel;
