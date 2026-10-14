/**
 * Process lifecycle hooks.
 *
 * Managed processes are spawned detached, so they outlive the app unless we
 * stop them. On quit, if anything is still running we ask the user — listing
 * the processes — whether to stop them first or leave them running.
 */

import { app, dialog } from 'electron';
import { getProcessRegistry } from './ProcessRegistry';
import type { ProcessEntry, ProcessStatus } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

const ACTIVE_STATUSES: ProcessStatus[] = [
  'starting',
  'running',
  'restarting',
  'stopping',
];

/** Re-entry guard: set once the user has answered, so the second quit proceeds. */
let confirmed = false;

function describe(entry: ProcessEntry): string {
  const port = entry.port != null ? ` — localhost:${entry.port}` : '';
  return `• ${entry.label}${port}`;
}

export function registerProcessQuitHandler(): void {
  app.on('before-quit', (event) => {
    if (confirmed) return;

    const registry = getProcessRegistry();
    const running = registry
      .list()
      .filter((entry) => ACTIVE_STATUSES.includes(entry.status));
    if (running.length === 0) return;

    // Hold the quit until the user decides.
    event.preventDefault();

    const response = dialog.showMessageBoxSync({
      type: 'question',
      buttons: [
        'Stop processes & quit',
        'Leave them running & quit',
        'Cancel',
      ],
      defaultId: 0,
      cancelId: 2,
      title: 'Processes are still running',
      message:
        running.length === 1
          ? '1 managed process is still running.'
          : `${running.length} managed processes are still running.`,
      detail: `These will keep running in the background unless you stop them:\n\n${running
        .map(describe)
        .join('\n')}\n\nStop them before quitting?`,
    });

    // Cancel — abort the quit and keep everything as-is.
    if (response === 2) return;

    confirmed = true;

    if (response === 0) {
      // Stop every running process (SIGTERM → SIGKILL), then quit.
      void Promise.all(running.map((entry) => registry.stop(entry.id)))
        .catch(() => {
          /* best-effort */
        })
        .finally(() => app.quit());
    } else {
      // Leave them running; they'll be orphaned until stopped elsewhere.
      app.quit();
    }
  });
}
