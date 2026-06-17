/**
 * CommitActivityPanel
 *
 * Shows recent commit activity for a single owner (user/org) or repo,
 * grouped by hour. Backed by the GitHub API (getOwnerActivity/getRepoActivity).
 * Used by the user/org profile activity tab.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Loader2, GitCommit } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import {
  RepoActivityCard,
  type RepoActivitySummary,
  type RepoActivityCardActions,
} from './RepoActivityCard';
import { RepoExplainOverlay, RepoReviewOverlay, type ExplainAudience } from './RepoExplainOverlay';
import type { CommitActivityCard } from '../../shared/tipc/webAdeRouterTypes';
import type { ActivityCommit } from '../hooks/useActivityFeed';
import type { ExplainCommitsInput } from '../../shared/tipc/webAdeRouterTypes';

export type CommitActivitySource =
  | { kind: 'owner'; login: string; accountType: 'User' | 'Organization' }
  | { kind: 'repo'; owner: string; repo: string };

/**
 * Actions for CommitActivityPanel.
 *
 * Extends RepoActivityCardActions so the panel can forward them to the
 * cards it renders, and adds the two activity-fetch calls the panel itself
 * needs. Host wires to real services; stories pass mocks.
 */
export interface CommitActivityPanelActions extends RepoActivityCardActions {
  getOwnerActivity: (
    login: string,
    type: 'User' | 'Organization',
  ) => Promise<CommitActivityCard[]>;
  getRepoActivity: (
    owner: string,
    repo: string,
  ) => Promise<CommitActivityCard[]>;
}

interface CommitActivityPanelProps {
  source: CommitActivitySource;
  events: PanelEventEmitter;
  hideHeader?: boolean;
  actions: CommitActivityPanelActions;
}

function formatHourLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (diffH < 1) return 'Last hour';
  if (diffH < 6) return diffH === 1 ? '1 hour ago' : `${diffH} hours ago`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return timeStr;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeStr}`;

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

interface HourlyGroup {
  hourBucket: string;
  hourLabel: string;
  repos: RepoActivitySummary[];
}

function cardsToHourlyGroups(cards: CommitActivityCard[]): HourlyGroup[] {
  // Group cards by hourBucket, then by repo within each hour
  const hourMap = new Map<string, Map<string, RepoActivitySummary>>();

  for (const card of cards) {
    let repoMap = hourMap.get(card.hourBucket);
    if (!repoMap) {
      repoMap = new Map();
      hourMap.set(card.hourBucket, repoMap);
    }
    const key = `${card.repo.owner}/${card.repo.name}`;

    let summary = repoMap.get(key);
    if (!summary) {
      summary = {
        repoPath: '',
        repoName: card.repo.name,
        commits: [],
        latestCommitAt: new Date(card.latestCommitAt),
        commitCount: 0,
        githubOwner: card.repo.owner,
        githubRepoName: card.repo.name,
      };
      repoMap.set(key, summary);
    }
    for (const c of card.commits) {
      const commit: ActivityCommit = {
        repoName: card.repo.name,
        repoPath: '',
        hash: c.sha,
        message: c.message,
        author: c.author.login,
        authorEmail: '',
        authorAvatarUrl: c.author.avatarUrl,
        date: c.committedAt,
      };
      if (!summary.commits.some(e => e.hash === c.sha)) {
        summary.commits.push(commit);
        summary.commitCount++;
      }
    }

    const cardDate = new Date(card.latestCommitAt);
    if (cardDate > summary.latestCommitAt) {
      summary.latestCommitAt = cardDate;
    }
  }

  // Sort hours newest first
  return Array.from(hourMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([hourBucket, repoMap]) => ({
      hourBucket,
      hourLabel: formatHourLabel(hourBucket),
      repos: Array.from(repoMap.values()).sort(
        (a, b) => b.latestCommitAt.getTime() - a.latestCommitAt.getTime()
      ),
    }));
}

interface ExplainState {
  isOpen: boolean;
  loading: boolean;
  repoName: string | null;
  markdown: string | null;
  audience: ExplainAudience;
  pendingCommits: ExplainCommitsInput['commits'] | null;
}

export const CommitActivityPanel: React.FC<CommitActivityPanelProps> = ({ source, events, hideHeader = false, actions }) => {
  const { theme } = useTheme();
  const [cards, setCards] = useState<CommitActivityCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [explain, setExplain] = useState<ExplainState>({
    isOpen: false,
    loading: false,
    repoName: null,
    markdown: null,
    audience: 'maintainer',
    pendingCommits: null,
  });
  const [review, setReview] = useState<{
    isOpen: boolean;
    repoPath: string;
    repoName: string;
    githubOwner?: string;
    githubRepoName?: string;
    commit: ActivityCommit | null;
  }>({
    isOpen: false,
    repoPath: '',
    repoName: '',
    commit: null,
  });

  const label = source.kind === 'owner' ? source.login : `${source.owner}/${source.repo}`;

  // Destructure to primitives so the effect doesn't re-fire on every render
  // (renderTabContent creates a new source object each call)
  const sourceKind = source.kind;
  const sourceLogin = source.kind === 'owner' ? source.login : undefined;
  const sourceAccountType = source.kind === 'owner' ? source.accountType : undefined;
  const sourceOwner = source.kind === 'repo' ? source.owner : undefined;
  const sourceRepo = source.kind === 'repo' ? source.repo : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCards([]);

    // Narrow on the destructured primitives themselves: when `sourceKind` is
    // 'owner' the two owner fields are always set (and the repo fields unset),
    // and vice-versa — see the destructuring above. Testing the values lets TS
    // prove non-null without re-introducing `source` into the dep array. The
    // final branch is unreachable but keeps the type total.
    const fetch =
      sourceLogin !== undefined && sourceAccountType !== undefined
        ? actions.getOwnerActivity(sourceLogin, sourceAccountType)
        : sourceOwner !== undefined && sourceRepo !== undefined
          ? actions.getRepoActivity(sourceOwner, sourceRepo)
          : Promise.resolve<CommitActivityCard[]>([]);

    fetch.then(result => {
      if (!cancelled) {
        setCards(result);
        setLoading(false);
      }
    }).catch(err => {
      console.error('[CommitActivityPanel] Failed to load activity:', err);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [sourceKind, sourceLogin, sourceAccountType, sourceOwner, sourceRepo, actions]);

  const hourlyGroups = useMemo(() => cardsToHourlyGroups(cards), [cards]);

  // Listen for repo explain requests from cards
  useEffect(() => {
    const handler = (event: { type: string; payload: { repoName: string; commits: ExplainCommitsInput['commits'] } }) => {
      if (event.type !== 'repo:explain-requested') return;
      setExplain(prev => ({
        isOpen: true,
        loading: true,
        repoName: event.payload.repoName,
        markdown: null,
        audience: prev.audience,
        pendingCommits: event.payload.commits,
      }));
    };
    events.on('repo:explain-requested', handler);
    return () => {
      events.off('repo:explain-requested', handler);
    };
  }, [events]);

  // Fetch explanation whenever a request becomes pending or audience changes
  useEffect(() => {
    if (!explain.pendingCommits || !explain.repoName) return;
    let cancelled = false;
    const commits = explain.pendingCommits;
    const repoName = explain.repoName;
    const audience = explain.audience;
    setExplain(prev => ({ ...prev, loading: true, markdown: null }));
    actions.explainCommits({ commits, audienceLevel: audience, repoName })
      .then(result => {
        if (cancelled) return;
        setExplain(prev => ({ ...prev, loading: false, markdown: result.text }));
      })
      .catch(err => {
        console.error('[CommitActivityPanel] explain failed:', err);
        if (cancelled) return;
        setExplain(prev => ({ ...prev, loading: false, markdown: 'Failed to generate explanation. Please try again.' }));
      });
    return () => {
      cancelled = true;
    };
  }, [explain.pendingCommits, explain.audience, explain.repoName, actions]);

  const handleExplainAudienceChange = useCallback((audience: ExplainAudience) => {
    setExplain(prev => (prev.audience === audience ? prev : { ...prev, audience }));
  }, []);

  const handleExplainClose = useCallback(() => {
    setExplain(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Listen for commit review requests from cards
  useEffect(() => {
    const handler = (event: {
      type: string;
      payload: {
        repoPath: string;
        repoName: string;
        githubOwner?: string;
        githubRepoName?: string;
        commit: ActivityCommit;
      };
    }) => {
      if (event.type !== 'commit:review-selected') return;
      setReview({
        isOpen: true,
        repoPath: event.payload.repoPath,
        repoName: event.payload.repoName,
        githubOwner: event.payload.githubOwner,
        githubRepoName: event.payload.githubRepoName,
        commit: event.payload.commit,
      });
    };
    events.on('commit:review-selected', handler);
    return () => {
      events.off('commit:review-selected', handler);
    };
  }, [events]);

  const handleReviewClose = useCallback(() => {
    setReview(prev => ({ ...prev, isOpen: false }));
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const spacing = { xs: 4, sm: 8, md: 16 };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: theme.colors.background, overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      {!hideHeader && (
        <div
          onClick={() => {
            const owner = source.kind === 'owner' ? source.login : source.owner;
            const isOrg = source.kind === 'owner' && source.accountType === 'Organization';
            events.emit({
              type: 'owner:selected',
              source: 'commit-activity-panel',
              timestamp: Date.now(),
              payload: { owner, isOrg },
            });
          }}
          style={{ padding: `${spacing.md}px ${spacing.md}px`, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', gap: spacing.md, flexShrink: 0, cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <img
            src={`https://github.com/${source.kind === 'owner' ? source.login : source.owner}.png?size=80`}
            alt={label}
            style={{
              width: 40,
              height: 40,
              borderRadius: source.kind === 'owner' && source.accountType === 'Organization'
                ? theme.radii?.[3] || 6
                : '50%',
              border: `1px solid ${theme.colors.border}`,
            }}
          />
          {source.kind === 'repo' ? (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontFamily: theme.fonts?.heading ?? theme.fonts?.body, fontSize: theme.fontSizes[2], fontWeight: 600, color: theme.colors.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {source.repo}
              </span>
              <span style={{ fontFamily: theme.fonts?.body, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {source.owner}
              </span>
            </div>
          ) : (
            <span style={{ fontFamily: theme.fonts?.heading ?? theme.fonts?.body, fontSize: theme.fontSizes[2], fontWeight: 600, color: theme.colors.text }}>
              {label}
            </span>
          )}
          <span style={{ fontFamily: theme.fonts?.body, fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, marginLeft: 'auto' }}>
            Last 7 days
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: spacing.sm }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.colors.textSecondary }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : hourlyGroups.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.colors.textSecondary, gap: spacing.sm }}>
            <GitCommit size={28} style={{ opacity: 0.3 }} />
            <span style={{ fontFamily: theme.fonts?.body, fontSize: theme.fontSizes[1] }}>No activity in the last 7 days</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {hourlyGroups.map(group => (
              <div key={group.hourBucket}>
                <div style={{ fontFamily: theme.fonts?.heading ?? theme.fonts?.body, fontSize: theme.fontSizes[0], fontWeight: 600, color: theme.colors.textSecondary, marginBottom: spacing.sm, paddingLeft: spacing.xs }}>
                  {group.hourLabel}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {group.repos.map(summary => {
                    const key = `${group.hourBucket}:${summary.githubOwner}/${summary.repoName}`;
                    return (
                      <RepoActivityCard
                        key={key}
                        summary={summary}
                        isExpanded={expandedCards.has(key)}
                        onToggleExpand={() => toggleExpand(key)}
                        onOpen={() => {}}
                        hideRepoHeader={source.kind === 'repo'}
                        events={events}
                        actions={actions}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RepoExplainOverlay
        isOpen={explain.isOpen}
        repoName={explain.repoName}
        markdown={explain.markdown}
        loading={explain.loading}
        audience={explain.audience}
        onAudienceChange={handleExplainAudienceChange}
        onClose={handleExplainClose}
      />
      <RepoReviewOverlay
        isOpen={review.isOpen}
        repoPath={review.repoPath}
        repoName={review.repoName}
        githubOwner={review.githubOwner}
        githubRepoName={review.githubRepoName}
        commit={review.commit}
        onClose={handleReviewClose}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default CommitActivityPanel;
