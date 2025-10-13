import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  AlertCircle,
  Calendar,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  MessageSquare,
  RefreshCcw,
} from 'lucide-react';

import { GithubService } from '../../main-process-api/GithubService';
import type { GitHubPullRequest } from '../../../shared/main-process-api-interfaces/GitHubAPI';

interface PullRequestsTabProps {
  repository: {
    owner: string;
    name: string;
  };
  ghOwner?: string;
  ghRepo?: string;
}

export const PullRequestsTab: React.FC<PullRequestsTabProps> = ({
  repository,
  ghOwner,
  ghRepo,
}) => {
  const { theme } = useTheme();
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');

  const owner = ghOwner || repository.owner;
  const repo = ghRepo || repository.name;

  const isAuthResponse = (
    value: unknown,
  ): value is { requiresAuth?: boolean; message?: string } => {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as {
      requiresAuth?: unknown;
      message?: unknown;
    };

    return typeof candidate.requiresAuth === 'boolean';
  };

  const isPullRequestResponse = (
    value: unknown,
  ): value is GitHubPullRequest => {
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) {
      return 'Unknown';
    }

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (Number.isNaN(diffDays)) return 'Unknown';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const fetchPullRequests = useCallback(
    async (skipInitialLoading = false) => {
      if (!owner || !repo) {
        setError('Repository information not available');
        setLoading(false);
        return;
      }

      if (skipInitialLoading) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        setError(null);
        setAuthRequired(false);
        const rawData = (await GithubService.getPullRequests(
          owner,
          repo,
        )) as unknown;

        if (!Array.isArray(rawData)) {
          setPullRequests([]);
          return;
        }

        if (rawData.length === 1 && isAuthResponse(rawData[0])) {
          setAuthRequired(Boolean(rawData[0].requiresAuth));
          setError(
            rawData[0].message ??
              'Authentication required to view pull requests.',
          );
          setPullRequests([]);
        } else if (rawData.length === 0) {
          setPullRequests([]);
        } else {
          const cleaned = rawData.filter(isPullRequestResponse);
          setPullRequests(cleaned);
        }
      } catch (err) {
        console.error('Error fetching pull requests:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch pull requests.',
        );
      } finally {
        if (skipInitialLoading) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [owner, repo],
  );

  useEffect(() => {
    fetchPullRequests(false);
  }, [fetchPullRequests]);

  const filteredPullRequests = useMemo(() => {
    if (filter === 'all') {
      return pullRequests;
    }

    return pullRequests.filter((pr) => pr.state === filter);
  }, [filter, pullRequests]);

  const counts = useMemo(() => {
    const open = pullRequests.filter((pr) => pr.state === 'open').length;
    const closed = pullRequests.filter((pr) => pr.state === 'closed').length;
    return {
      open,
      closed,
      all: pullRequests.length,
    };
  }, [pullRequests]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '16px',
          color: theme.colors.textSecondary,
        }}
      >
        <Loader2 className="spin" size={28} />
        <div>Loading pull requests…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '12px',
          color: theme.colors.textSecondary,
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={28} style={{ color: theme.colors.warning }} />
        <div style={{ fontWeight: 600 }}>Unable to load pull requests</div>
        <div style={{ maxWidth: '360px', lineHeight: 1.5 }}>{error}</div>
        {authRequired && (
          <div style={{ fontSize: '13px', opacity: 0.8 }}>
            Run <code>gh auth login</code> in your terminal to authenticate with GitHub.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundLight,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: theme.colors.text }}>
              Pull Requests
            </div>
            <div
              style={{
                color: theme.colors.textSecondary,
                fontSize: '13px',
                marginTop: '4px',
              }}
            >
              {owner}/{repo}
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchPullRequests(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {refreshing ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <RefreshCcw size={16} />
            )}
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['open', 'closed', 'all'] as const).map((value) => {
            const isActive = filter === value;
            const label =
              value === 'open' ? 'Open' : value === 'closed' ? 'Closed' : 'All';

            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: isActive
                    ? 'none'
                    : `1px solid ${theme.colors.border}`,
                  backgroundColor: isActive
                    ? theme.colors.primary
                    : theme.colors.background,
                  color: isActive
                    ? theme.colors.background
                    : theme.colors.text,
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {label}
                <span style={{ opacity: 0.8 }}>
                  ({counts[value]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {filteredPullRequests.length === 0 ? (
          <div
            style={{
              marginTop: '48px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <GitPullRequest size={32} style={{ marginBottom: '12px' }} />
            <div style={{ fontWeight: 600 }}>No pull requests found</div>
            <div style={{ marginTop: '4px', fontSize: '13px' }}>
              There are no {filter !== 'all' ? `${filter} ` : ''}pull requests to display.
            </div>
          </div>
        ) : (
          filteredPullRequests.map((pr) => {
            const isMerged = pr.merged_at !== null;
            const isOpen = pr.state === 'open';

            const badgeColor = isOpen
              ? theme.colors.success || '#22c55e'
              : isMerged
                ? theme.colors.primary
                : theme.colors.error || '#ef4444';
            const badgeBg = `${badgeColor}22`;

            const totalComments = (pr.comments || 0) + (pr.review_comments || 0);

            return (
              <div
                key={pr.id}
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '12px',
                  padding: '16px',
                  backgroundColor: theme.colors.background,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          fontSize: '12px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {isOpen ? 'Open' : isMerged ? 'Merged' : 'Closed'}
                        {pr.draft && (
                          <span
                            style={{
                              marginLeft: '6px',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              backgroundColor: theme.colors.backgroundLight,
                              color: theme.colors.textSecondary,
                              fontSize: '11px',
                              fontWeight: 500,
                              textTransform: 'capitalize',
                            }}
                          >
                            Draft
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: theme.colors.text,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        #{pr.number} {pr.title}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                        color: theme.colors.textSecondary,
                        fontSize: '12px',
                      }}
                    >
                      <span>by {pr.user?.login ?? 'unknown'}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} /> Opened {formatDate(pr.created_at)}
                      </span>
                      {!isOpen && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {isMerged ? 'Merged' : 'Closed'} {formatDate(pr.merged_at || pr.updated_at)}
                        </span>
                      )}
                      {totalComments > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MessageSquare size={12} /> {totalComments} comment{totalComments === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: theme.colors.textSecondary,
                        fontSize: '12px',
                      }}
                    >
                      <GitBranch size={14} />
                      <span>
                        {pr.base?.ref ?? 'unknown'} <span style={{ opacity: 0.6 }}>←</span> {pr.head?.ref ?? 'unknown'}
                      </span>
                    </div>

                    {pr.body && (
                      <div
                        style={{
                          marginTop: '4px',
                          color: theme.colors.textSecondary,
                          fontSize: '13px',
                          lineHeight: 1.5,
                          maxHeight: '72px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {pr.body}
                      </div>
                    )}
                  </div>

                  <a
                    href={pr.html_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundLight,
                      color: theme.colors.text,
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    View
                    <ExternalLink size={14} />
                  </a>
                </div>

                {isMerged && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: theme.colors.primary,
                    }}
                  >
                    <GitMerge size={14} /> Merged into {pr.base?.ref ?? 'base'} from {pr.head?.ref ?? 'head'}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
