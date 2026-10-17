/** @jest-environment node */
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { ProcessRegistry } from './ProcessRegistry';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
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
