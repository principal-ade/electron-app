/**
 * Where the shared repository monitor daemon comes from and how this app
 * launches one when none is running. Mirrors terminal/daemonSpawner.ts for the
 * packaged layout (asarUnpack) but prefers a system `node`: the daemon is
 * shared with other apps on the machine, so it should not be tied to this
 * app's Electron runtime unless nothing else is available.
 */

import { app } from 'electron';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { stripTsNodePreload } from '../../shared/nodeOptions';

const DAEMON_FILE = 'repo-monitor-daemon.cjs';

function projectRoot(): string {
  // In development app.getAppPath() is .erb/dll because webpack writes the
  // main bundle there; the project root is two levels up.
  const appPath = app.getAppPath();
  return appPath.includes('.erb/dll') ? path.resolve(appPath, '..', '..') : appPath;
}

/** Daemon bundle path: unpacked from asar in production, node_modules in development. */
export function resolveRepoMonitorDaemonEntryPath(): string {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'dist',
      'main',
      DAEMON_FILE,
    );
  }
  const staged = path.join(projectRoot(), 'dist', 'main', DAEMON_FILE);
  if (fs.existsSync(staged)) return staged;
  return require.resolve(
    '@principal-ai/repository-monitoring-server/dist/daemon/repository-monitoring-daemon.js',
  );
}

function isExecutable(candidate: string): boolean {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function newestVersionDir(root: string): string | null {
  try {
    const entries = fs
      .readdirSync(root)
      .filter((name) => /^v?\d+\.\d+\.\d+$/.test(name))
      .sort((a, b) =>
        b.replace(/^v/, '').localeCompare(a.replace(/^v/, ''), undefined, {
          numeric: true,
        }),
      );
    return entries.length > 0 ? path.join(root, entries[0]) : null;
  } catch {
    return null;
  }
}

/**
 * A system Node binary, or null. Order: REPO_MONITOR_NODE, PATH, Homebrew /
 * /usr/local, then the common version managers (newest install first).
 */
export function findSystemNode(): string | null {
  const explicit = process.env.REPO_MONITOR_NODE;
  if (explicit && isExecutable(explicit)) return explicit;

  if (process.platform !== 'win32') {
    try {
      const found = execFileSync('/usr/bin/which', ['node'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: process.env,
      }).trim();
      if (found && isExecutable(found)) return found;
    } catch {
      // not on PATH
    }
  }

  const home = os.homedir();
  const candidates: string[] = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    path.join(home, '.volta', 'bin', 'node'),
  ];
  for (const root of [
    path.join(home, '.fnm', 'node-versions'),
    path.join(home, 'Library', 'Application Support', 'fnm', 'node-versions'),
  ]) {
    const dir = newestVersionDir(root);
    if (dir) candidates.push(path.join(dir, 'installation', 'bin', 'node'));
  }
  const asdf = newestVersionDir(path.join(home, '.asdf', 'installs', 'nodejs'));
  if (asdf) candidates.push(path.join(asdf, 'bin', 'node'));
  const nvm = newestVersionDir(path.join(home, '.nvm', 'versions', 'node'));
  if (nvm) candidates.push(path.join(nvm, 'bin', 'node'));

  return candidates.find(isExecutable) ?? null;
}

export interface RepoMonitorLauncher {
  nodeBinary: string;
  /** 'system' when a Node install was found, 'electron' when falling back to this app's runtime. */
  runtime: 'system' | 'electron';
  env: Record<string, string>;
}

/**
 * Binary and environment used to spawn the daemon when none answers on the
 * socket. Falls back to Electron's embedded Node via ELECTRON_RUN_AS_NODE.
 */
export function resolveRepoMonitorLauncher(): RepoMonitorLauncher {
  const env: Record<string, string> = {
    // The dev main process runs under ts-node; the daemon must not inherit it.
    NODE_OPTIONS: stripTsNodePreload(process.env.NODE_OPTIONS ?? ''),
  };
  if (app.isPackaged) {
    // @parcel/watcher lives in the unpacked node_modules; without this the
    // daemon falls back to chokidar.
    env.NODE_PATH = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
    );
  } else {
    env.NODE_PATH = path.join(projectRoot(), 'node_modules');
  }

  const systemNode = findSystemNode();
  if (systemNode) {
    return { nodeBinary: systemNode, runtime: 'system', env };
  }
  return {
    nodeBinary: process.execPath,
    runtime: 'electron',
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
  };
}
