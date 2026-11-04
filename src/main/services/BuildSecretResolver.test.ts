/** @jest-environment node */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BuildSecretResolver,
  BuildSecretResolverError,
} from './BuildSecretResolver';

jest.mock('electron', () => ({ app: {} }));

const DECLS = [
  { env: 'NODE_AUTH_TOKEN', required: true },
  { env: 'GH_TOKEN', required: true },
  { env: 'OPTIONAL_FLAG', required: false },
];

const OPTIONS = { configId: 'bc-web-build', runId: 'run-1' };

function resolver(
  stored: Record<string, unknown> | null,
  auditFile: string,
  readSecrets?: () => Promise<Record<string, unknown> | null>,
) {
  return new BuildSecretResolver(
    readSecrets ?? (async () => stored),
    auditFile,
  );
}

describe('BuildSecretResolver', () => {
  let directory: string;
  let auditFile: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'build-secret-resolver-'));
    auditFile = join(directory, 'audit', 'build-secret-grants.jsonl');
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('resolves granted secrets and reports required gaps', async () => {
    const result = await resolver(
      { NODE_AUTH_TOKEN: 'token-value', OPTIONAL_FLAG: '' },
      auditFile,
    ).resolve('build:bc-web-build', DECLS, OPTIONS);
    expect(result).toEqual({
      env: { NODE_AUTH_TOKEN: 'token-value' },
      missing: ['GH_TOKEN'],
    });
  });

  test('audit log carries names only, never values', async () => {
    await resolver(
      { NODE_AUTH_TOKEN: 'super-secret-value' },
      auditFile,
    ).resolve(
      'build:bc-web-build',
      [{ env: 'NODE_AUTH_TOKEN', required: true }],
      OPTIONS,
    );
    const raw = await readFile(auditFile, 'utf8');
    const [line] = raw.trim().split('\n');
    expect(JSON.parse(line)).toEqual({
      when: expect.any(String),
      configId: 'bc-web-build',
      runId: 'run-1',
      envNames: ['NODE_AUTH_TOKEN'],
    });
    expect(raw).not.toContain('super-secret-value');
  });

  test('non-string grants count as missing without leaking', async () => {
    const result = await resolver(
      { NODE_AUTH_TOKEN: { nested: 'object-value' } },
      auditFile,
    ).resolve(
      'build:bc-web-build',
      [{ env: 'NODE_AUTH_TOKEN', required: true }],
      OPTIONS,
    );
    expect(result).toEqual({ env: {}, missing: ['NODE_AUTH_TOKEN'] });
    await expect(
      readFile(auditFile, 'utf8').then(
        () => 'written',
        () => 'absent',
      ),
    ).resolves.toBe('absent');
  });

  test('empty resolutions write no audit lines', async () => {
    const result = await resolver(null, auditFile).resolve(
      'build:bc-web-build',
      [{ env: 'GH_TOKEN', required: true }],
      OPTIONS,
    );
    expect(result).toEqual({ env: {}, missing: ['GH_TOKEN'] });
    await expect(
      readFile(auditFile, 'utf8').then(
        () => 'written',
        () => 'absent',
      ),
    ).resolves.toBe('absent');
  });

  test('rejects malformed declarations', async () => {
    await expect(
      resolver({}, auditFile).resolve(
        'build:bc-web-build',
        [{ env: '', required: true }],
        OPTIONS,
      ),
    ).rejects.toThrow(BuildSecretResolverError);
  });

  test('fails closed when the audit log is unwritable', async () => {
    await expect(
      resolver({ NODE_AUTH_TOKEN: 'v' }, directory).resolve(
        'build:bc-web-build',
        [{ env: 'NODE_AUTH_TOKEN', required: true }],
        OPTIONS,
      ),
    ).rejects.toThrow(/attribut/);
  });

  test('propagates storage read failures', async () => {
    await expect(
      resolver(null, auditFile, async () => {
        throw new Error('store unavailable');
      }).resolve('build:bc-web-build', DECLS, OPTIONS),
    ).rejects.toThrow('store unavailable');
  });
});
