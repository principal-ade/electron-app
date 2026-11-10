import * as path from 'path';

export interface DaemonRuntimePathOptions {
  platform: NodeJS.Platform | string;
  executablePath: string;
  appName: string;
  isPackaged: boolean;
  existsSync: (filePath: string) => boolean;
}

/**
 * Resolve the Node runtime used to spawn the PTY daemon.
 *
 * On macOS, use Electron's background-only helper app rather than the main app
 * executable. Both contain the same Electron/Node runtime, but the helper has
 * its own bundle identity and does not create a Principal AI Dock item.
 */
export function resolveDaemonRuntimePath({
  platform,
  executablePath,
  appName,
  isPackaged,
  existsSync,
}: DaemonRuntimePathOptions): string {
  if (platform !== 'darwin') return executablePath;

  // Packaged app.getName() can be the package name (e.g. "principal-ade-electron"),
  // while electron-builder names this helper from the app bundle (e.g.
  // "Principal AI Helper"). Derive the packaged helper name from the actual
  // .app bundle path instead. In development electron-builder has not renamed
  // Electron's helper bundle.
  const appBundleName = path
    .basename(path.resolve(path.dirname(executablePath), '..', '..'))
    .replace(/\.app$/i, '');
  const helperName = isPackaged
    ? `${appBundleName || appName} Helper`
    : 'Electron Helper';
  const helperExecutablePath = path.resolve(
    path.dirname(executablePath),
    '..',
    'Frameworks',
    `${helperName}.app`,
    'Contents',
    'MacOS',
    helperName,
  );

  return existsSync(helperExecutablePath)
    ? helperExecutablePath
    : executablePath;
}
