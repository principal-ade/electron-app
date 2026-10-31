/** @jest-environment node */
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import { SkillLockFileService } from './skillLockFile';
import { createEmptyLockFile } from '../../shared/main-process-api-interfaces/SkillLockAPI';

jest.mock('electron', () => ({ app: { getPath: jest.fn() } }));

let home: string;
let service: SkillLockFileService;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'skill-readiness-'));
  (app.getPath as jest.Mock).mockReturnValue(home);
  service = new SkillLockFileService();
  await service.initialize();
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

async function register(name: string, canonicalPath?: string) {
  await service.addSkill({
    name,
    entry: {
      source: 'principal-ai/skills',
      sourceType: 'github',
      sourceUrl: 'https://github.com/principal-ai/skills',
      skillFolderHash: 'hash',
      canonicalPath,
    },
  });
}

test('a lock entry alone is not an available skill and remains listed for repair', async () => {
  await register('topic-context');
  expect(await service.isSkillInstalled('topic-context')).toBe(false);
  expect(await service.getAllSkills()).toEqual([
    expect.objectContaining({ name: 'topic-context', available: false }),
  ]);
  expect((await service.readLockFile()).skills['topic-context']).toBeDefined();
});

test('checks the canonical SKILL.md on each call, including repair and removal', async () => {
  const directory = join(home, '.agents', 'skills', 'topic-context');
  await register('topic-context');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'SKILL.md'), '# Topic Context\n');
  expect(await service.isSkillInstalled('topic-context')).toBe(true);
  expect((await service.getAllSkills())[0].available).toBe(true);
  await rm(join(directory, 'SKILL.md'));
  expect(await service.isSkillInstalled('topic-context')).toBe(false);
});

test('follows working symlinks and rejects dangling symlinks', async () => {
  const target = join(home, 'target');
  await mkdir(target);
  await writeFile(join(target, 'SKILL.md'), '# Topic Context\n');
  await symlink(target, join(home, 'working'));
  await symlink(join(home, 'missing'), join(home, 'broken'));
  await register('working', join(home, 'working'));
  await register('broken', join(home, 'broken'));
  expect(await service.isSkillInstalled('working')).toBe(true);
  expect(await service.isSkillInstalled('broken')).toBe(false);
});

test('rejects empty files and directories named SKILL.md', async () => {
  const empty = join(home, 'empty');
  const directory = join(home, 'directory');
  await mkdir(empty);
  await writeFile(join(empty, 'SKILL.md'), '  \n');
  await mkdir(join(directory, 'SKILL.md'), { recursive: true });
  await register('empty', empty);
  await register('directory', directory);
  expect(await service.isSkillInstalled('empty')).toBe(false);
  expect(await service.isSkillInstalled('directory')).toBe(false);
  expect(await service.isSkillInstalled('unknown')).toBe(false);
});

test('does not count untracked files as an installed skill', async () => {
  const directory = join(home, '.agents', 'skills', 'topic-context');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'SKILL.md'), '# Topic Context\n');
  await service.writeLockFile(createEmptyLockFile());
  expect(await service.getAllSkills()).toEqual([]);
});
