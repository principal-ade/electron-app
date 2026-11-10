import * as path from 'path';
import { resolveDaemonRuntimePath } from './daemonRuntimePath';

describe('resolveDaemonRuntimePath', () => {
  it('uses the packaged app background helper on macOS', () => {
    const executablePath =
      '/Applications/Principal AI.app/Contents/MacOS/Principal AI';
    const helperPath =
      '/Applications/Principal AI.app/Contents/Frameworks/Principal AI Helper.app/Contents/MacOS/Principal AI Helper';

    expect(
      resolveDaemonRuntimePath({
        platform: 'darwin',
        executablePath,
        // Electron reports the package name here in the packaged app, not the
        // product name used for its helper bundle.
        appName: 'principal-ade-electron',
        isPackaged: true,
        existsSync: (filePath) => filePath === helperPath,
      }),
    ).toBe(helperPath);
  });

  it('uses Electron Helper during development on macOS', () => {
    const executablePath =
      '/repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron';
    const helperPath = path.resolve(
      path.dirname(executablePath),
      '..',
      'Frameworks',
      'Electron Helper.app',
      'Contents',
      'MacOS',
      'Electron Helper',
    );

    expect(
      resolveDaemonRuntimePath({
        platform: 'darwin',
        executablePath,
        appName: 'Principal AI Dev',
        isPackaged: false,
        existsSync: (filePath) => filePath === helperPath,
      }),
    ).toBe(helperPath);
  });

  it('falls back to the main executable if the macOS helper is missing', () => {
    const executablePath =
      '/Applications/Principal AI.app/Contents/MacOS/Principal AI';

    expect(
      resolveDaemonRuntimePath({
        platform: 'darwin',
        executablePath,
        appName: 'Principal AI',
        isPackaged: true,
        existsSync: () => false,
      }),
    ).toBe(executablePath);
  });

  it.each(['win32', 'linux'] as const)(
    'keeps the current runtime on %s',
    (platform) => {
      const executablePath = '/path/to/electron';

      expect(
        resolveDaemonRuntimePath({
          platform,
          executablePath,
          appName: 'Principal AI',
          isPackaged: true,
          existsSync: () => true,
        }),
      ).toBe(executablePath);
    },
  );
});
