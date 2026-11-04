/** @jest-environment node */
import {
  BUILD_RUN_OSC_APP,
  BuildRunRegistry,
  buildRunCommand,
  generateRunId,
} from './BuildRunRegistry';

function backend() {
  const listeners = new Set<
    (event: { sessionId: string; exitCode?: number }) => void
  >();
  return {
    listeners,
    destroyed: [] as string[],
    emit: (event: { sessionId: string; exitCode?: number }) => {
      for (const listener of Array.from(listeners)) listener(event);
    },
    onSessionExit: jest.fn(
      (listener: (event: { sessionId: string; exitCode?: number }) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    ),
    getProgramStatus: jest.fn(
      (sessionId: string) => (backendRecords.get(sessionId) ?? []) as never,
    ),
    hasSession: jest.fn(() => true),
    destroySession: jest.fn(async (sessionId: string) => {
      destroyedSessions.push(sessionId);
    }),
  };
}

// Per-test record store, since the backend object above closes over helpers.
const backendRecords = new Map<
  string,
  Array<{ state: string; app?: string }>
>();
const destroyedSessions: string[] = [];

describe('BuildRunRegistry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    backendRecords.clear();
    destroyedSessions.length = 0;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function track(overrides = {}) {
    const fake = backend();
    const registry = new BuildRunRegistry(fake);
    const record = registry.trackRun({
      runId: 'run-1',
      configId: 'bc-web-build',
      terminalSessionId: 'session-1',
      timeoutMs: 60_000,
      ...overrides,
    });
    return { fake, registry, record };
  }

  test('starts runs as running with a started timestamp', () => {
    const { record } = track();
    expect(record).toMatchObject({
      runId: 'run-1',
      configId: 'bc-web-build',
      terminalSessionId: 'session-1',
      status: 'running',
    });
    expect(record.startedAt).toBeTruthy();
  });

  test('a done OSC record means succeeded with the exit event code', () => {
    const { fake, registry } = track();
    backendRecords.set('session-1', [
      { state: 'working', app: BUILD_RUN_OSC_APP },
      { state: 'done', app: BUILD_RUN_OSC_APP },
    ]);
    fake.emit({ sessionId: 'session-1', exitCode: 0 });
    expect(registry.getRun('run-1')).toMatchObject({
      status: 'succeeded',
      exitCode: 0,
    });
  });

  test('an error OSC record means failed', () => {
    const { fake, registry } = track();
    backendRecords.set('session-1', [
      { state: 'error', app: BUILD_RUN_OSC_APP },
    ]);
    fake.emit({ sessionId: 'session-1', exitCode: 2 });
    expect(registry.getRun('run-1')).toMatchObject({
      status: 'failed',
      exitCode: 2,
    });
  });

  test('without an OSC record the exit code decides', () => {
    const { fake, registry } = track();
    fake.emit({ sessionId: 'session-1', exitCode: 1 });
    expect(registry.getRun('run-1')).toMatchObject({
      status: 'failed',
      exitCode: 1,
    });
    registry.trackRun({
      runId: 'run-2',
      configId: 'bc-web-build',
      terminalSessionId: 'session-2',
      timeoutMs: 60_000,
    });
    fake.emit({ sessionId: 'session-2', exitCode: 0 });
    expect(registry.getRun('run-2')).toMatchObject({ status: 'succeeded' });
  });

  test('exits for other sessions are ignored', () => {
    const { fake, registry } = track();
    fake.emit({ sessionId: 'session-other', exitCode: 1 });
    expect(registry.getRun('run-1')?.status).toBe('running');
  });

  test('timeout marks timed-out and destroys the session', async () => {
    const { fake, registry } = track({ timeoutMs: 1_000 });
    jest.advanceTimersByTime(1_000);
    expect(registry.getRun('run-1')).toMatchObject({ status: 'timed-out' });
    expect(fake.destroySession).toHaveBeenCalledWith('session-1');
    // A late exit must not overwrite the terminal state.
    fake.emit({ sessionId: 'session-1', exitCode: 0 });
    expect(registry.getRun('run-1')?.status).toBe('timed-out');
  });

  test('unknown runs read back null', () => {
    const { registry } = track();
    expect(registry.getRun('nope')).toBeNull();
  });

  test('finished runs evict past the bound, running runs never evict', () => {
    const fake = backend();
    const registry = new BuildRunRegistry(fake, 2);
    for (const n of [1, 2, 3]) {
      registry.trackRun({
        runId: `run-${n}`,
        configId: 'bc',
        terminalSessionId: `session-${n}`,
        timeoutMs: 60_000,
      });
      fake.emit({ sessionId: `session-${n}`, exitCode: 0 });
    }
    expect(registry.getRun('run-1')).toBeNull();
    expect(registry.getRun('run-3')).toMatchObject({ status: 'succeeded' });
  });
});

describe('buildRunCommand', () => {
  test('wraps the line and reports via OSC 7501 under the build app tag', () => {
    const wrapped = buildRunCommand('npm run build');
    expect(wrapped).toContain('npm run build');
    expect(wrapped).toContain('7501');
    expect(wrapped).toContain('app=principal-build');
  });
});

describe('generateRunId', () => {
  test('produces unique run ids', () => {
    expect(generateRunId()).toMatch(/^run-/);
    expect(generateRunId()).not.toBe(generateRunId());
  });
});
