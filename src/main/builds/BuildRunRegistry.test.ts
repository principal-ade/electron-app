/** @jest-environment node */
import type { ProgramStatusEvent } from '../../shared/terminal/programStatus';
import {
  BUILD_RUN_OSC_APP,
  BuildRunRegistry,
  buildRunCommand,
  generateRunId,
} from './BuildRunRegistry';

type ExitEvent = { sessionId: string; exitCode?: number };
type StatusRecord = {
  state: string;
  app?: string;
  id?: string;
  title?: string;
};

function backend() {
  const exitListeners = new Set<(event: ExitEvent) => void>();
  const statusListeners = new Set<(event: ProgramStatusEvent) => void>();
  return {
    exitListeners,
    statusListeners,
    destroyed: [] as string[],
    emitExit: (event: ExitEvent) => {
      for (const listener of Array.from(exitListeners)) listener(event);
    },
    emitStatus: (sessionId: string, records: StatusRecord[]) => {
      for (const listener of Array.from(statusListeners)) {
        listener({ sessionId, records } as unknown as ProgramStatusEvent);
      }
    },
    onSessionExit: jest.fn((listener: (event: ExitEvent) => void) => {
      exitListeners.add(listener);
      return () => {
        exitListeners.delete(listener);
      };
    }),
    onProgramStatus: jest.fn(
      (listener: (event: ProgramStatusEvent) => void) => {
        statusListeners.add(listener);
        return () => {
          statusListeners.delete(listener);
        };
      },
    ),
    getProgramStatus: jest.fn(
      (sessionId: string) => (backendRecords.get(sessionId) ?? []) as never,
    ),
    hasSession: jest.fn(() => true),
    getScrollbackBuffer: jest.fn(
      async (sessionId: string) => `output:${sessionId}`,
    ),
    destroySession: jest.fn(async (sessionId: string) => {
      destroyedSessions.push(sessionId);
    }),
  };
}

// Per-test record store, since the backend object above closes over helpers.
const backendRecords = new Map<string, StatusRecord[]>();
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

  test('reads output and secret-name metadata by tracked run id', async () => {
    const { fake, registry } = track({ secretEnvNames: ['NPM_TOKEN'] });
    await expect(registry.getOutputBuffer('run-1')).resolves.toBe(
      'output:session-1',
    );
    expect(fake.getScrollbackBuffer).toHaveBeenCalledWith('session-1');
    expect(registry.getSecretEnvNames('run-1')).toEqual(['NPM_TOKEN']);
    expect(registry.getSecretEnvNames('missing')).toBeNull();
  });

  test('snapshots completed output and destroys the terminal after its grace period', async () => {
    const { fake, registry } = track({ cleanupDelayMs: 1_000 });
    fake.emitStatus('session-1', [
      { state: 'done', app: BUILD_RUN_OSC_APP, id: 'run-1', title: 'exit=0' },
    ]);

    await Promise.resolve();
    await Promise.resolve();
    expect(registry.getOutputSnapshot('run-1')).toBe('output:session-1');
    expect(fake.destroySession).not.toHaveBeenCalled();

    jest.advanceTimersByTime(999);
    expect(fake.destroySession).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(fake.destroySession).toHaveBeenCalledWith('session-1');
    expect(registry.getOutputSnapshot('run-1')).toBe('output:session-1');
  });

  test('stopping a run snapshots output and marks it cancelled', async () => {
    const { fake, registry } = track();

    await expect(registry.stopRun('run-1')).resolves.toMatchObject({
      status: 'cancelled',
      terminalSessionId: 'session-1',
    });
    expect(fake.destroySession).toHaveBeenCalledWith('session-1');
    expect(registry.getOutputSnapshot('run-1')).toBe('output:session-1');
    expect(registry.getRun('run-1')?.status).toBe('cancelled');
  });

  test('a tagged done report finalizes without a session exit', () => {
    const { fake, registry } = track();
    fake.emitStatus('session-1', [
      { state: 'working', app: BUILD_RUN_OSC_APP, id: 'run-1' },
      {
        state: 'done',
        app: BUILD_RUN_OSC_APP,
        id: 'run-1',
        title: 'exit=0',
      },
    ]);
    expect(registry.getRun('run-1')).toMatchObject({
      status: 'succeeded',
      exitCode: 0,
    });
  });

  test('an error report finalizes failed with its exit code', () => {
    const { fake, registry } = track();
    fake.emitStatus('session-1', [
      {
        state: 'error',
        app: BUILD_RUN_OSC_APP,
        id: 'run-1',
        title: 'exit=130',
      },
    ]);
    expect(registry.getRun('run-1')).toMatchObject({
      status: 'failed',
      exitCode: 130,
    });
  });

  test('reports for other runs in a reused session are ignored', () => {
    const { fake, registry } = track();
    fake.emitStatus('session-1', [
      {
        state: 'done',
        app: BUILD_RUN_OSC_APP,
        id: 'run-previous',
        title: 'exit=0',
      },
    ]);
    expect(registry.getRun('run-1')?.status).toBe('running');
  });

  test('a stale report already stored does not finalize a new run', () => {
    backendRecords.set('session-1', [
      {
        state: 'done',
        app: BUILD_RUN_OSC_APP,
        id: 'run-previous',
        title: 'exit=0',
      },
    ]);
    const { registry } = track();
    expect(registry.getRun('run-1')?.status).toBe('running');
  });

  test('a report that landed before tracking finalizes the run', () => {
    backendRecords.set('session-1', [
      {
        state: 'done',
        app: BUILD_RUN_OSC_APP,
        id: 'run-1',
        title: 'exit=0',
      },
    ]);
    const { registry } = track();
    expect(registry.getRun('run-1')).toMatchObject({
      status: 'succeeded',
      exitCode: 0,
    });
  });

  test('reports for other sessions are ignored', () => {
    const { fake, registry } = track();
    fake.emitStatus('session-other', [
      { state: 'done', app: BUILD_RUN_OSC_APP, id: 'run-1' },
    ]);
    expect(registry.getRun('run-1')?.status).toBe('running');
  });

  test('a done OSC record means succeeded with the exit event code', () => {
    const { fake, registry } = track();
    backendRecords.set('session-1', [
      { state: 'working', app: BUILD_RUN_OSC_APP, id: 'run-1' },
      { state: 'done', app: BUILD_RUN_OSC_APP, id: 'run-1', title: 'exit=0' },
    ]);
    fake.emitExit({ sessionId: 'session-1', exitCode: 0 });
    expect(registry.getRun('run-1')).toMatchObject({
      status: 'succeeded',
      exitCode: 0,
    });
  });

  test('an error OSC record means failed', () => {
    const { fake, registry } = track();
    backendRecords.set('session-1', [
      {
        state: 'error',
        app: BUILD_RUN_OSC_APP,
        id: 'run-1',
        title: 'exit=2',
      },
    ]);
    fake.emitExit({ sessionId: 'session-1', exitCode: 2 });
    expect(registry.getRun('run-1')).toMatchObject({
      status: 'failed',
      exitCode: 2,
    });
  });

  test('without an OSC record the exit code decides', () => {
    const { fake, registry } = track();
    fake.emitExit({ sessionId: 'session-1', exitCode: 1 });
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
    fake.emitExit({ sessionId: 'session-2', exitCode: 0 });
    expect(registry.getRun('run-2')).toMatchObject({ status: 'succeeded' });
  });

  test('exits for other sessions are ignored', () => {
    const { fake, registry } = track();
    fake.emitExit({ sessionId: 'session-other', exitCode: 1 });
    expect(registry.getRun('run-1')?.status).toBe('running');
  });

  test('timeout marks timed-out and destroys the session', async () => {
    const { fake, registry } = track({ timeoutMs: 1_000 });
    jest.advanceTimersByTime(1_000);
    await Promise.resolve();
    await Promise.resolve();
    expect(registry.getRun('run-1')).toMatchObject({ status: 'timed-out' });
    expect(fake.destroySession).toHaveBeenCalledWith('session-1');
    // Late signals must not overwrite the terminal state.
    fake.emitExit({ sessionId: 'session-1', exitCode: 0 });
    fake.emitStatus('session-1', [
      { state: 'done', app: BUILD_RUN_OSC_APP, id: 'run-1' },
    ]);
    expect(registry.getRun('run-1')?.status).toBe('timed-out');
  });

  test('finalizing unsubscribes both signal listeners', () => {
    const { fake, registry } = track();
    expect(fake.statusListeners.size).toBe(1);
    fake.emitStatus('session-1', [
      { state: 'done', app: BUILD_RUN_OSC_APP, id: 'run-1' },
    ]);
    expect(registry.getRun('run-1')).toMatchObject({ status: 'succeeded' });
    expect(fake.statusListeners.size).toBe(0);
    expect(fake.exitListeners.size).toBe(0);
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
      fake.emitStatus(`session-${n}`, [
        { state: 'done', app: BUILD_RUN_OSC_APP, id: `run-${n}` },
      ]);
    }
    expect(registry.getRun('run-1')).toBeNull();
    expect(registry.getRun('run-3')).toMatchObject({ status: 'succeeded' });
  });
});

describe('buildRunCommand', () => {
  test('wraps the line and reports the run id via OSC 7501', () => {
    const wrapped = buildRunCommand('npm run build', 'run-abc');
    expect(wrapped).toContain('npm run build');
    expect(wrapped).toContain('7501');
    expect(wrapped).toContain('app=principal-build');
    expect(wrapped).toContain('id=run-abc');
  });
});

describe('generateRunId', () => {
  test('produces unique run ids', () => {
    expect(generateRunId()).toMatch(/^run-/);
    expect(generateRunId()).not.toBe(generateRunId());
  });
});
