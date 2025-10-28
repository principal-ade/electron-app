import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  LogIn,
  Search,
  Users,
} from 'lucide-react';

import { useAuthState } from '../../hooks/useAuthState';
import { GithubService } from '../../main-process-api/GithubService';
import type {
  GitHubUser,
  GitHubOrganization,
  GitHubOrgMember,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';

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
  } = useAuthState();

  const [socialData, setSocialData] = useState<SocialData>({
    following: [],
    followers: [],
    organizations: [],
    orgMembers: new Map(),
  });
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

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
                fontSize: '18px',
                fontWeight: 600,
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  lineHeight: 1.5,
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

  // Compute coworkers (people in your organizations)
  const coworkers = useMemo(() => {
    const coworkerMap = new Map<string, PersonWithOrg>();

    socialData.orgMembers.forEach((members, orgLogin) => {
      members.forEach((member) => {
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
          const existing = coworkerMap.get(member.login)!;
          existing.organizations?.push(orgLogin);
        }
      });
    });

    return Array.from(coworkerMap.values());
  }, [socialData.orgMembers]);

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredCoworkers = useMemo(
    () =>
      coworkers.filter((person) =>
        person.login.toLowerCase().includes(normalizedFilter),
      ),
    [coworkers, normalizedFilter],
  );

  const filteredFollowing = useMemo(
    () =>
      socialData.following.filter((person) =>
        person.login.toLowerCase().includes(normalizedFilter),
      ),
    [socialData.following, normalizedFilter],
  );

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
          fontWeight: 600,
          fontSize: '14px',
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
            fontSize: '13px',
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
      <AlertCircle size={32} style={{ color: theme.colors.error || '#ef4444' }} />,
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
      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            top: '50%',
            left: '12px',
            transform: 'translateY(-50%)',
            color: theme.colors.textSecondary,
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={filter}
          placeholder="Search people..."
          onChange={(event) => setFilter(event.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

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
            fontSize: '13px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
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
        {/* Organizations Section */}
        {socialData.organizations.map((org) => {
          const sectionId = `org-${org.login}`;
          const isCollapsed = collapsedSections.has(sectionId);
          const members = socialData.orgMembers.get(org.login) || [];
          const filteredMembers = normalizedFilter
            ? members.filter((m) =>
                m.login.toLowerCase().includes(normalizedFilter),
              )
            : members;

          if (normalizedFilter && filteredMembers.length === 0) {
            return null;
          }

          return (
            <div key={org.login}>
              <button
                onClick={() => toggleSection(sectionId)}
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
                  e.currentTarget.style.backgroundColor =
                    theme.colors.background;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isCollapsed ? (
                    <ChevronRight size={16} color={theme.colors.textSecondary} />
                  ) : (
                    <ChevronDown size={16} color={theme.colors.textSecondary} />
                  )}
                  <img
                    src={org.avatar_url}
                    alt={org.login}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    {org.login}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  {normalizedFilter
                    ? `${filteredMembers.length} / ${members.length}`
                    : members.length}
                </span>
              </button>

              {!isCollapsed && (
                <div
                  style={{
                    paddingLeft: '12px',
                    marginTop: '4px',
                  }}
                >
                  {filteredMembers.map((member) => (
                    <PersonItem key={member.id} person={member} theme={theme} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Following Section */}
        {filteredFollowing.length > 0 && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {collapsedSections.has('following') ? (
                  <ChevronRight size={16} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                )}
                <Users size={16} color={theme.colors.textSecondary} />
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Following
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                {normalizedFilter
                  ? `${filteredFollowing.length} / ${socialData.following.length}`
                  : filteredFollowing.length}
              </span>
            </button>

            {!collapsedSections.has('following') && (
              <div
                style={{
                  paddingLeft: '12px',
                  marginTop: '4px',
                }}
              >
                {filteredFollowing.map((person) => (
                  <PersonItem key={person.id} person={person} theme={theme} />
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
  theme: any;
}

const PersonItem: React.FC<PersonItemProps> = ({ person, theme }) => {
  return (
    <a
      href={`https://github.com/${person.login}`}
      target="_blank"
      rel="noopener noreferrer"
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
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: theme.colors.success || '#10b981',
          flexShrink: 0,
        }}
      />
      <img
        src={person.avatar_url}
        alt={person.login}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: '13px',
          color: theme.colors.text,
        }}
      >
        {person.login}
      </span>
    </a>
  );
};

export const GitHubSocialPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
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
          fontWeight: 600,
        }}
      >
        <Users size={16} style={{ color: theme.colors.primary }} />
        <span>GitHub Network</span>
      </div>
      <div
        style={{
          fontSize: '11px',
          color: theme.colors.textSecondary,
        }}
      >
        View coworkers from your organizations and people you follow
      </div>
    </div>
  );
};
