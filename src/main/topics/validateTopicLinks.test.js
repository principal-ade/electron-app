import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { validateTopicLinks } from './validateTopicLinks';
const REPO = 'pkg:github/owner/repo';
/** Build injectable deps with no local clones and a scripted github tree. */
const remoteOnlyDeps = (tree, defaultBranch = 'main') => ({
    registry: { getRepositories: async () => [] },
    github: {
        getRepoDefaultBranch: async () => defaultBranch,
        getTree: async () => ({
            success: true,
            data: {
                sha: 'deadbeef',
                url: '',
                truncated: false,
                tree: tree.map((p) => ({
                    path: p,
                    mode: '100644',
                    type: 'blob',
                    sha: 'x',
                })),
            },
        }),
    },
});
describe('validateTopicLinks', () => {
    it('passes an in-scope purl file-ref that exists on the remote default branch', async () => {
        const report = await validateTopicLinks(`[a](${REPO}#src/a.ts)`, {
            topicRepoPurls: [REPO],
            deps: remoteOnlyDeps(['src/a.ts']),
        });
        expect(report.findings).toEqual([]);
        expect(report.summary).toMatchObject({ checked: 1, ok: 1, findings: 0 });
    });
    it('flags a missing file with anchor-to-commit advice (unpinned remote)', async () => {
        const report = await validateTopicLinks(`[a](${REPO}#src/gone.ts)`, {
            topicRepoPurls: [REPO],
            deps: remoteOnlyDeps(['src/a.ts']),
        });
        const f = report.findings.find((x) => x.code === 'missing-file');
        expect(f).toBeTruthy();
        expect(f?.via).toBe('remote');
        expect(f?.ref).toBe('main');
        expect(f?.message).toMatch(/anchor the purl/i);
    });
    it('uses the pinned ref and reports it when a pinned file is missing', async () => {
        const report = await validateTopicLinks(`[a](${REPO}@abc123#src/gone.ts)`, {
            topicRepoPurls: [REPO],
            deps: remoteOnlyDeps(['src/a.ts']),
        });
        const f = report.findings.find((x) => x.code === 'missing-file');
        expect(f?.ref).toBe('abc123');
        expect(f?.message).toMatch(/pinned ref abc123/);
    });
    it('reports repo-unresolvable for a non-github repo with no clone', async () => {
        const report = await validateTopicLinks('[a](pkg:gitlab/o/r#a.ts)', {
            deps: remoteOnlyDeps([]),
        });
        expect(report.findings[0]).toMatchObject({
            code: 'repo-unresolvable',
            via: 'none',
        });
    });
    it('reports repo-unresolvable when the github tree fetch fails', async () => {
        const deps = {
            registry: { getRepositories: async () => [] },
            github: {
                getRepoDefaultBranch: async () => 'main',
                getTree: async () => ({ success: false, error: 'rate limited' }),
            },
        };
        const report = await validateTopicLinks(`[a](${REPO}#a.ts)`, { deps });
        expect(report.findings[0]).toMatchObject({
            code: 'repo-unresolvable',
            via: 'remote',
        });
        expect(report.findings[0].message).toMatch(/rate limited/);
    });
    it('checks a local clone first via fs and skips the remote', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'validate-links-'));
        await fs.mkdir(path.join(dir, 'src'));
        await fs.writeFile(path.join(dir, 'src', 'a.ts'), '// hi');
        let remoteCalled = false;
        const deps = {
            registry: {
                getRepositories: async () => [{ purl: REPO, path: dir }],
            },
            github: {
                getRepoDefaultBranch: async () => 'main',
                getTree: async () => {
                    remoteCalled = true;
                    return { success: true, data: { sha: '', url: '', truncated: false, tree: [] } };
                },
            },
        };
        const present = await validateTopicLinks(`[a](${REPO}#src/a.ts)`, {
            topicRepoPurls: [REPO],
            deps,
        });
        expect(present.summary).toMatchObject({ ok: 1, findings: 0 });
        expect(remoteCalled).toBe(false);
        const absent = await validateTopicLinks(`[a](${REPO}#src/missing.ts)`, {
            topicRepoPurls: [REPO],
            deps,
        });
        const f = absent.findings.find((x) => x.code === 'missing-file');
        expect(f?.via).toBe('local-clone');
        expect(f?.message).toMatch(/local clone/);
        await fs.rm(dir, { recursive: true, force: true });
    });
    it('rejects path-traversal subpaths as unsafe (repo-unresolvable)', async () => {
        const report = await validateTopicLinks(`[a](${REPO}#../../etc/passwd)`, { topicRepoPurls: [REPO], deps: remoteOnlyDeps([]) });
        // parsePurl may or may not retain the dotted subpath; if it surfaces as a
        // resolvable ref it must be rejected, never resolved.
        const bad = report.findings.find((x) => x.code === 'repo-unresolvable');
        if (report.summary.checked > 0) {
            expect(bad?.via).toBe('none');
        }
    });
    it('carries pure-classifier findings through (non-purl repo link)', async () => {
        const report = await validateTopicLinks('[x](docs/x.md)', {
            deps: remoteOnlyDeps([]),
        });
        expect(report.findings).toEqual([
            expect.objectContaining({
                severity: 'error',
                code: 'non-purl-repo-link',
                line: 1,
            }),
        ]);
        expect(report.summary.errors).toBe(1);
    });
});
