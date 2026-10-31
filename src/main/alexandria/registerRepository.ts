/**
 * registerRepository
 *
 * The one place a local checkout becomes "known" to the app. Every entry point
 * (renderer tipc call, bridge HTTP routes, dev-workspace fallback) goes through
 * here so they all get the same side effects:
 *
 *  1. the Alexandria registry entry is written (idempotent per path),
 *  2. REPOSITORY_ADDED is broadcast so every window's repository list reloads,
 *  3. the repo-monitor daemon is told about the path (no watch yet).
 *
 * Steps 2 and 3 only run for a brand-new entry — re-registering an existing
 * path returns it quietly. They are best-effort: the registry write is the
 * source of truth, and a failed broadcast must not fail the registration.
 */

import { BrowserWindow } from 'electron';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { AlexandriaAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { getTracer } from '../telemetry';

/** Broadcast Alexandria events to all windows. */
export function broadcastAlexandriaEvent(
  eventType:
    | AlexandriaAPIEvent.REPOSITORY_ADDED
    | AlexandriaAPIEvent.REPOSITORY_UPDATED
    | AlexandriaAPIEvent.REPOSITORY_REMOVED,
  data: AlexandriaEntry | { path: string },
): void {
  const windows = BrowserWindow.getAllWindows();
  const activeWindows = windows.filter((w) => !w.isDestroyed());

  // Track broadcast for recently-opened flow
  if (eventType === AlexandriaAPIEvent.REPOSITORY_UPDATED && 'name' in data) {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan(
      'alexandria.event.repository_updated_broadcast',
    );
    span.setAttributes({
      repository_name: data.name,
      window_count: activeWindows.length,
    });
    span.end();
  }

  activeWindows.forEach((window) => {
    window.webContents.send(eventType, data);
  });
}

/**
 * Register a repository with the monitoring daemon. Loaded lazily: the
 * monitoring handlers pull in the whole daemon client, which callers like the
 * bridge routes should not pay for at import time.
 */
export async function registerWithMonitoring(
  repo: AlexandriaEntry,
): Promise<void> {
  if (!repo?.path) {
    return;
  }

  try {
    const { getManager } = require('../repository-monitoring/ipcHandlers');
    const {
      RepositoryRegistrationManager,
    } = require('../repository-monitoring/RepositoryRegistrationManager');
    const registrationManager = RepositoryRegistrationManager.getInstance({
      monitoringManager: getManager(),
    });
    await registrationManager.handleRepositoryAdded(repo);
  } catch (error) {
    console.error(
      '[Alexandria] Failed to register repository with monitoring:',
      error,
    );
  }
}

/** Unregister a repository from the monitoring daemon. */
export async function unregisterFromMonitoring(repoPath: string): Promise<void> {
  try {
    const { getManager } = require('../repository-monitoring/ipcHandlers');
    const {
      RepositoryRegistrationManager,
    } = require('../repository-monitoring/RepositoryRegistrationManager');
    const registrationManager = RepositoryRegistrationManager.getInstance({
      monitoringManager: getManager(),
    });
    await registrationManager.handleRepositoryRemoved(repoPath);
  } catch (error) {
    console.error(
      '[Alexandria] Failed to unregister repository from monitoring:',
      error,
    );
  }
}

/** The slice of the registry service registration needs. */
export type RegisterRepositoryRegistry = Pick<
  AlexandriaRegistryService,
  'getRepositoryByPath' | 'registerRepository'
>;

export interface RegisterRepositoryResult {
  entry: AlexandriaEntry;
  /** False when the path was already registered and nothing changed. */
  created: boolean;
}

/** Injectables for tests; production callers pass only what they override. */
export interface RegisterRepositoryDependencies {
  registry?: RegisterRepositoryRegistry;
  broadcastAdded?: (entry: AlexandriaEntry) => void;
  registerWithMonitoring?: (entry: AlexandriaEntry) => Promise<void>;
}

/**
 * Register the checkout at `path`, returning the entry and whether it is new.
 * Throws only when the registry write itself fails.
 */
export async function registerRepository(
  path: string,
  remoteUrl?: string,
  deps: RegisterRepositoryDependencies = {},
): Promise<RegisterRepositoryResult> {
  const registry = deps.registry ?? AlexandriaRegistryService.getInstance();

  const existing = await registry.getRepositoryByPath(path);
  if (existing) {
    return { entry: existing, created: false };
  }

  const entry = await registry.registerRepository(path, remoteUrl);

  try {
    (deps.broadcastAdded ??
      ((added: AlexandriaEntry) =>
        broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_ADDED, added)))(
      entry,
    );
  } catch (error) {
    console.error('[Alexandria] Failed to broadcast REPOSITORY_ADDED:', error);
  }

  await (deps.registerWithMonitoring ?? registerWithMonitoring)(entry);

  return { entry, created: true };
}
