import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  describeDaemonBuildMismatch,
  describeDaemonStatusMismatch,
  hashBundleFile,
  type DaemonBuildInfo,
} from './buildIdentity';

const build = (
  bundleHash: string | null,
  version = '1.0.0',
): DaemonBuildInfo => ({
  version,
  bundleHash,
});

describe('describeDaemonBuildMismatch', () => {
  const available = build('new');

  it('keeps a daemon running the same bundle', () => {
    expect(
      describeDaemonBuildMismatch(build('new', '0.9.0'), available),
    ).toBeNull();
  });

  it('replaces a daemon running a different bundle even at the same version', () => {
    expect(describeDaemonBuildMismatch(build('old'), available)).toEqual({
      running: build('old'),
      available,
    });
  });

  it('treats a daemon that reports no build as stale', () => {
    expect(describeDaemonBuildMismatch(undefined, available)).toEqual({
      running: null,
      available,
    });
    expect(describeDaemonBuildMismatch(null, available)).toEqual({
      running: null,
      available,
    });
  });

  it('keeps the daemon when neither side could hash its bundle', () => {
    expect(describeDaemonBuildMismatch(build(null), build(null))).toBeNull();
  });

  it('replaces the daemon when only one side could hash its bundle', () => {
    expect(describeDaemonBuildMismatch(build(null), available)).not.toBeNull();
    expect(
      describeDaemonBuildMismatch(build('old'), build(null)),
    ).not.toBeNull();
  });
});

describe('describeDaemonStatusMismatch', () => {
  const available = build('new');

  it('does not infer a mismatch when the status request failed', () => {
    expect(describeDaemonStatusMismatch(null, available)).toBeNull();
    expect(describeDaemonStatusMismatch(undefined, available)).toBeNull();
  });

  it('still treats a responding legacy daemon without build metadata as stale', () => {
    expect(describeDaemonStatusMismatch({}, available)).toEqual({
      running: null,
      available,
    });
  });

  it('compares build metadata from a responding daemon', () => {
    expect(
      describeDaemonStatusMismatch({ build: build('old') }, available),
    ).toEqual({ running: build('old'), available });
    expect(
      describeDaemonStatusMismatch({ build: build('new') }, available),
    ).toBeNull();
  });
});

describe('hashBundleFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pty-daemon-build-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('hashes the file contents', async () => {
    const file = path.join(dir, 'pty-daemon.cjs');
    fs.writeFileSync(file, 'console.log("daemon")');
    const expected = crypto
      .createHash('sha1')
      .update('console.log("daemon")')
      .digest('hex');
    await expect(hashBundleFile(file)).resolves.toBe(expected);
  });

  it('resolves null for a missing file', async () => {
    await expect(
      hashBundleFile(path.join(dir, 'missing.cjs')),
    ).resolves.toBeNull();
  });
});
