import { useCallback, useEffect, useState } from 'react';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import { findAvailablePort, waitForPortReady } from '../utils/portDetection';
import {
  StorybookService,
  type StorybookPackage,
} from '../services/StorybookService';
import { TerminalService } from '../main-process-api/TerminalService';

export type StorybookStatus = 'idle' | 'starting' | 'running' | 'error';

export interface StorybookLayout {
  left: string;
  middle: string;
  right: string;
}

export interface PanelSizes {
  left: number;
  middle: number;
  right: number;
}

export interface StorybookManagerOptions {
  packages?: PackageLayer[];
  repositoryPath?: string;
  repositoryOwner?: string;
  repositoryName?: string;
  currentLayout?: StorybookLayout;
  onLayoutChange?: (layout: StorybookLayout) => void;
  onPanelSizesChange?: (sizes: PanelSizes) => void;
  events?: {
    emit: (event: {
      type: string;
      source: string;
      payload: unknown;
      timestamp: number;
    }) => void;
  };
}

export interface StorybookManager {
  status: StorybookStatus;
  port: number | null;
  packages: StorybookPackage[];
  selectedPackage: StorybookPackage | null;
  setSelectedPackage: (pkg: StorybookPackage | null) => void;
  isRunning: boolean;
  isStarting: boolean;
  /** True when the right panel is currently displaying the running Storybook */
  isStorybookVisible: boolean;
  /** Start Storybook for the given package (or the currently selected one). */
  start: (pkg?: StorybookPackage) => Promise<void>;
  /** Stop the running Storybook session and restore the default panel layout. */
  stop: () => Promise<void>;
  /** Bring the Storybook view into the right panel (running only). */
  showPanel: () => void;
  /** Restore the default right-panel layout, hiding Storybook from view. */
  hidePanel: () => void;
}

const DEFAULT_LAYOUT_SIZES: PanelSizes = { left: 25, middle: 50, right: 25 };
const STORYBOOK_LAYOUT_SIZES: PanelSizes = { left: 0, middle: 50, right: 50 };

export function useStorybookManager(
  options: StorybookManagerOptions,
): StorybookManager {
  const {
    packages,
    repositoryPath,
    repositoryOwner,
    repositoryName,
    currentLayout,
    onLayoutChange,
    onPanelSizesChange,
    events,
  } = options;

  const [status, setStatus] = useState<StorybookStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [port, setPort] = useState<number | null>(null);
  const [storybookPackages, setStorybookPackages] = useState<
    StorybookPackage[]
  >([]);
  const [selectedPackage, setSelectedPackage] =
    useState<StorybookPackage | null>(null);

  const storybookContext =
    repositoryOwner && repositoryName
      ? `terminal:${repositoryOwner}/${repositoryName}:storybook`
      : null;

  // Re-attach to an existing session when the context changes
  useEffect(() => {
    if (!storybookContext) return;
    let cancelled = false;

    (async () => {
      try {
        const sessions = await TerminalService.list();
        const existing = sessions.find(
          (s) => s.context === storybookContext && s.status === 'active',
        );
        if (existing && !cancelled) {
          setSessionId(existing.id);
          setStatus('running');
          if (existing.metadata?.port) {
            setPort(existing.metadata.port as number);
          }
        }
      } catch (error) {
        console.error(
          '[useStorybookManager] Error checking existing session:',
          error,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storybookContext]);

  // Reset state when the terminal session ends externally
  useEffect(() => {
    if (!sessionId) return;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      unsubscribe = await TerminalService.onExit((exitEvent) => {
        if (exitEvent.sessionId === sessionId) {
          setStatus('idle');
          setSessionId(null);
          setPort(null);
        }
      });
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionId]);

  // Detect storybook packages for the current repo
  useEffect(() => {
    if (repositoryPath && packages) {
      const found = StorybookService.findStorybookPackages(
        packages,
        repositoryPath,
      );
      setStorybookPackages(found);
      setSelectedPackage((prev) => {
        if (prev && found.some((p) => p.path === prev.path)) return prev;
        return found[0] ?? null;
      });
    } else {
      setStorybookPackages([]);
      setSelectedPackage(null);
    }
  }, [repositoryPath, packages]);

  const stop = useCallback(async () => {
    if (status !== 'running' || !sessionId) return;
    try {
      await window.mainProcess.terminal.destroy(sessionId);
      setStatus('idle');
      setSessionId(null);
      setPort(null);
      onPanelSizesChange?.(DEFAULT_LAYOUT_SIZES);
      if (currentLayout && onLayoutChange) {
        onLayoutChange({ ...currentLayout, right: 'fileCity' });
      }
    } catch (error) {
      console.error('[useStorybookManager] Failed to stop:', error);
    }
  }, [status, sessionId, currentLayout, onLayoutChange, onPanelSizesChange]);

  const start = useCallback(
    async (pkg?: StorybookPackage) => {
      const target = pkg ?? selectedPackage;
      if (!target) {
        console.error('[useStorybookManager] No Storybook package selected');
        return;
      }
      if (status === 'running' || status === 'starting') return;

      try {
        setStatus('starting');
        setSelectedPackage(target);

        const newPort = await findAvailablePort(6006, 6020);
        setPort(newPort);

        const command = StorybookService.getStorybookCommand(target, newPort);
        const terminalContext = `terminal:${repositoryOwner}/${repositoryName}:storybook`;

        const newSessionId = await TerminalService.createWithCommand(
          target.path,
          command,
          terminalContext,
          {
            port: newPort,
            packageName: target.name,
            serverType: 'storybook',
          },
        );
        setSessionId(newSessionId || null);

        window.dispatchEvent(
          new CustomEvent('terminal-session-created', {
            detail: { sessionId: newSessionId, context: terminalContext },
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 500));

        onPanelSizesChange?.(STORYBOOK_LAYOUT_SIZES);
        if (currentLayout && onLayoutChange) {
          onLayoutChange({ ...currentLayout, right: 'localhostBrowser' });
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
        await waitForPortReady(newPort, 30000, 1000);

        if (events) {
          const navigatePayload = {
            type: 'principal-ade.localhost-browser:navigate' as const,
            source: 'storybook-manager',
            payload: { port: newPort, path: '/' },
            timestamp: Date.now(),
          };
          events.emit(navigatePayload);
          setTimeout(() => {
            events.emit({ ...navigatePayload, timestamp: Date.now() });
          }, 100);
        }

        setStatus('running');
      } catch (error) {
        console.error('[useStorybookManager] Failed to start:', error);
        setStatus('error');
      }
    },
    [
      selectedPackage,
      status,
      repositoryOwner,
      repositoryName,
      currentLayout,
      onLayoutChange,
      onPanelSizesChange,
      events,
    ],
  );

  const showPanel = useCallback(() => {
    if (status !== 'running') return;
    if (currentLayout && onLayoutChange) {
      onLayoutChange({ ...currentLayout, right: 'localhostBrowser' });
    }
    onPanelSizesChange?.(STORYBOOK_LAYOUT_SIZES);
    if (!events || !port) return;

    // The browser panel was just mounted by the layout change above and isn't
    // listening yet. Wait for it to mount, then emit — and emit again as a
    // safety net in case the first event still lost the race.
    const navigatePayload = {
      type: 'principal-ade.localhost-browser:navigate' as const,
      source: 'storybook-manager',
      payload: { port, path: '/' },
      timestamp: Date.now(),
    };
    setTimeout(() => {
      events.emit({ ...navigatePayload, timestamp: Date.now() });
      setTimeout(() => {
        events.emit({ ...navigatePayload, timestamp: Date.now() });
      }, 150);
    }, 300);
  }, [
    status,
    currentLayout,
    onLayoutChange,
    onPanelSizesChange,
    events,
    port,
  ]);

  const hidePanel = useCallback(() => {
    if (currentLayout && onLayoutChange) {
      onLayoutChange({ ...currentLayout, right: 'fileCity' });
    }
    onPanelSizesChange?.(DEFAULT_LAYOUT_SIZES);
  }, [currentLayout, onLayoutChange, onPanelSizesChange]);

  const isRunning = status === 'running';
  const isStarting = status === 'starting';
  const isStorybookVisible =
    isRunning && currentLayout?.right === 'localhostBrowser';

  return {
    status,
    port,
    packages: storybookPackages,
    selectedPackage,
    setSelectedPackage,
    isRunning,
    isStarting,
    isStorybookVisible,
    start,
    stop,
    showPanel,
    hidePanel,
  };
}
