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
import { emitTerminalOpen } from '../events/portalIntents';
import {
  InProgressRepoCard,
  type ExplainInProgressRequest,
  type InProgressRepoCardActions,
  type InProgressSummary,
} from './InProgressRepoCard';
import { RepoExplainOverlay, type ExplainAudience } from './RepoExplainOverlay';

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

function statusToSummary(entry: AlexandriaEntry, status: GitStatusWithFiles): InProgressSummary {
  return {
    repoPath: String(entry.path),
    repoName: entry.name,
    branch: status.branch,
    isDirty: status.isDirty,
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
  actions,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16, lg: 24 };

  const [statusMap, setStatusMap] = useState<Map<string, GitStatusWithFiles>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [dismissedPaths, setDismissedPaths] = useState<Set<string>>(new Set());

  interface ExplainState {
    isOpen: boolean;
    repoPath: string | null;
    repoName: string | null;
    branch?: string;
    files: ExplainInProgressRequest['files'] | null;
    audience: ExplainAudience;
    markdown: string | null;
    loading: boolean;
    runId: number;
  }

  const [explain, setExplain] = useState<ExplainState>({
    isOpen: false,
    repoPath: null,
    repoName: null,
    branch: undefined,
    files: null,
    audience: 'maintainer',
    markdown: null,
    loading: false,
    runId: 0,
  });

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
      // A fresh status arrived — drop any dismissal so the natural filter
      // decides visibility (post-push the repo will simply not match anymore;
      // if the user commits again later, the card returns).
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
      rows.push({ entry, status, summary: statusToSummary(entry, status) });
    }
    rows.sort((a, b) => {
      const aTime = a.status.lastChangedAt ? new Date(a.status.lastChangedAt).getTime() : 0;
      const bTime = b.status.lastChangedAt ? new Date(b.status.lastChangedAt).getTime() : 0;
      return bTime - aTime;
    });
    return rows;
  }, [statusMap, entryByPath, dismissedPaths]);

  // Double-clicking a card opens a terminal tab rooted at the repo in the
  // principal window (not a separate dev-workspace window). WorkspaceShell
  // listens for this intent and materializes the terminal tab.
  const handleOpenRepo = useCallback(
    (repoPath: string) => {
      const entry = entryByPath.get(repoPath);
      emitTerminalOpen(events, 'in-progress-activity-panel', {
        directory: repoPath,
        label: entry?.name,
      });
    },
    [entryByPath, events],
  );

  const handleExplainRequested = useCallback((request: ExplainInProgressRequest) => {
    setExplain((prev) => ({
      ...prev,
      isOpen: true,
      repoPath: request.repoPath,
      repoName: request.repoName,
      branch: request.branch,
      files: request.files,
      markdown: null,
      loading: true,
      runId: prev.runId + 1,
    }));
  }, []);

  const handleExplainAudienceChange = useCallback((audience: ExplainAudience) => {
    setExplain((prev) => {
      if (prev.audience === audience) return prev;
      // Re-run explanation for the new audience using the same files.
      return {
        ...prev,
        audience,
        markdown: null,
        loading: prev.files != null,
        runId: prev.runId + 1,
      };
    });
  }, []);

  const handleExplainClose = useCallback(() => {
    setExplain((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Run explanation whenever runId advances and we have inputs.
  useEffect(() => {
    if (!explain.loading) return;
    if (!explain.files || !explain.repoName || !explain.repoPath) return;
    let cancelled = false;
    const currentRun = explain.runId;
    actions
      .explainWorkingChanges({
        repoPath: explain.repoPath,
        repoName: explain.repoName,
        branch: explain.branch,
        files: explain.files,
        audienceLevel: explain.audience,
      })
      .then((result) => {
        if (cancelled) return;
        setExplain((prev) =>
          prev.runId !== currentRun
            ? prev
            : { ...prev, loading: false, markdown: result.text },
        );
      })
      .catch((err: unknown) => {
        console.error('[InProgressActivityPanel] explain failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to generate explanation';
        if (cancelled) return;
        setExplain((prev) =>
          prev.runId !== currentRun
            ? prev
            : {
                ...prev,
                loading: false,
                markdown: `Couldn’t summarize changes: ${message}`,
              },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    explain.loading,
    explain.runId,
    explain.repoPath,
    explain.repoName,
    explain.branch,
    explain.files,
    explain.audience,
    actions,
  ]);

  const handleDismiss = useCallback((repoPath: string) => {
    setDismissedPaths((prev) => {
      if (prev.has(repoPath)) return prev;
      const next = new Set(prev);
      next.add(repoPath);
      return next;
    });
    // The push happened a moment ago; the monitoring layer doesn't always
    // notice on its own, so kick a refresh now that the card has fully
    // animated out. The resulting onGitStatusChanged event will clear the
    // dismissal entry; the natural ahead===0 filter keeps it hidden.
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {dirtyRows.map(({ entry, summary }) => (
              <InProgressRepoCard
                key={summary.repoPath}
                summary={summary}
                onOpen={() => handleOpenRepo(summary.repoPath)}
                onDismiss={handleDismiss}
                onExplainRequested={handleExplainRequested}
                explainLoading={
                  explain.isOpen &&
                  explain.loading &&
                  explain.repoPath === summary.repoPath
                }
                events={events}
                entry={entry}
                actions={actions}
              />
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
    </div>
  );
};

export default InProgressActivityPanel;
