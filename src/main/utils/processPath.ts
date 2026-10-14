import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Directories where user-installed CLIs (`gh`, `git`, `bun`, `node`, `docker`,
 * npm globals, …) commonly live.
 *
 * A GUI app launched from Finder/Dock inherits launchd's minimal PATH
 * (`/usr/bin:/bin:/usr/sbin:/sbin`), which omits Homebrew and per-user bins.
 * Code that shells out to those tools therefore fails only in the packaged
 * build, not in `npm run dev` (which inherits the terminal's full PATH).
 */
function getUserBinaryPaths(): string[] {
  const home = os.homedir();
  const paths = [
    '/opt/homebrew/bin', // Apple Silicon Homebrew
    '/opt/homebrew/sbin',
    '/usr/local/bin', // Intel Homebrew / manual installs
    '/usr/local/sbin',
    path.join(home, '.local', 'bin'),
    path.join(home, '.bun', 'bin'),
    path.join(home, '.cargo', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, 'bin'),
  ];
  if (process.platform === 'darwin') {
    paths.push('/Library/Apple/usr/bin');
  }
  return paths;
}

let ensured = false;

/**
 * The minimal PATH a macOS GUI app launched by Finder/Dock inherits from
 * launchd. This is the packaged app's *starting point*.
 */
export const PACKAGED_BASE_PATH =
  process.platform === 'darwin' ? '/usr/bin:/bin:/usr/sbin:/sbin' : '';

/**
 * Dev/testing aid: reset this process's PATH to the same minimal base a
 * Finder-launched packaged app inherits, so `npm run dev` starts from exactly
 * the same point as the installed build. Call before {@link ensureProcessPath}
 * to reproduce the packaged PATH.
 *
 * No-op on platforms without a known packaged base.
 */
export function resetToPackagedBasePath(): void {
  if (process.platform !== 'darwin') {
    return;
  }
  process.env.PATH = PACKAGED_BASE_PATH;
  ensured = false;
}

/**
 * Idempotently append the well-known user binary directories to this process's
 * PATH so raw `child_process` calls (which inherit `process.env.PATH`) can
 * resolve Homebrew-installed tools like `gh`. Call once during startup.
 *
 * @returns the augmented PATH.
 */
export function ensureProcessPath(): string {
  if (ensured) {
    return process.env.PATH ?? '';
  }

  const delimiter = path.delimiter;
  const existing = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const seen = new Set(existing);
  const additions = getUserBinaryPaths().filter(
    (dir) => !seen.has(dir) && existsSync(dir),
  );

  process.env.PATH = [...existing, ...additions].join(delimiter);
  ensured = true;
  return process.env.PATH;
}

/**
 * The augmented PATH that shell-out code should pass to child processes.
 * Never regress to the Intel-only `/usr/local/bin:/usr/bin:/bin` default.
 */
export function getProcessPath(): string {
  const current = ensureProcessPath();
  return current || getUserBinaryPaths().join(path.delimiter);
}
