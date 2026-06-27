import { classifyTopicReferences } from './classifyTopicReferences';

const REPO = 'pkg:github/owner/repo';

describe('classifyTopicReferences', () => {
  it('passes external and anchor links without findings', () => {
    const md = '[site](https://example.com) [m](mailto:a@b.com) [top](#intro)';
    const { findings, toResolve } = classifyTopicReferences(md);
    expect(findings).toEqual([]);
    expect(toResolve).toEqual([]);
  });

  it('flags a repo-relative link that is not purl-qualified as an error', () => {
    const { findings } = classifyTopicReferences('[x](docs/architecture.md)');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      severity: 'error',
      code: 'non-purl-repo-link',
    });
  });

  it('flags a malformed purl as an error', () => {
    const { findings } = classifyTopicReferences('[x](pkg:)');
    expect(findings[0]).toMatchObject({
      severity: 'error',
      code: 'malformed-purl',
    });
  });

  it('queues an in-scope purl file-ref for resolution with no finding', () => {
    const md = `[auth](${REPO}#src/auth.ts)`;
    const { findings, toResolve } = classifyTopicReferences(md, {
      topicRepoPurls: [REPO],
    });
    expect(findings).toEqual([]);
    expect(toResolve).toHaveLength(1);
    expect(toResolve[0]).toMatchObject({
      repoPurl: REPO,
      path: 'src/auth.ts',
      inScope: true,
    });
  });

  it('flags an out-of-scope purl but still queues it for resolution', () => {
    const md = `[x](pkg:github/other/lib#src/x.ts)`;
    const { findings, toResolve } = classifyTopicReferences(md, {
      topicRepoPurls: [REPO],
    });
    expect(findings[0]).toMatchObject({
      severity: 'finding',
      code: 'out-of-scope',
      repoPurl: 'pkg:github/other/lib',
    });
    expect(toResolve[0]).toMatchObject({ inScope: false, path: 'src/x.ts' });
  });

  it('treats any purl as in-scope when the topic declares no repos', () => {
    const md = `[x](${REPO}#a.ts)`;
    const { findings, toResolve } = classifyTopicReferences(md);
    expect(findings).toEqual([]);
    expect(toResolve[0].inScope).toBe(true);
  });

  it('compares repo scope case-insensitively for git hosts', () => {
    const md = `[x](pkg:github/Owner/Repo#a.ts)`;
    const { findings } = classifyTopicReferences(md, {
      topicRepoPurls: ['pkg:github/owner/repo'],
    });
    expect(findings).toEqual([]);
  });

  it('does not resolve a bare repo purl (no subpath) and raises no finding', () => {
    const { findings, toResolve } = classifyTopicReferences(`[x](${REPO})`, {
      topicRepoPurls: [REPO],
    });
    expect(findings).toEqual([]);
    expect(toResolve).toEqual([]);
  });

  it('suggests converting path-like inline code', () => {
    const { findings } = classifyTopicReferences('see `src/foo/bar.ts` here');
    expect(findings[0]).toMatchObject({
      severity: 'suggestion',
      code: 'suggest-purl',
    });
  });

  it('does not flag non-path inline code', () => {
    const md = 'call `AuthService.refresh`, dir `src/main/auth/`, `TCP/IP`';
    expect(classifyTopicReferences(md).findings).toEqual([]);
  });

  it('ignores links and code inside fenced blocks (delegates to extractor)', () => {
    const md = ['```', '[x](bad.md)', '`src/y.ts`', '```'].join('\n');
    const { findings } = classifyTopicReferences(md);
    expect(findings).toEqual([]);
  });
});
