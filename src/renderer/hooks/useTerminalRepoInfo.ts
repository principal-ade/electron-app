/**
 * Resolves a terminal's working directory to repository context
 * (`TerminalRepoInfo`) for the terminal panel's bottom status bar.
 *
 * The panel calls the returned `getRepoInfo(directory)` synchronously while it
 * renders, but every data source here (the Alexandria registry, git status) is
 * async/subscription-based. So this hook keeps an in-memory cache in refs,
 * populated from the live subscriptions, and does a synchronous nearest-ancestor
 * lookup on query. A version counter bumps on every cache change so the callback
 * identity changes and the panel (which memoizes on `getRepoInfo`) re-renders.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerminalRepoInfo } from '@industry-theme/xterm-terminal-panel';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

interface RepoGitStatus {
  branch?: string;
  isDirty?: boolean;
  ahead?: number;
  behind?: number;
}

/** True when `dir` is `repoPath` itself or a descendant of it. */
function isWithin(dir: string, repoPath: string): boolean {
  if (dir === repoPath) return true;
  const base = repoPath.endsWith('/') ? repoPath : `${repoPath}/`;
  return dir.startsWith(base);
}

export function useTerminalRepoInfo(): (
  directory: string,
) => TerminalRepoInfo | undefined {
  const entriesRef = useRef<AlexandriaEntry[]>([]);
  const gitStatusRef = useRef<Map<string, RepoGitStatus>>(new Map());
  const requestedRef = useRef<Set<string>>(new Set());
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Load the registry once, then keep it fresh on any repository change.
  useEffect(() => {
    let active = true;
    const load = () => {
      AlexandriaService.getRepositories()
        .then((list) => {
          if (!active) return;
          entriesRef.current = list;
          bump();
        })
        .catch(() => {});
    };
    load();
    const off = AlexandriaService.onRepositoryChange(load);
    return () => {
      active = false;
      off?.();
    };
  }, [bump]);

  // Track git status pushes for any watched repo.
  useEffect(() => {
    const off = RepositoryMonitoringService.onGitStatusChanged((status) => {
      gitStatusRef.current.set(status.repoPath, {
        branch: status.branch,
        isDirty: status.isDirty,
        ahead: status.ahead,
        behind: status.behind,
      });
      bump();
    });
    return () => {
      off?.();
    };
  }, [bump]);

  return useCallback(
    (directory: string): TerminalRepoInfo | undefined => {
      if (!directory) return undefined;

      // Nearest-ancestor match: the registered entry with the longest path
      // that contains `directory` (the terminal may be in a subdirectory).
      let best: AlexandriaEntry | undefined;
      let bestLen = -1;
      for (const entry of entriesRef.current) {
        const repoPath = String(entry.path);
        if (isWithin(directory, repoPath) && repoPath.length > bestLen) {
          best = entry;
          bestLen = repoPath.length;
        }
      }
      if (!best) return undefined;

      const owner = best.github?.owner;
      const repo = best.github?.name ?? best.name;
      if (!owner || !repo) return undefined;

      const repoPath = String(best.path);

      // Lazily fetch an initial git-status snapshot the first time this repo is
      // seen; live updates thereafter arrive via onGitStatusChanged. Guarded by
      // requestedRef so the render-phase call fires the fetch at most once.
      if (
        !gitStatusRef.current.has(repoPath) &&
        !requestedRef.current.has(repoPath)
      ) {
        requestedRef.current.add(repoPath);
        RepositoryMonitoringService.getGitStatus(repoPath)
          .then((status) => {
            if (!status) return;
            gitStatusRef.current.set(repoPath, {
              branch: status.branch,
              isDirty: status.isDirty,
              ahead: status.ahead,
              behind: status.behind,
            });
            bump();
          })
          .catch(() => {});
      }

      const gitStatus = gitStatusRef.current.get(repoPath);
      return {
        owner,
        repo,
        avatarUrl: `https://github.com/${owner}.png?size=40`,
        branch: gitStatus?.branch,
        isDirty: gitStatus?.isDirty,
        ahead: gitStatus?.ahead,
        behind: gitStatus?.behind,
      };
    },
    [bump],
  );
}
