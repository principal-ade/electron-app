import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Users,
} from 'lucide-react';

import { useAuthState } from '../../hooks/useAuthState';
import { GithubService } from '../../main-process-api/GithubService';
import type {
  GitHubUser,
  GitHubOrganization,
  GitHubOrgMember,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { UserAvatar } from '../../components/repository-maps/UserAvatar';
import { PresenceService } from '../../main-process-api/PresenceService';
import { useGitSyncConnection } from '../../hooks/useGitSyncConnection';
import type { UserPresence } from '../../../shared/main-process-api-interfaces/PresenceAPI';

interface PersonWithOrg extends GitHubUser {
  organizations?: string[];
}

interface SocialData {
  following: GitHubUser[];
  followers: GitHubUser[];
  organizations: GitHubOrganization[];
  orgMembers: Map<string, GitHubOrgMember[]>;
}

export const GitHubSocialPanel: React.FC = () => {
  const { theme } = useTheme();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isLoggingIn,
    login,
    loginError,
    user,
  } = useAuthState();

  const [socialData, setSocialData] = useState<SocialData>({
    following: [],
    followers: [],
    organizations: [],
    orgMembers: new Map(),
  });
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );
  const [isVisible, setIsVisible] = useState(true);
  const { isConnected } = useGitSyncConnection();
  const [presenceData, setPresenceData] = useState<UserPresence[]>([]);

  const baseContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
  };

  const renderState = (
    icon: React.ReactNode,
    title: string,
    description?: string,
    action?: React.ReactNode,
    footer?: React.ReactNode,
  ) => (
    <div style={baseContainerStyle}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '360px',
          }}
        >
          <div>{icon}</div>
          <div>
            <h3
              style={{
                margin: 0,
                marginBottom: '8px',
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  lineHeight: theme.lineHeights.body,
                  fontFamily: theme.fonts.body,
                }}
              >
                {description}
              </p>
            )}
          </div>
          {action}
          {footer}
        </div>
      </div>
    </div>
  );

  const fetchSocialData = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsFetching(true);
    setError(null);
    try {
      // Fetch following, followers, and organizations in parallel
      const [following, followers, organizations] = await Promise.all([
        GithubService.getUserFollowing(),
        GithubService.getUserFollowers(),
        GithubService.getUserOrganizations(),
      ]);

      // Fetch members for each organization
      const orgMembersMap = new Map<string, GitHubOrgMember[]>();
      await Promise.all(
        organizations.map(async (org) => {
          try {
            const members = await GithubService.getOrgMembers(org.login);
            orgMembersMap.set(org.login, members);
          } catch (err) {
            console.error(`Failed to load members for ${org.login}`, err);
          }
        }),
      );

      setSocialData({
        following,
        followers,
        organizations,
        orgMembers: orgMembersMap,
      });
    } catch (err) {
      console.error('Failed to load social data', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load social data from GitHub.',
      );
    } finally {
      setIsFetching(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchSocialData();
    } else {
      setSocialData({
        following: [],
        followers: [],
        organizations: [],
        orgMembers: new Map(),
      });
      setError(null);
    }
  }, [fetchSocialData, isAuthenticated]);

  // Fetch and subscribe to presence data
  useEffect(() => {
    if (!isConnected) {
      setPresenceData([]);
      return;
    }

    const fetchPresence = async () => {
      try {
        const data = await PresenceService.getUsers();
        setPresenceData(data.users || []);
      } catch (err) {
        console.error('[GitHubSocialPanel] Failed to fetch presence:', err);
      }
    };

    // Initial fetch
    void fetchPresence();

    // Subscribe to presence updates
    const unsubscribe = PresenceService.onPresenceEvent((_event) => {
      // Refetch presence data when any presence event occurs
      void fetchPresence();
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected]);

  const handleLogin = useCallback(async () => {
    try {
      await login();
    } catch (err) {
      console.error('GitHub login failed', err);
    }
  }, [login]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Handle visibility toggle
  const handleVisibilityToggle = useCallback(async () => {
    try {
      const newVisibility = !isVisible;
      const result = await PresenceService.setVisibility(newVisibility);
      if (result.success) {
        setIsVisible(newVisibility);
      } else {
        console.error('[GitHubSocialPanel] Failed to set visibility:', result.message);
      }
    } catch (err) {
      console.error('[GitHubSocialPanel] Failed to set visibility:', err);
    }
  }, [isVisible]);

  // Create a map of userId to presence status for quick lookups
  const presenceMap = useMemo(() => {
    const map = new Map<string, UserPresence['status']>();
    presenceData.forEach((presence) => {
      map.set(presence.userId, presence.status);
    });
    return map;
  }, [presenceData]);

  // Compute coworkers (people in your organizations)
  const coworkers = useMemo(() => {
    const coworkerMap = new Map<string, PersonWithOrg>();
    const currentUserLogin = user?.login;

    socialData.orgMembers.forEach((members, orgLogin) => {
      members.forEach((member) => {
        // Skip the current user
        if (currentUserLogin && member.login === currentUserLogin) {
          return;
        }

        if (!coworkerMap.has(member.login)) {
          coworkerMap.set(member.login, {
            ...member,
            organizations: [orgLogin],
            name: null,
            company: null,
            location: null,
            email: null,
            bio: null,
            public_repos: 0,
            public_gists: 0,
            followers: 0,
            following: 0,
            created_at: '',
            updated_at: '',
          });
        } else {
          const existing = coworkerMap.get(member.login);
          if (existing && existing.organizations) {
            existing.organizations.push(orgLogin);
          }
        }
      });
    });

    return Array.from(coworkerMap.values());
  }, [socialData.orgMembers, user?.login]);

  // Compute "other online users" - those who are online but not in coworkers/following/followers
  const otherOnlineUsers = useMemo(() => {
    const knownUserIds = new Set<string>();

    // Add all coworkers
    coworkers.forEach((person) => knownUserIds.add(person.login));

    // Add all following
    socialData.following.forEach((person) => knownUserIds.add(person.login));

    // Add all followers
    socialData.followers.forEach((person) => knownUserIds.add(person.login));

    // Add current user
    if (user?.login) {
      knownUserIds.add(user.login);
    }

    // Filter presence data for users not in the above sets and who are online
    return presenceData.filter(
      (presence) => presence.status === 'online' && !knownUserIds.has(presence.userId)
    );
  }, [coworkers, socialData.following, socialData.followers, presenceData, user?.login]);

  const hasData =
    socialData.following.length > 0 ||
    socialData.followers.length > 0 ||
    coworkers.length > 0;
  const isInitialLoading = isFetching && !hasData;

  if (isAuthLoading && !isAuthenticated) {
    return renderState(
      <Loader2
        className="animate-spin"
        size={32}
        style={{ color: theme.colors.textSecondary }}
      />,
      'Checking authentication status…',
      'Confirming your GitHub session.',
    );
  }

  if (!isAuthenticated) {
    return renderState(
      <AlertCircle
        size={32}
        style={{ color: theme.colors.warning || '#f59e0b' }}
      />,
      'Connect your GitHub account',
      'Sign in with GitHub to see your coworkers and people you follow.',
      <button
        type="button"
        onClick={handleLogin}
        disabled={isLoggingIn}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: theme.colors.primary,
          color: theme.colors.background,
          fontWeight: theme.fontWeights.semibold,
          fontSize: `${theme.fontSizes[1]}px`,
          fontFamily: theme.fonts.body,
          cursor: isLoggingIn ? 'not-allowed' : 'pointer',
          opacity: isLoggingIn ? 0.75 : 1,
        }}
      >
        <LogIn size={16} />
        {isLoggingIn ? 'Opening…' : 'Sign in with GitHub'}
      </button>,
      loginError ? (
        <p
          style={{
            margin: 0,
            color: theme.colors.error || '#ef4444',
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
          }}
        >
          {loginError}
        </p>
      ) : undefined,
    );
  }

  if (isInitialLoading) {
    return renderState(
      <Loader2
        className="animate-spin"
        size={32}
        style={{ color: theme.colors.textSecondary }}
      />,
      'Loading your network…',
      'Fetching coworkers and people you follow.',
    );
  }

  if (error && !hasData) {
    return renderState(
      <AlertCircle
        size={32}
        style={{ color: theme.colors.error || '#ef4444' }}
      />,
      'Unable to load social data',
      error,
    );
  }

  const contentContainerStyle: React.CSSProperties = {
    ...baseContainerStyle,
    padding: '16px',
    gap: '12px',
  };

  return (
    <div style={contentContainerStyle}>
      {error && hasData && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: `${theme.colors.error || '#ef4444'}20`,
            color: theme.colors.error || '#ef4444',
            fontSize: `${theme.fontSizes[1]}px`,
            fontFamily: theme.fonts.body,
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Visibility Control - only show when connected */}
      {isConnected && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: theme.colors.background,
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <span
            style={{
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
              fontWeight: theme.fontWeights.medium,
              color: theme.colors.text,
            }}
          >
            Connection Status
          </span>
          <button
            onClick={handleVisibilityToggle}
            disabled={!isConnected}
            style={{
              padding: '4px 10px',
              fontSize: `${theme.fontSizes[0]}px`,
              fontFamily: theme.fonts.body,
              fontWeight: theme.fontWeights.medium,
              color: isVisible ? '#10b981' : '#f59e0b',
              backgroundColor: isVisible ? `#10b98120` : `#f59e0b20`,
              border: `1px solid ${isVisible ? '#10b981' : '#f59e0b'}`,
              borderRadius: '3px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title={isVisible ? 'Click to go away' : 'Click to go online'}
          >
            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{isVisible ? 'Online' : 'Away'}</span>
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Online Now Section - Users online but not in other sections */}
        {otherOnlineUsers.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('onlineNow')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {collapsedSections.has('onlineNow') ? (
                  <ChevronRight size={16} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                )}
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                  }}
                />
                <span
                  style={{
                    fontSize: `${theme.fontSizes[2]}px`,
                    fontWeight: theme.fontWeights.semibold,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.text,
                  }}
                >
                  Online Now
                </span>
              </div>
              <span
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {otherOnlineUsers.length}
              </span>
            </button>

            {!collapsedSections.has('onlineNow') && (
              <div
                style={{
                  paddingLeft: '12px',
                  marginTop: '4px',
                }}
              >
                {otherOnlineUsers.map((presence) => (
                  <PersonItem
                    key={presence.userId}
                    person={{
                      id: 0,
                      login: presence.userId,
                      avatar_url: `https://github.com/${presence.userId}.png`,
                      url: `https://github.com/${presence.userId}`,
                      html_url: `https://github.com/${presence.userId}`,
                      type: 'User',
                      site_admin: false,
                    }}
                    theme={theme}
                    presenceStatus={presence.status}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Co-workers Section */}
        {coworkers.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('coworkers')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {collapsedSections.has('coworkers') ? (
                  <ChevronRight size={16} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                )}
                <Users size={16} color={theme.colors.textSecondary} />
                <span
                  style={{
                    fontSize: `${theme.fontSizes[2]}px`,
                    fontWeight: theme.fontWeights.semibold,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.text,
                  }}
                >
                  Co-workers
                </span>
              </div>
              <span
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {coworkers.length}
              </span>
            </button>

            {!collapsedSections.has('coworkers') && (
              <div
                style={{
                  paddingLeft: '12px',
                  marginTop: '4px',
                }}
              >
                {coworkers.map((person) => (
                  <PersonItem
                    key={person.id}
                    person={person}
                    theme={theme}
                    showOrgs={person.organizations}
                    presenceStatus={presenceMap.get(person.login)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Following Section */}
        {socialData.following.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('following')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {collapsedSections.has('following') ? (
                  <ChevronRight size={16} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                )}
                <Users size={16} color={theme.colors.textSecondary} />
                <span
                  style={{
                    fontSize: `${theme.fontSizes[2]}px`,
                    fontWeight: theme.fontWeights.semibold,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.text,
                  }}
                >
                  Following
                </span>
              </div>
              <span
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {socialData.following.length}
              </span>
            </button>

            {!collapsedSections.has('following') && (
              <div
                style={{
                  paddingLeft: '12px',
                  marginTop: '4px',
                }}
              >
                {socialData.following.map((person) => (
                  <PersonItem
                    key={person.id}
                    person={person}
                    theme={theme}
                    presenceStatus={presenceMap.get(person.login)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Followers Section */}
        {socialData.followers.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('followers')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {collapsedSections.has('followers') ? (
                  <ChevronRight size={16} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                )}
                <Users size={16} color={theme.colors.textSecondary} />
                <span
                  style={{
                    fontSize: `${theme.fontSizes[2]}px`,
                    fontWeight: theme.fontWeights.semibold,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.text,
                  }}
                >
                  Followers
                </span>
              </div>
              <span
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                }}
              >
                {socialData.followers.length}
              </span>
            </button>

            {!collapsedSections.has('followers') && (
              <div
                style={{
                  paddingLeft: '12px',
                  marginTop: '4px',
                }}
              >
                {socialData.followers.map((person) => (
                  <PersonItem
                    key={person.id}
                    person={person}
                    theme={theme}
                    presenceStatus={presenceMap.get(person.login)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface PersonItemProps {
  person: GitHubUser | GitHubOrgMember;
  theme: ReturnType<typeof useTheme>['theme'];
  showOrgs?: string[];
  presenceStatus?: 'online' | 'away' | 'offline';
}

const PersonItem: React.FC<PersonItemProps> = ({ person, theme, showOrgs, presenceStatus }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Get color for presence status
  const getPresenceColor = (status?: 'online' | 'away' | 'offline'): string => {
    switch (status) {
      case 'online':
        return '#10b981'; // green
      case 'away':
        return '#f59e0b'; // amber
      case 'offline':
        return '#6b7280'; // gray
      default:
        return 'transparent'; // no indicator if no status
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // If clicking the org count badge, toggle expansion
    if (showOrgs && showOrgs.length > 0 && (e.target as HTMLElement).closest('[data-org-badge]')) {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(!isExpanded);
      return;
    }
    // Otherwise, let the link navigate
  };

  return (
    <a
      href={`https://github.com/${person.login}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '4px',
        textDecoration: 'none',
        color: theme.colors.text,
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* Avatar with presence indicator */}
      <div style={{ position: 'relative' }}>
        <UserAvatar
          avatarUrl={person.avatar_url}
          username={person.login}
          size={40}
        />
        {/* Presence indicator dot */}
        {presenceStatus && (
          <div
            style={{
              position: 'absolute',
              bottom: '0px',
              right: '0px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: getPresenceColor(presenceStatus),
              border: `2px solid ${theme.colors.backgroundSecondary}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            }}
            title={`Status: ${presenceStatus}`}
          />
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.medium,
            fontFamily: theme.fonts.body,
            color: theme.colors.text,
          }}
        >
          {person.login}
        </span>
        {showOrgs && showOrgs.length > 0 && !isExpanded && (
          <span
            data-org-badge
            style={{
              fontSize: `${theme.fontSizes[0]}px`,
              fontFamily: theme.fonts.body,
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.backgroundSecondary,
              padding: '2px 6px',
              borderRadius: '3px',
              border: `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title={`Member of ${showOrgs.length} organization${showOrgs.length !== 1 ? 's' : ''}`}
          >
            {showOrgs.length} org{showOrgs.length !== 1 ? 's' : ''}
          </span>
        )}
        {showOrgs && showOrgs.length > 0 && isExpanded && (
          <div
            data-org-badge
            style={{
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap',
              cursor: 'pointer',
            }}
            title="Click to collapse"
          >
            {showOrgs.map((org) => (
              <span
                key={org}
                style={{
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.backgroundSecondary,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                {org}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
};

export const GitHubSocialPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: `${theme.fontSizes[0]}px`,
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: theme.fontWeights.semibold,
        }}
      >
        <Users size={16} style={{ color: theme.colors.primary }} />
        <span>GitHub Network</span>
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[0]}px`,
          fontFamily: theme.fonts.body,
          color: theme.colors.textSecondary,
        }}
      >
        View coworkers from your organizations and people you follow
      </div>
    </div>
  );
};
