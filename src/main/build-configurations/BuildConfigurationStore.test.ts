/** @jest-environment node */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BuildConfigurationStore,
  BuildConfigurationValidationError,
} from './BuildConfigurationStore';
import { confirmationFingerprintSource } from '../../shared/build-configurations/types';

const fields = () => ({
  name: 'web build',
  repo: 'pkg:github/owner/repo',
  checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' as const },
  command: { line: 'npm run build', cwd: '.', timeoutMs: 900_000 },
  secrets: [{ env: 'NODE_AUTH_TOKEN', label: 'npm token', required: true }],
});

describe('BuildConfigurationStore', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'build-config-store-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('creates and reads back a config with managed id and timestamps', async () => {
    const store = new BuildConfigurationStore(directory);
    const created = await store.create(fields());
    expect(created.id).toMatch(/^bc-/);
    expect(created.secretConfirmation).toBeNull();
    expect(created.createdAt).toBeTruthy();
    expect(await store.get(created.id)).toEqual(created);
  });

  it('ignores confirmation smuggled in at create time', async () => {
    const store = new BuildConfigurationStore(directory);
    const created = await store.create({
      ...fields(),
      secretConfirmation: { fingerprint: 'forged', envNames: [] },
    });
    expect(created.secretConfirmation).toBeNull();
  });

  it('stores secret names only, never values', async () => {
    const store = new BuildConfigurationStore(directory);
    const created = await store.create(fields());
    const raw = await readFile(join(directory, `${created.id}.json`), 'utf8');
    expect(raw).toContain('NODE_AUTH_TOKEN');
    expect(JSON.parse(raw).secrets).toEqual([
      { env: 'NODE_AUTH_TOKEN', label: 'npm token', required: true },
    ]);
  });

  it('rejects invalid input with the validation issues', async () => {
    const store = new BuildConfigurationStore(directory);
    const bad = {
      ...fields(),
      command: { line: 'rm -rf /', cwd: '.', timeoutMs: 1 },
    };
    const error = await store.create(bad).then(
      () => null,
      (err: unknown) => err as BuildConfigurationValidationError,
    );
    expect(error).toBeInstanceOf(BuildConfigurationValidationError);
    expect(error?.issues.join(' ')).toMatch(/allowlist/);
  });

  it('generates unique ids', async () => {
    const store = new BuildConfigurationStore(directory);
    const a = await store.create(fields());
    const b = await store.create(fields());
    expect(a.id).not.toBe(b.id);
  });

  it('merges patches and re-validates', async () => {
    const store = new BuildConfigurationStore(directory);
    const created = await store.create(fields());
    const updated = await store.update(created.id, {
      checkout: { ref: 'v2.0.0' },
      command: { timeoutMs: 600_000 },
    });
    expect(updated?.checkout.ref).toBe('v2.0.0');
    expect(updated?.checkout.depth).toBe(1);
    expect(updated?.command.timeoutMs).toBe(600_000);
    expect(updated?.createdAt).toBe(created.createdAt);
  });

  it('clears the secret confirmation on material edits only', async () => {
    const store = new BuildConfigurationStore(directory);
    const created = await store.create(fields());
    const confirmed = await store.update(created.id, {
      secretConfirmation: {
        fingerprint: confirmationFingerprintSource(created),
        envNames: ['NODE_AUTH_TOKEN'],
      },
    });
    expect(confirmed?.secretConfirmation).not.toBeNull();

    const renamed = await store.update(created.id, { name: 'new name' });
    expect(renamed?.secretConfirmation).not.toBeNull();

    const edited = await store.update(created.id, {
      command: { line: 'npm run build:prod' },
    });
    expect(edited?.secretConfirmation).toBeNull();
  });

  it('returns null for unknown ids and rejects id changes', async () => {
    const store = new BuildConfigurationStore(directory);
    expect(await store.update('bc-missing', { name: 'x' })).toBeNull();
    const created = await store.create(fields());
    await expect(store.update(created.id, { id: 'bc-other' })).rejects.toThrow(
      /cannot change/,
    );
  });

  it('removes configs and reports unknown ids', async () => {
    const store = new BuildConfigurationStore(directory);
    const created = await store.create(fields());
    expect(await store.remove(created.id)).toBe(true);
    expect(await store.get(created.id)).toBeNull();
    expect(await store.remove(created.id)).toBe(false);
    expect(await store.remove('../evil')).toBe(false);
  });

  it('lists most-recent-first and rebuilds a missing or corrupt index', async () => {
    const store = new BuildConfigurationStore(directory);
    const a = await store.create({ ...fields(), name: 'aaa' });
    const b = await store.create({ ...fields(), name: 'bbb' });
    // Force an ordering: b is newer.
    await store.update(b.id, { name: 'bbb' });
    const listed = await store.listSummaries();
    expect(listed.map((entry) => entry.id)[0]).toBe(b.id);
    expect(listed).toContainEqual(
      expect.objectContaining({ id: a.id, name: 'aaa', confirmed: false }),
    );

    await writeFile(join(directory, '_index.json'), '{corrupt');
    expect(await store.listSummaries()).toHaveLength(2);
    await rm(join(directory, '_index.json'));
    expect(await store.listSummaries()).toHaveLength(2);
  });

  it('rejects unsafe ids without touching the filesystem', async () => {
    const store = new BuildConfigurationStore(directory);
    for (const id of ['../evil', '../../bc-x', '', 'not-an-id']) {
      expect(await store.get(id)).toBeNull();
    }
  });

  it('enforces checkout containment when a base directory is set', async () => {
    const store = new BuildConfigurationStore(directory, {
      baseDefaultDirectory: join(directory, 'clones'),
    });
    await expect(
      store.create({
        ...fields(),
        checkout: {
          path: join(directory, 'elsewhere'),
          ref: 'main',
          depth: 1,
          reset: 'ff-only',
        },
      }),
    ).rejects.toThrow(/base default directory/);
    const ok = await store.create({
      ...fields(),
      checkout: {
        path: join(directory, 'clones', 'owner', 'repo'),
        ref: 'main',
        depth: 1,
        reset: 'ff-only',
      },
    });
    expect(ok.checkout.path).toContain('clones');
  });
});
