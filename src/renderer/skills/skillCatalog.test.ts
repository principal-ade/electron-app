import {
  getInstalledCatalogSkillNames,
  installSkills,
  ALL_SKILL_DETAILS,
} from './skillCatalog';
import { SkillLockService } from '../main-process-api/SkillLockService';
import { GithubService } from '../main-process-api/GithubService';

jest.mock('../main-process-api/SkillLockService', () => ({
  SkillLockService: { getLockFile: jest.fn(), getInstalledSkills: jest.fn() },
}));
jest.mock('../main-process-api/GithubService', () => ({
  GithubService: { getTree: jest.fn(), installSkill: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

test('catalog readiness requires both the advertised source and readable installed files', async () => {
  (SkillLockService.getLockFile as jest.Mock).mockResolvedValue({
    skills: {
      'create-topic': { source: 'principal-ai/skills' },
      'topic-context': { source: 'principal-ai/skills' },
      'file-city-tours': { source: 'another/repo' },
    },
  });
  (SkillLockService.getInstalledSkills as jest.Mock).mockResolvedValue([
    { name: 'create-topic', available: true },
    { name: 'topic-context', available: false },
    { name: 'file-city-tours', available: true },
  ]);
  expect(await getInstalledCatalogSkillNames()).toEqual(
    new Set(['create-topic']),
  );
});

test('catalog readiness fails closed when file availability is unknown', async () => {
  (SkillLockService.getLockFile as jest.Mock).mockResolvedValue({
    skills: { 'topic-context': { source: 'principal-ai/skills' } },
  });
  (SkillLockService.getInstalledSkills as jest.Mock).mockResolvedValue([
    { name: 'topic-context' },
  ]);
  expect(await getInstalledCatalogSkillNames()).toEqual(new Set());
});

test('does not install a skill folder without its entrypoint', async () => {
  (GithubService.getTree as jest.Mock).mockResolvedValue({
    success: true,
    data: { tree: [{ type: 'blob', path: 'topic-context/README.md' }] },
  });
  const result = await installSkills(
    ALL_SKILL_DETAILS.filter((skill) => skill.name === 'topic-context'),
  );
  expect(result.installed).toEqual([]);
  expect(result.failures[0]).toContain('SKILL.md not found');
  expect(GithubService.installSkill).not.toHaveBeenCalled();
});
