/**
 * InProgressActivityPanel
 *
 * Feed-view panel that lists repositories with uncommitted working-tree
 * changes. Sibling of ActivityFeedCardPanel — same shape, but each row is an
 * InProgressRepoCard rather than a RepoActivityCard driven by commits.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderCheck } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import {
  InProgressRepoCard,
  type InProgressRepoCardActions,
  type InProgressSummary,
} from './InProgressRepoCard';

export interface InProgressActivityPanelProps {
  repositories: AlexandriaEntry[];
  events: PanelEventEmitter;
  onOpenRepository?: (entry: AlexandriaEntry) => void;
  actions: InProgressRepoCardActions;
}

interface DirtyRow {
  entry: AlexandriaEntry;
  status: GitStatusWithFiles;
  summary: InProgressSummary;
}

function statusToSummary(entry: AlexandriaEntry, status: GitStatusWithFiles): InProgressSummary {
  return {
    repoPath: String(entry.path),
    repoName: entry.name,
    branch: status.branch,
    aheadCount: status.ahead,
    behindCount: status.behind,
    githubOwner: entry.github?.owner,
    githubRepoName: entry.github?.name ?? entry.name,
    isOwnerOrg: undefined,
    lastEditAt: status.lastChangedAt ? new Date(status.lastChangedAt) : undefined,
  };
}

export const InProgressActivityPanel: React.FC<InProgressActivityPanelProps> = ({
  repositories,
  events,
  onOpenRepository,
  actions,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [statusMap, setStatusMap] = useState<Map<string, GitStatusWithFiles>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const entryByPath = useMemo(() => {
    const map = new Map<string, AlexandriaEntry>();
    for (const repo of repositories) {
      if (repo.path) map.set(String(repo.path), repo);
    }
    return map;
  }, [repositories]);

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
    });
    return () => {
      unsubscribe();
    };
  }, [entryByPath]);

  const dirtyRows = useMemo<DirtyRow[]>(() => {
    const rows: DirtyRow[] = [];
    for (const [path, status] of statusMap.entries()) {
      if (!status.isDirty && status.ahead === 0) continue;
      const entry = entryByPath.get(path);
      if (!entry) continue;
      rows.push({ entry, status, summary: statusToSummary(entry, status) });
    }
    rows.sort((a, b) => {
      const aTime = a.status.lastChangedAt ? new Date(a.status.lastChangedAt).getTime() : 0;
      const bTime = b.status.lastChangedAt ? new Date(b.status.lastChangedAt).getTime() : 0;
      return bTime - aTime;
    });
    return rows;
  }, [statusMap, entryByPath]);

  const toggleExpand = useCallback((repoPath: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(repoPath)) next.delete(repoPath);
      else next.add(repoPath);
      return next;
    });
  }, []);

  const handleOpenRepo = useCallback(
    (repoPath: string) => {
      const entry = entryByPath.get(repoPath);
      if (entry && onOpenRepository) {
        onOpenRepository(entry);
      }
    },
    [entryByPath, onOpenRepository],
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {dirtyRows.map(({ entry, summary }) => (
              <InProgressRepoCard
                key={summary.repoPath}
                summary={summary}
                isExpanded={expandedCards.has(summary.repoPath)}
                onToggleExpand={() => toggleExpand(summary.repoPath)}
                onOpen={() => handleOpenRepo(summary.repoPath)}
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
