import { randomUUID } from 'crypto';
import Store from 'electron-store';
import { app, BrowserWindow } from 'electron';
import { SpanStatusCode } from '@opentelemetry/api';
import { getTracer, nodeTelemetry } from '../telemetry';
import { getDaemonStatus, isDaemonRunning } from '../terminal/daemonSpawner';

type AttributeValue = string | number | boolean;

interface LifecycleEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, AttributeValue>;
  exported: boolean;
}

interface UpdateAttempt {
  id: string;
  fromVersion: string;
  toVersion: string;
  startedAt: number;
  completed: boolean;
  events: LifecycleEvent[];
}

interface LifecycleStore {
  attempts: UpdateAttempt[];
}

const store = new Store<LifecycleStore>({
  name: 'update-lifecycle-telemetry',
  defaults: { attempts: [] },
});

const tracer = getTracer('principal-ade-update-lifecycle');
const MAX_ATTEMPTS = 3;
const MAX_EVENTS_PER_ATTEMPT = 40;

function getAttempts(): UpdateAttempt[] {
  return store.get('attempts', []);
}

function saveAttempts(attempts: UpdateAttempt[]): void {
  store.set('attempts', attempts.slice(-MAX_ATTEMPTS));
}

export function beginUpdateLifecycleAttempt(toVersion: string): string {
  const attempts = getAttempts();
  const attempt: UpdateAttempt = {
    id: randomUUID(),
    fromVersion: app.getVersion(),
    toVersion,
    startedAt: Date.now(),
    completed: false,
    events: [],
  };
  attempts.push(attempt);
  saveAttempts(attempts);
  recordUpdateLifecycleStage('update.install_requested', {}, attempt.id);
  return attempt.id;
}

export function recordUpdateLifecycleStage(
  name: string,
  attributes: Record<string, AttributeValue> = {},
  attemptId?: string,
): void {
  const attempts = getAttempts();
  const attempt = attemptId
    ? attempts.find((item) => item.id === attemptId)
    : [...attempts].reverse().find((item) => !item.completed);
  if (!attempt) return;

  attempt.events.push({
    name,
    timestamp: Date.now(),
    attributes,
    exported: false,
  });
  attempt.events = attempt.events.slice(-MAX_EVENTS_PER_ATTEMPT);
  saveAttempts(attempts);

  if (nodeTelemetry.isReady()) {
    void flushUpdateLifecycleTelemetry();
  }
}

export async function collectPostUpdateRuntimeDiagnostics(): Promise<void> {
  const attempt = [...getAttempts()].reverse().find((item) => !item.completed);
  if (!attempt) return;

  const attributes: Record<string, AttributeValue> = {
    'app.version': app.getVersion(),
    'app.name': app.getName(),
    'app.is_packaged': app.isPackaged,
    'app.ready': app.isReady(),
    'app.window_count': BrowserWindow.getAllWindows().filter(
      (window) => !window.isDestroyed(),
    ).length,
    'process.type': 'main',
    'process.platform': process.platform,
    'process.arch': process.arch,
    'process.pid': process.pid,
    'process.title': process.title,
  };

  try {
    const running = await isDaemonRunning();
    attributes['pty_daemon.running'] = running;
    if (running) {
      const status = await getDaemonStatus();
      if (status) {
        attributes['pty_daemon.pid'] = status.pid;
        attributes['pty_daemon.session_count'] = status.sessionCount;
        attributes['pty_daemon.client_count'] = status.clientCount;
        if (status.build?.version) {
          attributes['pty_daemon.build_version'] = status.build.version;
        }
        if (status.build?.bundleHash) {
          attributes['pty_daemon.bundle_hash'] = status.build.bundleHash;
        }
      }
    }
  } catch {
    attributes['pty_daemon.diagnostics_error'] = true;
  }

  recordUpdateLifecycleStage(
    'startup.runtime_diagnostics',
    attributes,
    attempt.id,
  );
}

export async function flushUpdateLifecycleTelemetry(): Promise<void> {
  if (!nodeTelemetry.isReady()) return;

  const attempts = getAttempts();
  for (const attempt of attempts) {
    for (const event of attempt.events) {
      if (event.exported) continue;

      const span = tracer.startSpan('app_updates.restart_stage', {
        attributes: {
          'update.attempt_id': attempt.id,
          'update.from_version': attempt.fromVersion,
          'update.to_version': attempt.toVersion,
          'update.stage': event.name,
          'update.started_at_unix_ms': attempt.startedAt,
          'app.version': app.getVersion(),
          'app.is_packaged': app.isPackaged,
          'process.platform': process.platform,
          'process.arch': process.arch,
          ...event.attributes,
        },
      });
      span.addEvent(event.name, { 'event.timestamp_unix_ms': event.timestamp });
      const failed =
        event.name.endsWith('_failed') ||
        event.name.endsWith('_exited') ||
        event.name.endsWith('_load_failed');
      span.setStatus({
        code: failed ? SpanStatusCode.ERROR : SpanStatusCode.OK,
      });
      span.end();
      event.exported = true;
    }
  }

  saveAttempts(
    attempts.filter(
      (attempt) =>
        !attempt.completed || attempt.events.some((event) => !event.exported),
    ),
  );
}

export async function completeUpdateLifecycleAttempt(
  id?: string,
): Promise<void> {
  const attempts = getAttempts();
  const attempt = id
    ? attempts.find((item) => item.id === id)
    : [...attempts].reverse().find((item) => !item.completed);
  if (!attempt) return;

  attempt.completed = true;
  recordUpdateLifecycleStage('startup.main_window_ready', {}, attempt.id);
  await flushUpdateLifecycleTelemetry();
}

export async function failUpdateLifecycleAttempt(
  errorName: string,
  id?: string,
): Promise<void> {
  const attempts = getAttempts();
  const attempt = id
    ? attempts.find((item) => item.id === id)
    : [...attempts].reverse().find((item) => !item.completed);
  if (!attempt) return;

  attempt.completed = true;
  saveAttempts(attempts);
  recordUpdateLifecycleStage(
    'update.install_failed',
    { 'error.name': errorName },
    attempt.id,
  );
  await flushUpdateLifecycleTelemetry();
}
