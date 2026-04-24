/**
 * WatchedActivityPanel
 *
 * Shows commit activity for a single watched owner (user/org) or repo.
 * Used when clicking a watched item in the feed left panel.
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
import type { CommitActivityCard } from '../../shared/tipc/webAdeRouterTypes';
import type { ActivityCommit } from '../hooks/useActivityFeed';

export type WatchedActivitySource =
  | { kind: 'owner'; login: string; accountType: 'User' | 'Organization' }
  | { kind: 'repo'; owner: string; repo: string };

/**
 * Actions for WatchedActivityPanel.
 *
 * Extends RepoActivityCardActions so the panel can forward them to the
 * cards it renders, and adds the two activity-fetch calls the panel itself
 * needs. Host wires to real services; stories pass mocks.
 */
export interface WatchedActivityPanelActions extends RepoActivityCardActions {
  getOwnerActivity: (
    login: string,
    type: 'User' | 'Organization',
  ) => Promise<CommitActivityCard[]>;
  getRepoActivity: (
    owner: string,
    repo: string,
  ) => Promise<CommitActivityCard[]>;
}

interface WatchedActivityPanelProps {
  source: WatchedActivitySource;
  events: PanelEventEmitter;
  hideHeader?: boolean;
  actions: WatchedActivityPanelActions;
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
    if (!hourMap.has(card.hourBucket)) {
      hourMap.set(card.hourBucket, new Map());
    }
    const repoMap = hourMap.get(card.hourBucket)!;
    const key = `${card.repo.owner}/${card.repo.name}`;

    if (!repoMap.has(key)) {
      repoMap.set(key, {
        repoPath: '',
        repoName: card.repo.name,
        commits: [],
        latestCommitAt: new Date(card.latestCommitAt),
        commitCount: 0,
        githubOwner: card.repo.owner,
        githubRepoName: card.repo.name,
      });
    }

    const summary = repoMap.get(key)!;
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

export const WatchedActivityPanel: React.FC<WatchedActivityPanelProps> = ({ source, events, hideHeader = false, actions }) => {
  const { theme } = useTheme();
  const [cards, setCards] = useState<CommitActivityCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

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

    const fetch = sourceKind === 'owner'
      ? actions.getOwnerActivity(sourceLogin!, sourceAccountType!)
      : actions.getRepoActivity(sourceOwner!, sourceRepo!);

    fetch.then(result => {
      if (!cancelled) {
        setCards(result);
        setLoading(false);
      }
    }).catch(err => {
      console.error('[WatchedActivityPanel] Failed to load activity:', err);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [sourceKind, sourceLogin, sourceAccountType, sourceOwner, sourceRepo, actions]);

  const hourlyGroups = useMemo(() => cardsToHourlyGroups(cards), [cards]);

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: theme.colors.background, overflow: 'hidden' }}>
      {/* Header */}
      {!hideHeader && (
        <div
          onClick={() => {
            const owner = source.kind === 'owner' ? source.login : source.owner;
            const isOrg = source.kind === 'owner' && source.accountType === 'Organization';
            events.emit({
              type: 'feed:owner-selected',
              source: 'watched-activity-panel',
              timestamp: Date.now(),
              payload: { owner, isOrg },
            });
          }}
          style={{ padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', gap: spacing.sm, flexShrink: 0, cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <img
            src={`https://github.com/${source.kind === 'owner' ? source.login : source.owner}.png?size=40`}
            alt={label}
            style={{
              width: 24,
              height: 24,
              borderRadius: source.kind === 'owner' && source.accountType === 'Organization'
                ? theme.radii?.[3] || 6
                : '50%',
              border: `1px solid ${theme.colors.border}`,
            }}
          />
          <span style={{ fontSize: theme.fontSizes[1], fontWeight: 600, color: theme.colors.text }}>
            {label}
          </span>
          <span style={{ fontSize: theme.fontSizes[0], color: theme.colors.textSecondary, marginLeft: 'auto' }}>
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
            <span style={{ fontSize: theme.fontSizes[1] }}>No activity in the last 7 days</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {hourlyGroups.map(group => (
              <div key={group.hourBucket}>
                <div style={{ fontSize: theme.fontSizes[0], fontWeight: 600, color: theme.colors.textSecondary, marginBottom: spacing.sm, paddingLeft: spacing.xs }}>
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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default WatchedActivityPanel;
