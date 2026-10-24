import path from 'path';
import {
  DAEMON_DIR,
  DAEMON_LOG_FILE,
  PID_FILE,
  SOCKET_PATH,
  getDaemonPaths,
} from './constants';

describe('PTY daemon build isolation', () => {
  const home = path.resolve('/home/test');

  it.each(['darwin', 'linux'] as const)(
    'keeps development resources separate on %s',
    (platform) => {
      const production = getDaemonPaths('production', platform, home);
      const development = getDaemonPaths('development', platform, home);
      expect(production).toEqual({
        directory: path.join(home, '.principal'),
        socketPath: path.join(home, '.principal', 'pty-daemon.sock'),
        pidFile: path.join(home, '.principal', 'pty-daemon.pid'),
        logFile: path.join(home, '.principal', 'daemon.log'),
      });
      expect(development).toEqual({
        directory: path.join(home, '.principal', 'dev'),
        socketPath: path.join(home, '.principal', 'dev', 'pty-daemon.sock'),
        pidFile: path.join(home, '.principal', 'dev', 'pty-daemon.pid'),
        logFile: path.join(home, '.principal', 'dev', 'daemon.log'),
      });
    },
  );

  it('isolates Windows named pipes as well as PID and log files', () => {
    const production = getDaemonPaths('production', 'win32', home);
    const development = getDaemonPaths('development', 'win32', home);
    expect(production.socketPath).toBe('\\\\.\\pipe\\principal-pty-daemon');
    expect(development.socketPath).toBe(
      '\\\\.\\pipe\\principal-pty-daemon-dev',
    );
    expect(development.pidFile).not.toBe(production.pidFile);
    expect(development.logFile).not.toBe(production.logFile);
  });

  it('preserves production paths when NODE_ENV is unset', () => {
    const previous = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      expect(getDaemonPaths(undefined, 'darwin', home)).toEqual(
        getDaemonPaths('production', 'darwin', home),
      );
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  it('exports one consistent set of paths for every consumer', () => {
    const paths = getDaemonPaths();
    expect(DAEMON_DIR).toBe(paths.directory);
    expect(SOCKET_PATH).toBe(paths.socketPath);
    expect(PID_FILE).toBe(paths.pidFile);
    expect(DAEMON_LOG_FILE).toBe(paths.logFile);
  });

  it('does not let packaged simulation make a dev build use production paths', () => {
    const previous = process.env.NODE_ENV_PACKAGED_SIMULATION;
    process.env.NODE_ENV_PACKAGED_SIMULATION = 'true';
    try {
      expect(getDaemonPaths('development', 'darwin', home).directory).toBe(
        path.join(home, '.principal', 'dev'),
      );
    } finally {
      if (previous === undefined)
        delete process.env.NODE_ENV_PACKAGED_SIMULATION;
      else process.env.NODE_ENV_PACKAGED_SIMULATION = previous;
    }
  });
});
