/** @jest-environment node */
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { ProcessRegistry } from './ProcessRegistry';
import type {
  ProcessLaunchPersistence,
  SavedProcessLaunch,
} from './ProcessLaunchStore';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('electron', () => ({}));
jest.mock('fs', () => ({ existsSync: () => true }));
jest.mock('uuid', () => ({ v4: () => 'server-1' }));
jest.mock('../window/modernWindowManager', () => ({
  applicationWindows: new Map(),
}));
jest.mock('../stores/AlexandriaRegistryService', () => ({
  AlexandriaRegistryService: {
    getInstance: () => ({ getRepositories: async () => [] }),
  },
}));
jest.mock('../terminalEnvironment', () => ({
  terminalEnvironment: { getTerminalEnvironment: async () => ({}) },
}));

function child() {
  const process = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: jest.fn(),
    pid: undefined,
  });
  process.kill.mockImplementation(() => {
    process.emit('exit', 0, null);
    return true;
  });
  return process;
}

test('restart retains identity but discards the previous run port until fresh output', async () => {
  jest.useFakeTimers();
  try {
    const first = child();
    const second = child();
    (spawn as jest.Mock).mockReturnValueOnce(first).mockReturnValueOnce(second);
    const registry = new ProcessRegistry();
    const result = await registry.start({
      command: 'npm',
      args: ['run', 'dev'],
      cwd: '/repo',
    });
    if (!result.process) throw new Error('Managed process did not start');
    const id = result.process.id;
    first.emit('spawn');
    first.stdout.emit('data', Buffer.from('http://localhost:5173/'));
    expect(registry.get(id)).toMatchObject({ port: 5173, status: 'running' });
    await registry.restart(id);
    expect(registry.get(id)).toMatchObject({
      id,
      port: undefined,
      status: 'restarting',
      runCount: 2,
    });
    second.emit('spawn');
    expect(registry.get(id)?.port).toBeUndefined();
    second.stdout.emit('data', Buffer.from('http://localhost:6006/'));
    expect(registry.get(id)).toMatchObject({
      id,
      port: 6006,
      status: 'running',
      runCount: 2,
    });
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

describe('pinned launch configurations', () => {
  const request = {
    command: 'npm',
    args: ['run', 'dev', '--', 'argument with spaces'],
    cwd: '/repo',
    env: { CUSTOM_VALUE: 'test-value' },
    label: 'Dev server',
  };
  let saved: SavedProcessLaunch[];
  let store: ProcessLaunchPersistence;

  beforeEach(() => {
    jest.clearAllMocks();
    saved = [];
    store = {
      load: jest.fn(() => structuredClone(saved)),
      save: jest.fn((launches) => {
        saved = structuredClone(launches);
      }),
    };
    (spawn as jest.Mock).mockImplementation(() => child());
  });

  it('saves structured launch details and restores a stopped pin without executing it', async () => {
    const registry = new ProcessRegistry(store);
    await registry.start(request);
    expect(registry.setPinned('server-1', true)).toEqual({ success: true });
    expect(saved).toEqual([{ id: 'server-1', request }]);
    expect(registry.list()[0].pinned).toBe(true);

    (spawn as jest.Mock).mockClear();
    const restored = new ProcessRegistry(store);
    expect(spawn).not.toHaveBeenCalled();
    expect(restored.list()[0]).toMatchObject({
      id: 'server-1',
      pinned: true,
      status: 'stopped',
      cwd: '/repo',
    });
    expect(restored.list()[0]).not.toHaveProperty('env');
    const result = await restored.restart('server-1');
    expect(result.success).toBe(true);
    expect(spawn).toHaveBeenCalledWith(
      'npm',
      request.args,
      expect.objectContaining({
        cwd: '/repo',
        env: expect.objectContaining(request.env),
        shell: false,
      }),
    );
  });

  it('unpins durably without stopping the running process', async () => {
    const registry = new ProcessRegistry(store);
    await registry.start(request);
    registry.setPinned('server-1', true);
    expect(registry.setPinned('server-1', false)).toEqual({ success: true });
    expect(saved).toEqual([]);
    expect(registry.get('server-1')?.status).toBe('starting');
    expect(new ProcessRegistry(store).list()).toEqual([]);
  });

  it('does not change pin state when secure persistence fails', async () => {
    const registry = new ProcessRegistry(store);
    await registry.start(request);
    (store.save as jest.Mock).mockImplementation(() => {
      throw new Error('locked');
    });
    expect(registry.setPinned('server-1', true).success).toBe(false);
    expect(registry.get('server-1')?.pinned).not.toBe(true);
  });

  it('cannot pin externally detected IDs or remove pinned configurations', async () => {
    const registry = new ProcessRegistry(store);
    expect(registry.setPinned('detected:123', true).success).toBe(false);
    await registry.start(request);
    registry.setPinned('server-1', true);
    expect((await registry.remove('server-1')).success).toBe(false);
    expect(saved).toHaveLength(1);
  });

  it('does not overwrite an unreadable launch store', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (store.load as jest.Mock).mockImplementation(() => {
      throw new Error('locked');
    });
    const registry = new ProcessRegistry(store);
    await registry.start(request);
    expect(registry.setPinned('server-1', true).success).toBe(false);
    expect(store.save).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
