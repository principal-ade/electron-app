/**
 * InProgressActivityPanel
 *
 * Grid-view panel that lists repositories with uncommitted working-tree
 * changes. Each repo is shown as a square card in a two-column grid; the card's
 * Changes / ahead / behind affordances reveal lists inline over the map.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderCheck } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { GithubService } from '../main-process-api/GithubService';
import {
  InProgressRepoCard,
  type InProgressRepoCardActions,
  type InProgressSummary,
} from './InProgressRepoCard';

export interface InProgressActivityPanelProps {
  repositories: AlexandriaEntry[];
  events: PanelEventEmitter;
  actions: InProgressRepoCardActions;
}

interface DirtyRow {
  entry: AlexandriaEntry;
  status: GitStatusWithFiles;
  summary: InProgressSummary;
}

function statusToSummary(
  entry: AlexandriaEntry,
  status: GitStatusWithFiles,
  isOwnerOrg: boolean | undefined,
): InProgressSummary {
  return {
    repoPath: String(entry.path),
    repoName: entry.name,
    branch: status.branch,
    isDirty: status.isDirty,
    aheadCount: status.ahead,
    behindCount: status.behind,
    githubOwner: entry.github?.owner,
    githubRepoName: entry.github?.name ?? entry.name,
    isOwnerOrg,
    lastEditAt: status.lastChangedAt ? new Date(status.lastChangedAt) : undefined,
  };
}

export const InProgressActivityPanel: React.FC<InProgressActivityPanelProps> = ({
  repositories,
  events,
  actions,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [statusMap, setStatusMap] = useState<Map<string, GitStatusWithFiles>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [dismissedPaths, setDismissedPaths] = useState<Set<string>>(new Set());

  const entryByPath = useMemo(() => {
    const map = new Map<string, AlexandriaEntry>();
    for (const repo of repositories) {
      if (repo.path) map.set(String(repo.path), repo);
    }
    return map;
  }, [repositories]);

  // Owner → is-org lookup, so the card's avatar opens the right profile
  // (OrgProfilePanel vs UserProfilePanel). GitHub's user endpoint reports
  // `type: 'Organization'` for orgs. Mirrors ActivityFeedCardPanel.
  const githubOwners = useMemo(() => {
    const owners = new Set<string>();
    for (const repo of repositories) {
      if (repo.github?.owner) owners.add(repo.github.owner);
    }
    return Array.from(owners);
  }, [repositories]);

  const [ownerIsOrgMap, setOwnerIsOrgMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (githubOwners.length === 0) return;
    let cancelled = false;

    const fetchOwnerTypes = async () => {
      const next = new Map<string, boolean>();
      await Promise.all(
        githubOwners.map(async (owner) => {
          try {
            const user = await GithubService.getUser(owner);
            next.set(owner, user?.type === 'Organization');
          } catch (error) {
            console.warn(
              `[InProgressActivityPanel] Failed to resolve owner type for ${owner}:`,
              error,
            );
            next.set(owner, false);
          }
        }),
      );
      if (!cancelled) setOwnerIsOrgMap(next);
    };

    void fetchOwnerTypes();
    return () => {
      cancelled = true;
    };
  }, [githubOwners]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const entries = await Promise.all(
        repositories
          .filter((r) => r.path)
          .map(async (r) => {
            const status = await RepositoryMonitoringService.getGitStatusWithFiles(String(r.path));
            return { path: String(r.path), status };
          }),
      );
      if (cancelled) return;
      const next = new Map<string, GitStatusWithFiles>();
      for (const { path, status } of entries) {
        if (status) next.set(path, status);
      }
      setStatusMap(next);
      setLoaded(true);
    };

    load().catch((err) => {
      console.error('[InProgressActivityPanel] Failed to load git statuses:', err);
      if (!cancelled) setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [repositories]);

  useEffect(() => {
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged((status) => {
      const repoPath = String(status.repoPath);
      if (!entryByPath.has(repoPath)) return;
      setStatusMap((prev) => {
        const next = new Map(prev);
        next.set(repoPath, status);
        return next;
      });
      setDismissedPaths((prev) => {
        if (!prev.has(repoPath)) return prev;
        const next = new Set(prev);
        next.delete(repoPath);
        return next;
      });
    });
    return () => {
      unsubscribe();
    };
  }, [entryByPath]);

  const dirtyRows = useMemo<DirtyRow[]>(() => {
    const rows: DirtyRow[] = [];
    for (const [path, status] of statusMap.entries()) {
      if (!status.isDirty && status.ahead === 0) continue;
      if (dismissedPaths.has(path)) continue;
      const entry = entryByPath.get(path);
      if (!entry) continue;
      const owner = entry.github?.owner;
      rows.push({
        entry,
        status,
        summary: statusToSummary(
          entry,
          status,
          owner ? ownerIsOrgMap.get(owner) : undefined,
        ),
      });
    }
    rows.sort((a, b) => a.summary.repoName.localeCompare(b.summary.repoName));
    return rows;
  }, [statusMap, entryByPath, dismissedPaths, ownerIsOrgMap]);

  const handleDismiss = useCallback((repoPath: string) => {
    setDismissedPaths((prev) => {
      if (prev.has(repoPath)) return prev;
      const next = new Set(prev);
      next.add(repoPath);
      return next;
    });
    RepositoryMonitoringService.refreshRepository(repoPath).catch((err) => {
      console.warn('[InProgressActivityPanel] Failed to refresh after push:', err);
    });
  }, []);

  // A successful push clears the ahead count immediately (optimistic) and asks
  // the monitor to re-check so the map/branch state stays in sync.
  const handlePushed = useCallback((repoPath: string) => {
    setStatusMap((prev) => {
      const current = prev.get(repoPath);
      if (!current || current.ahead === 0) return prev;
      const next = new Map(prev);
      next.set(repoPath, { ...current, ahead: 0 });
      return next;
    });
    RepositoryMonitoringService.refreshRepository(repoPath).catch((err) => {
      console.warn('[InProgressActivityPanel] Failed to refresh after push:', err);
    });
  }, []);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ flex: 1, overflow: 'auto', padding: spacing.md }}>
        {loaded && dirtyRows.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              textAlign: 'center',
              gap: spacing.sm,
            }}
          >
            <FolderCheck size={48} style={{ opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: theme.fontSizes[2] }}>Nothing in progress</p>
            <span style={{ fontSize: theme.fontSizes[1] }}>
              All tracked repositories have a clean working tree.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: spacing.md,
            }}
          >
            {dirtyRows.map(({ entry, summary }) => (
              <InProgressRepoCard
                key={summary.repoPath}
                summary={summary}
                onDismiss={handleDismiss}
                onPushed={handlePushed}
                events={events}
                entry={entry}
                actions={actions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InProgressActivityPanel;
