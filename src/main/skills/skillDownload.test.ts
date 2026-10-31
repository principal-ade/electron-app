/** @jest-environment node */
import { hasSkillEntrypoint } from './skillDownload';

test.each([
  { files: [] },
  {
    files: [
      { path: 'topic-context/README.md', content: '# Supporting document' },
    ],
  },
  { files: [{ path: 'topic-context/SKILL.md', content: '  \n' }] },
  { files: [{ path: 'another-skill/SKILL.md', content: '# Wrong skill' }] },
])('rejects incomplete skill downloads: %p', ({ files }) => {
  expect(hasSkillEntrypoint('topic-context', files)).toBe(false);
});

test.each(['topic-context', 'topic-context/'])(
  'accepts a non-empty downloaded entrypoint: %s',
  (path) => {
    expect(
      hasSkillEntrypoint(path, [
        { path: 'topic-context/SKILL.md', content: '# Topic Context\n' },
      ]),
    ).toBe(true);
  },
);
