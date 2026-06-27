import yaml from 'js-yaml';
import { getFrontmatterError, repairFrontmatter, parseFrontmatter, splitFrontmatter, buildFrontmatter, stripRedundantTitleHeading, } from './frontmatter';
// A folded block scalar whose continuation lines are indented *less* than its
// first content line. This is the shape that makes a strict `yaml.load` throw
// `bad indentation of a mapping entry` and crashes the MDX editor.
const BROKEN = `---
tags:
  - Internal — investor card
note: >
    Facts about the firm/contact only — the case file
  here. Two flags: (1) Our pitch-event card listing
  Competition Judge" (Stage and Bio both "N/A")
---
# Body stays intact
`;
const VALID = `---
title: Hello
tags: [a, b]
note: >
  one line
  two line
---
Body
`;
describe('getFrontmatterError', () => {
    it('returns null when there is no front matter', () => {
        expect(getFrontmatterError('# just a doc\n')).toBeNull();
    });
    it('returns null for valid front matter', () => {
        expect(getFrontmatterError(VALID)).toBeNull();
    });
    it('returns the YAML error message for malformed front matter', () => {
        const err = getFrontmatterError(BROKEN);
        expect(err).toBeTruthy();
        expect(err).toMatch(/bad indentation of a mapping entry/);
    });
});
describe('repairFrontmatter', () => {
    it('leaves documents without front matter untouched', () => {
        const doc = '# just a doc\n';
        expect(repairFrontmatter(doc)).toBe(doc);
    });
    it('leaves valid front matter byte-for-byte unchanged', () => {
        expect(repairFrontmatter(VALID)).toBe(VALID);
    });
    it('rewrites malformed front matter into something a strict parser can load', () => {
        const fixed = repairFrontmatter(BROKEN);
        expect(fixed).not.toBe(BROKEN);
        // The whole point: a strict load no longer throws.
        expect(getFrontmatterError(fixed)).toBeNull();
    });
    it('preserves the body and recovers the fields', () => {
        const fixed = repairFrontmatter(BROKEN);
        expect(fixed).toContain('# Body stays intact');
        const { data } = parseFrontmatter(fixed);
        expect(data.tags).toEqual(['Internal — investor card']);
        expect(typeof data.note).toBe('string');
        expect(data.note).toContain('Two flags');
    });
    it('produces front matter that round-trips through js-yaml', () => {
        const fixed = repairFrontmatter(BROKEN);
        const between = fixed.replace(/^---\n/, '').split('\n---')[0];
        expect(() => yaml.load(between)).not.toThrow();
    });
});
describe('splitFrontmatter', () => {
    it('returns the whole document as body when there is no front matter', () => {
        const doc = '# just a doc\n';
        expect(splitFrontmatter(doc)).toEqual({ raw: '', inner: '', body: doc });
    });
    it('splits malformed front matter verbatim without parsing it', () => {
        const { raw, inner, body } = splitFrontmatter(BROKEN);
        // raw + body must reconstruct the original document byte-for-byte.
        expect(raw + body).toBe(BROKEN);
        expect(body).toBe('# Body stays intact\n');
        expect(inner).toContain('note: >');
        expect(raw.startsWith('---\n')).toBe(true);
    });
});
describe('buildFrontmatter', () => {
    it('wraps non-empty YAML in fences', () => {
        expect(buildFrontmatter('title: Hi')).toBe('---\ntitle: Hi\n---\n');
    });
    it('returns an empty string for blank YAML (removes front matter)', () => {
        expect(buildFrontmatter('   \n  ')).toBe('');
        expect(buildFrontmatter('')).toBe('');
    });
    it('round-trips with splitFrontmatter for valid front matter', () => {
        const { inner, body } = splitFrontmatter(VALID);
        expect(buildFrontmatter(inner) + body).toBe(VALID);
    });
});
describe('stripRedundantTitleHeading', () => {
    it('removes a leading H1 that matches the title', () => {
        const body = '# Hello World\n\nFirst paragraph.\n';
        expect(stripRedundantTitleHeading(body, 'Hello World')).toBe('First paragraph.\n');
    });
    it('matches case-insensitively and ignores surrounding whitespace', () => {
        const body = '\n\n#   hello world  \n\nBody.\n';
        expect(stripRedundantTitleHeading(body, 'Hello World')).toBe('Body.\n');
    });
    it('removes a setext H1 (underlined) that matches', () => {
        const body = 'Hello World\n===========\n\nBody.\n';
        expect(stripRedundantTitleHeading(body, 'Hello World')).toBe('Body.\n');
    });
    it('leaves the body untouched when the H1 differs from the title', () => {
        const body = '# Something Else\n\nBody.\n';
        expect(stripRedundantTitleHeading(body, 'Hello World')).toBe(body);
    });
    it('does not strip a deeper heading (H2) even if the text matches', () => {
        const body = '## Hello World\n\nBody.\n';
        expect(stripRedundantTitleHeading(body, 'Hello World')).toBe(body);
    });
    it('only touches the first heading, not a matching one further down', () => {
        const body = 'Intro line.\n\n# Hello World\n\nBody.\n';
        expect(stripRedundantTitleHeading(body, 'Hello World')).toBe(body);
    });
    it('is a no-op when there is no title', () => {
        const body = '# Hello World\n\nBody.\n';
        expect(stripRedundantTitleHeading(body, undefined)).toBe(body);
        expect(stripRedundantTitleHeading(body, '   ')).toBe(body);
    });
});
