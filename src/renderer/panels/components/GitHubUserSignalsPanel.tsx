import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  AlertCircle,
  Award,
  BarChart3,
  GitPullRequest,
  Loader2,
  LogIn,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

import { useAuthState } from '../../hooks/useAuthState';
import { GithubService } from '../../main-process-api/GithubService';
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
} from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { useSelectedRepository } from '../../contexts/SelectedRepositoryContext';

interface CollaboratorSummary {
  login: string;
  avatarUrl: string | null;
  issueCount: number;
  pullRequestCount: number;
  assignmentCount: number;
  totalContributions: number;
  lastActivity: string | null;
}

interface UserSignalsMetrics {
  uniqueCollaborators: number;
  starCount: number;
  userIndex: number;
  issuesCount: number;
  pullRequestCount: number;
  mergedPullRequests: number;
  openIssues: number;
  lastUpdated: number | null;
}

type AuthResponse = { requiresAuth?: boolean; message?: string };

const isAuthResponse = (value: unknown): value is AuthResponse => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { requiresAuth?: unknown };
  return typeof candidate.requiresAuth === 'boolean';
};

const isIssue = (value: unknown): value is GitHubIssue => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<GitHubIssue>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.number === 'number' &&
    typeof candidate.title === 'string' &&
    typeof candidate.state === 'string' &&
    typeof candidate.html_url === 'string' &&
    !!candidate.user
  );
};

const isPullRequest = (value: unknown): value is GitHubPullRequest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<GitHubPullRequest>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.number === 'number' &&
    typeof candidate.title === 'string' &&
    typeof candidate.state === 'string' &&
    typeof candidate.html_url === 'string'
  );
};

const isLikelyBot = (login: string) => {
  const lower = login.toLowerCase();
  return (
    lower.endsWith('[bot]') ||
    lower.includes('-bot') ||
    lower.includes('_bot') ||
    lower.includes('bot/') ||
    lower.startsWith('dependabot')
  );
};

const formatRelativeTime = (dateString: string | null) => {
  if (!dateString) {
    return 'Unknown';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

const getRepositoryCoordinates = (
  repository: GitHubRepository | null,
): { owner: string; name: string } | null => {
  if (!repository) {
    return null;
  }

  const owner = repository.owner?.login;
  const name = repository.name;

  if (!owner || !name) {
    return null;
  }

  return { owner, name };
};

export const GitHubUserSignalsPanel: React.FC = () => {
  const { theme } = useTheme();
  const { selectedRepository } = useSelectedRepository();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    isLoggingIn,
    login,
    loginError,
  } = useAuthState();

  const [metrics, setMetrics] = useState<UserSignalsMetrics | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const coordinates = useMemo(
    () => getRepositoryCoordinates(selectedRepository),
    [selectedRepository],
  );

  const baseContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
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

  const handleLogin = useCallback(async () => {
    try {
      await login();
    } catch (err) {
      console.error('GitHub login failed', err);
    }
  }, [login]);

  useEffect(() => {
    if (!isAuthenticated || !coordinates) {
      setMetrics(null);
      setCollaborators([]);
      setError(null);
      setAuthRequired(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchSignals = async () => {
      setIsLoading(true);
      setError(null);
      setAuthRequired(false);

      try {
        const [issuesRaw, pullRequestsRaw] = await Promise.all([
          GithubService.getIssues(coordinates.owner, coordinates.name),
          GithubService.getPullRequests(coordinates.owner, coordinates.name),
        ]);

        if (cancelled) {
          return;
        }

        if (
          Array.isArray(issuesRaw) &&
          issuesRaw.length === 1 &&
          isAuthResponse(issuesRaw[0])
        ) {
          setAuthRequired(true);
          setError(
            issuesRaw[0].message ??
              'Authentication required to analyze repository issues.',
          );
          setMetrics(null);
          setCollaborators([]);
          return;
        }

        if (
          Array.isArray(pullRequestsRaw) &&
          pullRequestsRaw.length === 1 &&
          isAuthResponse(pullRequestsRaw[0])
        ) {
          setAuthRequired(true);
          setError(
            pullRequestsRaw[0].message ??
              'Authentication required to analyze repository pull requests.',
          );
          setMetrics(null);
          setCollaborators([]);
          return;
        }

        const issues = Array.isArray(issuesRaw)
          ? issuesRaw.filter(isIssue)
          : [];
        const pullRequests = Array.isArray(pullRequestsRaw)
          ? pullRequestsRaw.filter(isPullRequest)
          : [];

        const collaboratorMap = new Map<string, CollaboratorSummary>();

        const recordContribution = (
          login: string,
          avatarUrl: string | null,
          type: 'issue' | 'pullRequest' | 'assignment',
          activityDate: string | null,
        ) => {
          if (!login || isLikelyBot(login)) {
            return;
          }

          const existing = collaboratorMap.get(login);
          const base: CollaboratorSummary =
            existing ?? {
              login,
              avatarUrl,
              issueCount: 0,
              pullRequestCount: 0,
              assignmentCount: 0,
              totalContributions: 0,
              lastActivity: activityDate,
            };

          if (activityDate) {
            if (!base.lastActivity) {
              base.lastActivity = activityDate;
            } else if (
              new Date(activityDate).getTime() >
              new Date(base.lastActivity).getTime()
            ) {
              base.lastActivity = activityDate;
            }
          }

          if (type === 'issue') {
            base.issueCount += 1;
          } else if (type === 'pullRequest') {
            base.pullRequestCount += 1;
          } else {
            base.assignmentCount += 1;
          }

          base.totalContributions =
            base.issueCount + base.pullRequestCount + base.assignmentCount;

          collaboratorMap.set(login, base);
        };

        issues.forEach((issue) => {
          if (issue.user?.login) {
            recordContribution(
              issue.user.login,
              issue.user.avatar_url ?? null,
              'issue',
              issue.updated_at || issue.created_at,
            );
          }

          issue.assignees?.forEach((assignee) => {
            if (!assignee?.login) {
              return;
            }
            recordContribution(
              assignee.login,
              assignee.avatar_url ?? null,
              'assignment',
              issue.updated_at || issue.created_at,
            );
          });
        });

        pullRequests.forEach((pr) => {
          if (pr.user?.login) {
            recordContribution(
              pr.user.login,
              pr.user.avatar_url ?? null,
              'pullRequest',
              pr.updated_at || pr.created_at,
            );
          }
        });

        const collaboratorSummaries = Array.from(collaboratorMap.values()).sort(
          (a, b) => {
            if (b.totalContributions !== a.totalContributions) {
              return b.totalContributions - a.totalContributions;
            }

            const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
            const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
            return bTime - aTime;
          },
        );

        const starCount = selectedRepository?.stargazers_count ?? 0;
        const uniqueCollaborators = collaboratorSummaries.length;
        const issuesCount = issues.length;
        const pullRequestCount = pullRequests.length;
        const mergedPullRequests = pullRequests.filter(
          (pr) => pr.merged_at !== null,
        ).length;
        const openIssues = issues.filter((issue) => issue.state === 'open').length;
        const userIndex = Math.round(
          uniqueCollaborators * 2 + Math.sqrt(Math.max(starCount, 0)),
        );

        setMetrics({
          uniqueCollaborators,
          starCount,
          userIndex,
          issuesCount,
          pullRequestCount,
          mergedPullRequests,
          openIssues,
          lastUpdated: Date.now(),
        });
        setCollaborators(collaboratorSummaries);
      } catch (err) {
        console.error('Failed to load GitHub user signals', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load GitHub user signals.',
        );
        setMetrics(null);
        setCollaborators([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchSignals();

    return () => {
      cancelled = true;
    };
  }, [coordinates, isAuthenticated, selectedRepository]);

  if (isAuthLoading && !isAuthenticated) {
    return renderState(
      <Loader2 size={32} style={{ color: theme.colors.textSecondary }} />,
      'Checking GitHub authentication…',
      'We use your GitHub session to analyze repository activity.',
    );
  }

  if (!isAuthenticated) {
    return renderState(
      <AlertCircle size={32} style={{ color: theme.colors.warning || '#f59e0b' }} />,
      'Sign in to see user signals',
      'Connect GitHub so we can estimate repository user engagement from issues and pull requests.',
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
          opacity: isLoggingIn ? 0.7 : 1,
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

  if (!coordinates) {
    return renderState(
      <Users size={32} style={{ color: theme.colors.textSecondary }} />,
      'Select a repository',
      'Choose a repository to see how many users are engaging with it.',
    );
  }

  if (authRequired) {
    return renderState(
      <AlertCircle size={32} style={{ color: theme.colors.warning || '#f59e0b' }} />,
      'Additional authentication required',
      error ??
        'We need additional GitHub permissions to load engagement data for this repository.',
    );
  }

  if (isLoading) {
    return renderState(
      <Loader2 size={32} className="spin-animation" style={{ color: theme.colors.textSecondary }} />,
      'Analyzing GitHub activity…',
      'Collecting recent issues, pull requests, and stars to estimate user engagement.',
    );
  }

  if (error) {
    return renderState(
      <AlertCircle size={32} style={{ color: theme.colors.error || '#ef4444' }} />,
      'Unable to load user signals',
      error,
    );
  }

  return (
    <div style={baseContainerStyle}>
      <div
        style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color={theme.colors.text} />
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                GitHub User Signals
              </h3>
              {metrics?.lastUpdated && (
                <p
                  style={{
                    margin: 0,
                    color: theme.colors.textSecondary,
                    fontSize: '13px',
                  }}
                >
                  Updated {formatRelativeTime(new Date(metrics.lastUpdated).toISOString())}
                </p>
              )}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: theme.colors.textSecondary,
              fontSize: '13px',
            }}
          >
            <Sparkles size={16} />
            <span>
              User Index = (Unique collaborators × 2) + √Stars
            </span>
          </div>
        </div>

        {metrics && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
            }}
          >
            <MetricCard
              icon={<Award size={18} color={theme.colors.primary} />}
              label="User Index"
              value={metrics.userIndex.toLocaleString()}
              theme={theme}
            />
            <MetricCard
              icon={<Users size={18} color={theme.colors.accent || theme.colors.text} />}
              label="Unique collaborators"
              value={metrics.uniqueCollaborators.toLocaleString()}
              theme={theme}
              helper={`${metrics.openIssues} open issues`}
            />
            <MetricCard
              icon={<Star size={18} color={theme.colors.warning || '#f59e0b'} />}
              label="Stargazers"
              value={metrics.starCount.toLocaleString()}
              theme={theme}
              helper={`${metrics.pullRequestCount} pull requests`}
            />
            <MetricCard
              icon={<BarChart3 size={18} color={theme.colors.text} />}
              label="Merged pull requests"
              value={metrics.mergedPullRequests.toLocaleString()}
              theme={theme}
              helper={`${metrics.issuesCount} total issues`}
            />
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {collaborators.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              textAlign: 'center',
              border: `1px dashed ${theme.colors.border}`,
              borderRadius: '8px',
              color: theme.colors.textSecondary,
              gap: '12px',
            }}
          >
            <GitPullRequest size={24} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: theme.colors.text }}>
                No recent collaborator activity
              </p>
              <p style={{ margin: 0 }}>
                Create an issue or pull request to start building your user index.
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {collaborators.map((collaborator) => (
              <CollaboratorRow
                key={collaborator.login}
                collaborator={collaborator}
                theme={theme}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
  helper?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  theme,
  helper,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '14px 16px',
      borderRadius: '8px',
      border: `1px solid ${theme.colors.border}`,
      backgroundColor: theme.colors.background,
      minHeight: '84px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      <span
        style={{
          fontSize: '13px',
          textTransform: 'uppercase',
          color: theme.colors.textSecondary,
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
    <span
      style={{
        fontSize: '24px',
        fontWeight: 700,
        color: theme.colors.text,
        lineHeight: 1.1,
      }}
    >
      {value}
    </span>
    {helper && (
      <span style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
        {helper}
      </span>
    )}
  </div>
);

interface CollaboratorRowProps {
  collaborator: CollaboratorSummary;
  theme: ReturnType<typeof useTheme>['theme'];
}

const CollaboratorRow: React.FC<CollaboratorRowProps> = ({
  collaborator,
  theme,
}) => {
  const chips: Array<{ label: string; count: number }> = [
    { label: 'Issues', count: collaborator.issueCount },
    { label: 'PRs', count: collaborator.pullRequestCount },
    { label: 'Assignments', count: collaborator.assignmentCount },
  ].filter((chip) => chip.count > 0);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '14px 16px',
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.background,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: theme.colors.backgroundSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          {collaborator.avatarUrl ? (
            <img
              src={collaborator.avatarUrl}
              alt={collaborator.login}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            collaborator.login.slice(0, 2).toUpperCase()
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span
            style={{ fontWeight: 600, color: theme.colors.text, fontSize: '15px' }}
          >
            {collaborator.login}
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {chips.map((chip) => (
              <span
                key={chip.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '999px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.textSecondary,
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {chip.label}
                <span style={{ color: theme.colors.text, fontWeight: 700 }}>
                  {chip.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          textAlign: 'right',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
          }}
        >
          Last active {formatRelativeTime(collaborator.lastActivity)}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
          }}
        >
          {collaborator.totalContributions} contributions
        </span>
      </div>
    </div>
  );
};

