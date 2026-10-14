/**
 * Tests for processPath PATH augmentation.
 *
 * Regression guard for the packaged-macOS bug where a Finder-launched app
 * inherits launchd's minimal PATH (no Homebrew) and can no longer find `gh`.
 */

const originalPath = process.env.PATH;
const originalPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
}

function loadProcessPath(
  exists: boolean,
  platform: NodeJS.Platform = 'darwin',
): typeof import('./processPath') {
  setPlatform(platform);
  jest.resetModules();
  jest.doMock('fs', () => ({ existsSync: () => exists }));
  return require('./processPath');
}

describe('processPath', () => {
  afterEach(() => {
    process.env.PATH = originalPath;
    setPlatform(originalPlatform);
    jest.dontMock('fs');
    jest.resetModules();
  });

  it('appends existing user binary dirs (incl. Homebrew) to PATH', () => {
    const { ensureProcessPath } = loadProcessPath(true);
    process.env.PATH = '/usr/bin:/bin';

    const result = ensureProcessPath();

    expect(result.startsWith('/usr/bin:/bin')).toBe(true);
    expect(result).toContain('/opt/homebrew/bin');
  });

  it('is idempotent — does not duplicate entries on repeated calls', () => {
    const { ensureProcessPath } = loadProcessPath(true);
    process.env.PATH = '/usr/bin';

    const first = ensureProcessPath();
    const second = ensureProcessPath();

    expect(second).toBe(first);
    expect(first.split('/opt/homebrew/bin').length - 1).toBe(1);
  });

  it('only adds directories that exist', () => {
    const { ensureProcessPath } = loadProcessPath(false);
    process.env.PATH = '/usr/bin';

    expect(ensureProcessPath()).toBe('/usr/bin');
  });

  it('getProcessPath never regresses to the Intel default when PATH is empty', () => {
    const { getProcessPath } = loadProcessPath(true);
    process.env.PATH = '';

    expect(getProcessPath()).toContain('/opt/homebrew/bin');
  });

  it('resetToPackagedBasePath reproduces the packaged starting point', () => {
    const { ensureProcessPath, resetToPackagedBasePath, PACKAGED_BASE_PATH } =
      loadProcessPath(true);

    // Simulate a dev launch with the terminal's full PATH.
    process.env.PATH = '/Users/me/.opencode/bin:/opt/homebrew/bin:/usr/bin:/bin';
    resetToPackagedBasePath();

    expect(process.env.PATH).toBe(PACKAGED_BASE_PATH);

    const result = ensureProcessPath();
    expect(result.startsWith(PACKAGED_BASE_PATH)).toBe(true);
    expect(result).toContain('/opt/homebrew/bin');
    // Shell-only dirs from the terminal PATH are dropped.
    expect(result).not.toContain('/Users/me/.opencode/bin');
  });

  it('dev-simulated and packaged PATHs converge to the same value', () => {
    const packaged = loadProcessPath(true);
    process.env.PATH = packaged.PACKAGED_BASE_PATH;
    const packagedResult = packaged.ensureProcessPath();

    const dev = loadProcessPath(true);
    process.env.PATH = '/Users/me/.grok/bin:/opt/homebrew/bin:/usr/bin:/bin';
    dev.resetToPackagedBasePath();
    const devResult = dev.ensureProcessPath();

    expect(devResult).toBe(packagedResult);
  });

  it('resetToPackagedBasePath is a no-op on non-darwin platforms', () => {
    const { resetToPackagedBasePath } = loadProcessPath(true, 'linux');
    process.env.PATH = '/custom/bin';
    resetToPackagedBasePath();
    expect(process.env.PATH).toBe('/custom/bin');
  });
});
