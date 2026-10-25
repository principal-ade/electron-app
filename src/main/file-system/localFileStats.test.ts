/** @jest-environment node */
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { getLocalFileStats } from './localFileStats';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), 'local-file-stats-'));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test('a writable regular local file is editable', async () => {
  const file = path.join(root, 'source.ts');
  await fs.writeFile(file, 'hello');
  expect(await getLocalFileStats(file)).toMatchObject({
    writable: true,
    isDirectory: false,
    size: 5,
  });
});
test('directories are never editable files', async () => {
  expect(await getLocalFileStats(root)).toMatchObject({
    writable: false,
    isDirectory: true,
  });
});
test('missing files do not claim write access', async () => {
  await expect(
    getLocalFileStats(path.join(root, 'missing.ts')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});
(process.getuid?.() === 0 ? test.skip : test)(
  'a read-only file is not editable',
  async () => {
    const file = path.join(root, 'readonly.ts');
    await fs.writeFile(file, 'hello', { mode: 0o444 });
    try {
      expect(await getLocalFileStats(file)).toMatchObject({ writable: false });
    } finally {
      await fs.chmod(file, 0o644);
    }
  },
);
