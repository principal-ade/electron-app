/**
 * Main-process telemetry settings cache.
 *
 * The saved preference lives in the electron store, which is async, but three
 * consumers need the answer synchronously:
 *
 *   - the `get-otel-endpoint` sync IPC the preload scripts call,
 *   - the PTY daemon spawn env,
 *   - the event-processing utility process fork env.
 *
 * So the preference is read once during startup, resolved against the
 * environment, and cached here. Changing it from Settings re-resolves and
 * notifies subscribers (the main-process provider re-initialises on that).
 */

import {
  RESOLVED_ENABLED_ENV,
  RESOLVED_ENDPOINT_ENV,
  resolveTelemetrySettings,
  type TelemetryPreference,
  type TelemetrySettings,
} from '../../telemetry/config';
import { StaticNamespaces } from '../storage-providers/types';
import type { TypedMultiStoreWrapper } from '../storage-providers/typed-multistore-wrapper';
import { USER_PREFERENCES_KEY } from '../../shared/types/userPreferences.types';

let settings: TelemetrySettings = resolveTelemetrySettings({
  env: process.env,
});

const subscribers = new Set<(settings: TelemetrySettings) => void>();

/** The resolved settings, safe to call synchronously from anywhere in main. */
export function getTelemetrySettings(): TelemetrySettings {
  return settings;
}

/**
 * Re-resolve from a preference value and notify subscribers when the answer
 * actually changed. Called on startup (after the store is ready) and on every
 * preference write.
 */
export function applyTelemetryPreference(
  preference: TelemetryPreference | undefined,
): void {
  const next = resolveTelemetrySettings({ preference, env: process.env });

  if (next.enabled === settings.enabled && next.endpoint === settings.endpoint) {
    return;
  }

  settings = next;

  for (const subscriber of subscribers) {
    try {
      subscriber(next);
    } catch (error) {
      console.error('[TelemetrySettings] Subscriber failed:', error);
    }
  }
}

/** Subscribe to resolved-setting changes. Returns an unsubscribe function. */
export function subscribeTelemetrySettings(
  callback: (settings: TelemetrySettings) => void,
): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Load the saved preference from the electron store into the cache. Must run
 * after `initializeStorage()` and before any child process is spawned or any
 * window is created, so every consumer sees the same answer.
 */
export async function refreshTelemetrySettingsFromStore(
  store: TypedMultiStoreWrapper,
): Promise<void> {
  try {
    const result = await store.get(
      USER_PREFERENCES_KEY,
      StaticNamespaces.USER_PREFERENCES,
    );

    applyTelemetryPreference(
      result.success && result.data
        ? (result.data as { telemetry?: TelemetryPreference }).telemetry
        : undefined,
    );
  } catch (error) {
    console.error(
      '[TelemetrySettings] Could not read telemetry preference:',
      error,
    );
  }
}

/**
 * The telemetry slice of the environment a child process should inherit. The
 * main process is the only one that can read the preference, so it passes the
 * resolved answer down on spawn.
 */
export function childTelemetryEnv(): Record<string, string> {
  const current = getTelemetrySettings();

  return {
    [RESOLVED_ENDPOINT_ENV]: current.endpoint,
    [RESOLVED_ENABLED_ENV]: String(current.enabled),
  };
}
