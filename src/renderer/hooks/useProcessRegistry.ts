/**
 * useProcessRegistry
 *
 * Merges two sources into one process list for the panel:
 * - `managed` processes from the main-process registry (started by the app or
 *   an agent via the bridge), live-synced over `processes:changed`; and
 * - `detected` local servers (found on dev ports by localhost detection) that
 *   we did NOT start — shown read-only (killable, not restartable). Their cwd
 *   is resolved to a registered repo too, so an external server is still
 *   attributed to its project.
 *
 * A detected server is dropped when it's the same as a running managed process
 * — matched by pid (direct child) or by port (the managed process reports the
 * port it bound, learned from its own output).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ProcessEntry,
  ProcessRepo,
} from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import type { RunningServer } from '../../shared/main-process-api-interfaces/LocalhostDetectionAPI';
import { ProcessRegistryService } from '../main-process-api/ProcessRegistryService';
import { LocalhostDetectionService } from '../main-process-api/LocalhostDetectionService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';

const DETECT_INTERVAL_MS = 5000;

const ACTIVE_STATUSES: ProcessEntry['status'][] = [
  'starting',
  'running',
  'restarting',
  'stopping',
];

/** Minimal repo shape used for cwd → repo attribution. */
interface RepoLite {
  path: string;
  name: string;
  owner?: string;
  purl?: string;
}

/** Longest-prefix match of `cwd` against known repo roots. */
function resolveRepoForCwd(
  cwd: string,
  repos: RepoLite[],
): ProcessRepo | undefined {
  if (!cwd) return undefined;
  let best: RepoLite | undefined;
  for (const repo of repos) {
    if (cwd === repo.path || cwd.startsWith(repo.path + '/')) {
      if (!best || repo.path.length > best.path.length) best = repo;
    }
  }
  if (!best) return undefined;
  return {
    name: best.name,
    owner: best.owner,
    // Deterministic GitHub avatar URL — no API call / auth needed.
    avatarUrl: best.owner ? `https://github.com/${best.owner}.png` : undefined,
    purl: best.purl,
  };
}

function detectedEntries(
  servers: RunningServer[],
  managed: ProcessEntry[],
  repos: RepoLite[],
): ProcessEntry[] {
  const active = managed.filter((m) => ACTIVE_STATUSES.includes(m.status));
  const managedPids = new Set(
    active
      .map((m) => m.pid)
      .filter((pid): pid is number => typeof pid === 'number'),
  );
  const managedPorts = new Set(
    active
      .map((m) => m.port)
      .filter((port): port is number => typeof port === 'number'),
  );

  return servers
    .filter((s) => {
      if (s.pid != null && managedPids.has(s.pid)) return false;
      if (s.port != null && managedPorts.has(s.port)) return false;
      return true;
    })
    .map((s) => ({
      id: `detected:${s.pid ?? s.port}`,
      label: s.command?.trim()
        ? `${s.command.trim()} :${s.port}`
        : `localhost:${s.port}`,
      command: s.command || '',
      cwd: s.cwd || '',
      repo: s.cwd ? resolveRepoForCwd(s.cwd, repos) : undefined,
      kind: 'dev-server' as const,
      status: 'running' as const,
      origin: 'detected' as const,
      pid: s.pid,
      port: s.port,
      source: 'external',
      startedAt: Date.now(),
    }));
}

export interface UseProcessRegistryOptions {
  /** Poll localhost detection for externally-running servers (default true). */
  detect?: boolean;
}

export interface UseProcessRegistryResult {
  entries: ProcessEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useProcessRegistry(
  options: UseProcessRegistryOptions = {},
): UseProcessRegistryResult {
  const { detect = true } = options;

  const [managed, setManaged] = useState<ProcessEntry[]>([]);
  const [servers, setServers] = useState<RunningServer[]>([]);
  const [repos, setRepos] = useState<RepoLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await ProcessRegistryService.list();
      setManaged(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    if (detect) {
      try {
        const result = await LocalhostDetectionService.detectRunningServers();
        setServers(result.servers);
      } catch {
        /* detection is best-effort */
      }
    }
    setLoading(false);
  }, [detect]);

  // Registered repos — used to attribute a process (managed or detected) by cwd.
  useEffect(() => {
    let cancelled = false;
    AlexandriaService.getRepositories()
      .then((entries) => {
        if (cancelled) return;
        setRepos(
          entries.map((entry) => ({
            path: String(entry.path),
            name: entry.name,
            owner: entry.github?.owner,
            purl: entry.purl ?? entry.github?.purl ?? undefined,
          })),
        );
      })
      .catch(() => {
        /* attribution is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Managed processes: initial load + live updates.
  useEffect(() => {
    let cancelled = false;
    ProcessRegistryService.list()
      .then((list) => {
        if (!cancelled) {
          setManaged(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    const unsubscribe = ProcessRegistryService.onChanged((list) => {
      if (!cancelled) setManaged(list);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Detected servers: periodic scan.
  useEffect(() => {
    if (!detect) return;
    let cancelled = false;
    const scan = async () => {
      try {
        const result = await LocalhostDetectionService.detectRunningServers();
        if (!cancelled) setServers(result.servers);
      } catch {
        /* ignore */
      }
    };
    void scan();
    const id = setInterval(scan, DETECT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [detect]);

  const entries = useMemo(() => {
    if (!detect) return managed;
    return [...managed, ...detectedEntries(servers, managed, repos)];
  }, [detect, managed, servers, repos]);

  return { entries, loading, error, refresh };
}
