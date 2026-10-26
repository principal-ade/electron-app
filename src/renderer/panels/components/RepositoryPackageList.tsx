import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { ProcessEntry } from '../../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { ProcessRegistryService } from '../../main-process-api/ProcessRegistryService';
import { useProcessRegistry } from '../../hooks/useProcessRegistry';
import { StorybookService, type StorybookPackage } from '../../services/StorybookService';
import { findAvailablePort } from '../../utils/portDetection';
import { HomeProcessRow } from '../home-panel/HomeProcessRow';

function storybookProcesses(entries: ProcessEntry[], path: string): ProcessEntry[] {
  return entries.filter(
    (entry) =>
      entry.cwd.replace(/\/+$/, '') === path.replace(/\/+$/, '') &&
      /\bstorybook\b/i.test(`${entry.command} ${entry.label}`),
  );
}

function isActiveProcess(entry: ProcessEntry): boolean {
  return !['stopped', 'failed'].includes(entry.status);
}

export const RepositoryPackageList: React.FC<{
  repositoryPath: string;
  onOpenFile: (path: string) => void;
  onPackageHover?: (path: string | null) => void;
  onOpenBrowser?: (port: number, path?: string, label?: string, processId?: string) => void;
}> = ({ repositoryPath, onOpenFile, onPackageHover, onOpenBrowser }) => {
  const { theme } = useTheme();
  const [packages, setPackages] = useState<PackageLayer[] | null>(null);
  const [hoveredPackageId, setHoveredPackageId] = useState<string | null>(null);
  const [focusedPackageId, setFocusedPackageId] = useState<string | null>(null);
  const activePackage = packages?.find((pkg) => pkg.id === (hoveredPackageId ?? focusedPackageId));
  const activePackagePath = activePackage?.packageData.path ?? null;
  useEffect(() => {
    onPackageHover?.(activePackagePath);
    return () => onPackageHover?.(null);
  }, [activePackagePath, onPackageHover]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [startingPath, setStartingPath] = useState<string | null>(null);
  const [pendingStorybook, setPendingStorybook] = useState<ProcessEntry | null>(null);
  const launching = useRef(false);
  const { entries, loading: processesLoading, error: processesError, refresh } = useProcessRegistry();

  useEffect(() => {
    if (!pendingStorybook || !onOpenBrowser) return;
    // Ignore a stale hook snapshot from before the restart. Ports are cleared
    // between runs, so only the requested run may supply the browser's port.
    const current = entries.find((entry) =>
      entry.id === pendingStorybook.id &&
      entry.startedAt === pendingStorybook.startedAt &&
      entry.runCount === pendingStorybook.runCount,
    ) ?? pendingStorybook;
    if (current.status === 'failed' || current.status === 'stopped' || current.status === 'stopping') {
      setPendingStorybook(null);
      return;
    }
    if (current.port == null) return;
    setPendingStorybook(null);
    onOpenBrowser(
      current.port,
      '/',
      current.label,
      current.origin === 'managed' ? current.id : undefined,
    );
  }, [entries, pendingStorybook, onOpenBrowser]);

  useEffect(() => {
    let cancelled = false;
    let request = 0;
    const load = async () => {
      const currentRequest = ++request;
      try {
        const result = await RepositoryMonitoringService.getPackages(repositoryPath);
        if (cancelled || request !== currentRequest) return;
        setPackages(result?.packages ?? null);
        setLoadError(result ? null : 'Package information is unavailable.');
      } catch {
        if (!cancelled && request === currentRequest) {
          setLoadError('Could not load package information.');
        }
      } finally {
        if (!cancelled && request === currentRequest) setLoading(false);
      }
    };
    void load();
    const unsubscribe = RepositoryMonitoringService.onCacheSync((event) => {
      if (event.repoPath === repositoryPath && event.slice === 'packages') void load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [repositoryPath]);

  const storybooks = useMemo(
    () => StorybookService.findStorybookPackages(packages ?? [], repositoryPath),
    [packages, repositoryPath],
  );

  const startStorybook = async (pkg: StorybookPackage) => {
    if (launching.current) return;
    launching.current = true;
    setStartingPath(pkg.path);
    setLaunchError(null);
    try {
      // Recheck managed entries before launching, including saved commands that
      // can be restarted instead of creating another registry entry.
      const managed = await ProcessRegistryService.list();
      const existing = storybookProcesses([
        ...managed,
        ...entries.filter((entry) => entry.origin === 'detected'),
      ], pkg.path);
      const active = existing.find(isActiveProcess);
      if (active) {
        setPendingStorybook(active);
        await refresh();
        return;
      }
      const saved = existing.find((entry) => entry.origin === 'managed');
      let result;
      if (saved) {
        result = await ProcessRegistryService.restart(saved.id);
      } else {
        const port = await findAvailablePort();
        // The shared helper generates only fixed command tokens and a numeric port.
        const [command, ...args] = StorybookService.getStorybookCommand(pkg, port).split(' ');
        result = await ProcessRegistryService.start({
          command,
          args,
          cwd: pkg.path,
          label: `Storybook · ${pkg.name}`,
          kind: 'dev-server',
        });
      }
      if (!result.success) throw new Error(result.error ?? 'Could not start Storybook.');
      if (result.process) setPendingStorybook(result.process);
      await refresh();
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'Could not start Storybook.');
    } finally {
      launching.current = false;
      setStartingPath(null);
    }
  };

  const buttonStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 4,
    background: theme.colors.background,
    color: theme.colors.primary,
    fontFamily: theme.fonts?.body,
    fontSize: theme.fontSizes[1],
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, color: theme.colors.text, fontFamily: theme.fonts?.body, fontSize: theme.fontSizes[1] }}>
      <h5 style={{ margin: '0 0 8px', fontSize: theme.fontSizes[2] }}>
        Packages{packages ? ` (${packages.length})` : ''}
      </h5>
      {loading && <div role="status">Loading packages...</div>}
      {loadError && <div role="alert">{loadError}</div>}
      {!loading && packages?.length === 0 && <div>No packages detected.</div>}
      {packages?.map((pkg) => {
        const data = pkg.packageData;
        const path = data.path ? `${repositoryPath}/${data.path}` : repositoryPath;
        const storybook = storybooks.find((candidate) => candidate.path === path);
        const processes = storybook ? storybookProcesses(entries, path).filter(isActiveProcess) : [];
        return (
          <div
            key={pkg.id}
            onMouseEnter={() => setHoveredPackageId(pkg.id)}
            onMouseLeave={() => setHoveredPackageId(null)}
            onFocus={() => setFocusedPackageId(pkg.id)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setFocusedPackageId(null);
              }
            }}
            style={{
              padding: 8,
              border: `1px solid ${activePackage?.id === pkg.id ? theme.colors.primary : theme.colors.border}`,
              borderRadius: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onOpenFile(data.manifestPath)}
                title={`Open ${data.manifestPath}`}
                style={{ ...buttonStyle, background: 'transparent', border: 'none', padding: 0, fontSize: theme.fontSizes[2], fontWeight: 600, textAlign: 'left', overflowWrap: 'anywhere' }}
              >
                {data.name || data.path || 'Root package'}
              </button>
              {data.version && <span style={{ fontSize: theme.fontSizes[1], color: theme.colors.textSecondary }}>{data.version}</span>}
            </div>
            {data.description && <div style={{ marginTop: 4, fontSize: theme.fontSizes[1] }}>{data.description}</div>}
            {storybook && processes.length === 0 && (
              <button
                type="button"
                style={{ ...buttonStyle, marginTop: 8 }}
                disabled={startingPath !== null || processesLoading || processesError !== null}
                onClick={() => void startStorybook(storybook)}
              >
                {startingPath === path ? 'Starting Storybook...' : 'Start Storybook'}
              </button>
            )}
            {processes.map((entry) => <HomeProcessRow key={entry.id} entry={entry} onProcessKilled={refresh} />)}
          </div>
        );
      })}
      {processesError && <div role="alert">{processesError}</div>}
      {launchError && <div role="alert" style={{ color: theme.colors.error }}>{launchError}</div>}
    </div>
  );
};
