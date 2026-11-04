/** @jest-environment node */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('electron', () => ({
  app: { getPath: () => '/tmp/build-config-test-nonexistent' },
}));

const stored = {
  id: 'bc-web-build',
  name: 'web build',
  repo: 'pkg:github/owner/repo',
  checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' },
  command: { line: 'npm run build', cwd: '.', timeoutMs: 900_000 },
  secrets: [{ env: 'NODE_AUTH_TOKEN', label: 'npm token', required: true }],
  secretConfirmation: null,
  createdAt: '2026-11-04T00:00:00.000Z',
  updatedAt: '2026-11-04T00:00:00.000Z',
};

type Router = {
  buildConfiguration_list: {
    action: (args: { context: unknown }) => Promise<unknown>;
  };
  buildConfiguration_get: {
    action: (args: {
      context: unknown;
      input: { id: string };
    }) => Promise<unknown>;
  };
};

describe('buildConfigurationRouter', () => {
  let directory: string;
  let router: Router;
  const OLD_ENV = process.env.PRINCIPAL_BUILD_CONFIGURATIONS_HOME;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'build-config-router-'));
    process.env.PRINCIPAL_BUILD_CONFIGURATIONS_HOME = directory;
    jest.resetModules();
    router = require('./buildConfigurationRouter').buildConfigurationRouter;
    const storeDir = join(directory, '.principal', 'build-configurations');
    await mkdir(storeDir, { recursive: true });
    await writeFile(
      join(storeDir, 'bc-web-build.json'),
      JSON.stringify(stored),
    );
  });

  afterEach(async () => {
    if (OLD_ENV === undefined)
      delete process.env.PRINCIPAL_BUILD_CONFIGURATIONS_HOME;
    else process.env.PRINCIPAL_BUILD_CONFIGURATIONS_HOME = OLD_ENV;
    jest.resetModules();
    await rm(directory, { recursive: true, force: true });
  });

  test('lists stored configs', async () => {
    const summaries = await router.buildConfiguration_list.action({
      context: {},
    });
    expect(summaries).toEqual([
      expect.objectContaining({ id: 'bc-web-build', name: 'web build' }),
    ]);
  });

  test('gets a config by id and misses unknown ids', async () => {
    expect(
      await router.buildConfiguration_get.action({
        context: {},
        input: { id: 'bc-web-build' },
      }),
    ).toMatchObject({ id: 'bc-web-build' });
    expect(
      await router.buildConfiguration_get.action({
        context: {},
        input: { id: 'bc-missing' },
      }),
    ).toBeNull();
  });

  test('updates secrets and misses unknown ids', async () => {
    const updated = await router.buildConfiguration_update.action({
      context: {},
      input: {
        id: 'bc-web-build',
        patch: {
          secrets: [
            {
              env: 'NODE_AUTH_TOKEN',
              label: 'npm token',
              required: true,
            },
            { env: 'GH_TOKEN', label: 'GitHub token', required: false },
          ],
        },
      },
    });
    expect(updated).toMatchObject({
      id: 'bc-web-build',
      secrets: expect.arrayContaining([
        expect.objectContaining({ env: 'GH_TOKEN' }),
      ]),
    });
    expect(
      await router.buildConfiguration_update.action({
        context: {},
        input: { id: 'bc-missing', patch: { name: 'x' } },
      }),
    ).toBeNull();
  });

  test('refuses confirmation while required secrets are ungranted', async () => {
    await expect(
      router.buildConfiguration_confirmSecrets.action({
        context: {},
        input: { id: 'bc-web-build' },
      }),
    ).rejects.toThrow(/missing secrets/);
    expect(
      await router.buildConfiguration_confirmSecrets.action({
        context: {},
        input: { id: 'bc-missing' },
      }),
    ).toBeNull();
  });
});
