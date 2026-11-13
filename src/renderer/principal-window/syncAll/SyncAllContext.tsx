import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  extractPurlFromRemoteUrl,
  parsePurl,
} from '@principal-ai/alexandria-core-library';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import {
  DEFAULT_AUTO_SYNC_SETTINGS,
  normalizeAutoSyncSettings,
  type AutoSyncSettings,
} from './autoSyncPrefs';
import {
  syncSingleRepository,
  type SyncSingleResult,
} from './syncSingleRepository';

/** Minimum on-screen time per repo so the titlebar pill doesn't flash by. */
export const SYNC_ALL_MIN_VISIBLE_MS = 3000;
/** How long the completion summary stays in the titlebar after a run. */
const SYNC_ALL_DONE_VISIBLE_MS = 6000;

export interface SyncAllCurrent {
  path: string;
  name: string;
  owner?: string;
  avatarUrl?: string;
  index: number;
  total: number;
}

export interface SyncAllSummary {
  total: number;
  fastForwarded: number;
  upToDate: number;
  skipped: number;
  failed: number;
}

interface SyncAllContextValue {
  isSyncing: boolean;
  current: SyncAllCurrent | null;
  summary: SyncAllSummary | null;
  results: SyncSingleResult[];
  start: (entries: AlexandriaEntry[]) => Promise<void>;
  /** The persisted auto-sync cadence (drives the interval timer below). */
  autoSync: AutoSyncSettings;
}

const SyncAllContext = createContext<SyncAllContextValue | null>(null);

function entryOwner(entry: AlexandriaEntry): string | undefined {
  if (entry.github?.owner) return entry.github.owner;
  const purl =
    entry.purl ??
    entry.github?.purl ??
    (entry.remoteUrl ? extractPurlFromRemoteUrl(entry.remoteUrl) : null);
  const parsed = purl ? parsePurl(purl) : null;
  return parsed?.type === 'github' ? parsed.namespace : undefined;
}

function entryName(entry: AlexandriaEntry): string {
  return entry.github?.name ?? entry.name;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const SyncAllProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [current, setCurrent] = useState<SyncAllCurrent | null>(null);
  const [summary, setSummary] = useState<SyncAllSummary | null>(null);
  const [results, setResults] = useState<SyncSingleResult[]>([]);
  const [autoSync, setAutoSync] = useState<AutoSyncSettings>(
    DEFAULT_AUTO_SYNC_SETTINGS,
  );
  const runningRef = useRef(false);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async (entries: AlexandriaEntry[]) => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
    setIsSyncing(true);
    setSummary(null);
    setResults([]);

    // Only registered clones with a local checkout, de-duplicated and sorted
    // so the titlebar walks them in a stable order.
    const seen = new Set<string>();
    const paths: AlexandriaEntry[] = [];
    for (const entry of entries) {
      if (!entry.path) continue;
      const path = String(entry.path);
      if (seen.has(path)) continue;
      seen.add(path);
      paths.push(entry);
    }
    paths.sort((a, b) => entryName(a).localeCompare(entryName(b)));

    const collected: SyncSingleResult[] = [];
    for (let i = 0; i < paths.length; i += 1) {
      const entry = paths[i];
      const path = String(entry.path);
      const owner = entryOwner(entry);
      setCurrent({
        path,
        name: entryName(entry),
        owner,
        avatarUrl: owner
          ? `https://github.com/${owner}.png?size=64`
          : undefined,
        index: i + 1,
        total: paths.length,
      });

      const startedAt = Date.now();
      let result: SyncSingleResult;
      try {
        result = await syncSingleRepository(path);
      } catch (error) {
        result = {
          path,
          status: 'fetch-failed',
          error: error instanceof Error ? error.message : String(error),
        };
      }
      collected.push(result);
      setResults([...collected]);

      if (result.status === 'fast-forwarded') {
        try {
          await RepositoryMonitoringService.refreshRepository(path);
        } catch {
          // Best-effort: the monitor's next poll picks the new HEAD up.
        }
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed < SYNC_ALL_MIN_VISIBLE_MS) {
        await delay(SYNC_ALL_MIN_VISIBLE_MS - elapsed);
      }
    }

    const fastForwarded = collected.filter(
      (r) => r.status === 'fast-forwarded',
    ).length;
    const upToDate = collected.filter((r) => r.status === 'up-to-date').length;
    const failed = collected.filter((r) =>
      ['fetch-failed', 'fast-forward-failed'].includes(r.status),
    ).length;
    setSummary({
      total: collected.length,
      fastForwarded,
      upToDate,
      skipped: collected.length - fastForwarded - upToDate - failed,
      failed,
    });
    setCurrent(null);
    setIsSyncing(false);
    runningRef.current = false;

    doneTimerRef.current = setTimeout(() => {
      setSummary(null);
      setResults([]);
      doneTimerRef.current = null;
    }, SYNC_ALL_DONE_VISIBLE_MS);
  }, []);

  const value = useMemo<SyncAllContextValue>(
    () => ({ isSyncing, current, summary, results, start, autoSync }),
    [isSyncing, current, summary, results, start, autoSync],
  );

  // The auto-sync cadence is a persisted General setting; keep it live so
  // changes from Settings (or another window) retime the scheduler below.
  useEffect(() => {
    let cancelled = false;
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        if (!cancelled) setAutoSync(normalizeAutoSyncSettings(prefs));
      })
      .catch(() => {
        // Keep the default (off) when preferences are unreadable.
      });
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      if (!cancelled) setAutoSync(normalizeAutoSyncSettings(prefs));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <SyncAllContext.Provider value={value}>
      {children}
      <AutoSyncScheduler />
    </SyncAllContext.Provider>
  );
};

/**
 * Interval timer for the persisted auto-sync setting. Mounted inside the
 * provider so it shares the run lifecycle: each tick loads the registered
 * clones fresh and runs the same safe sequential sync as the manual button.
 * Skips ticks while a run (manual or scheduled) is already in progress.
 */
const AutoSyncScheduler: React.FC = () => {
  const { start, autoSync, isSyncing } = useSyncAll();
  const stateRef = useRef({ start, isSyncing });
  stateRef.current = { start, isSyncing };

  useEffect(() => {
    if (!autoSync.enabled) return;
    const intervalMs = autoSync.intervalMinutes * 60_000;
    const timer = setInterval(() => {
      // A manual run (or an earlier tick still working) owns the run
      // lifecycle — the provider's start() guard is the final backstop.
      if (stateRef.current.isSyncing) return;
      void AlexandriaService.getRepositories()
        .then((entries) => stateRef.current.start(entries))
        .catch((error: unknown) => {
          console.warn('[SyncAll] Scheduled auto-sync failed:', error);
        });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoSync.enabled, autoSync.intervalMinutes]);

  return null;
};

export function useSyncAll(): SyncAllContextValue {
  const context = useContext(SyncAllContext);
  if (!context) {
    throw new Error('useSyncAll must be used within SyncAllProvider');
  }
  return context;
}

export function useSyncAllOptional(): SyncAllContextValue | null {
  return useContext(SyncAllContext);
}
