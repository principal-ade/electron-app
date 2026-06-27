import { extractDocReferences } from './docReferences';

describe('extractDocReferences', () => {
  it('returns nothing for empty / non-string input', () => {
    expect(extractDocReferences('')).toEqual([]);
    // @ts-expect-error testing defensive guard
    expect(extractDocReferences(undefined)).toEqual([]);
  });

  it('extracts a link with href, label, and 1-based position', () => {
    const refs = extractDocReferences('See [the docs](docs/architecture.md).');
    expect(refs).toEqual([
      {
        kind: 'link',
        value: 'docs/architecture.md',
        label: 'the docs',
        line: 1,
        column: 5,
      },
    ]);
  });

  it('extracts a purl-qualified link verbatim', () => {
    const refs = extractDocReferences(
      '[auth](pkg:github/owner/repo#src/auth.ts)',
    );
    expect(refs[0]).toMatchObject({
      kind: 'link',
      value: 'pkg:github/owner/repo#src/auth.ts',
      label: 'auth',
    });
  });

  it('strips a <> wrapper and a trailing "title" from the dest', () => {
    expect(extractDocReferences('[a](<docs/x.md>)')[0].value).toBe('docs/x.md');
    expect(extractDocReferences('[a](docs/x.md "the title")')[0].value).toBe(
      'docs/x.md',
    );
  });

  it('extracts inline code with the surrounding single space stripped', () => {
    const refs = extractDocReferences('Call `AuthService.refresh` now.');
    expect(refs).toEqual([
      {
        kind: 'inline-code',
        value: 'AuthService.refresh',
        line: 1,
        column: 6,
      },
    ]);
    // CommonMark single-space strip
    expect(extractDocReferences('`` `code` ``')[0].value).toBe('`code`');
  });

  it('does NOT treat link syntax inside inline code as a link', () => {
    const refs = extractDocReferences('Literal: `[not](a-link)` stays code.');
    expect(refs).toEqual([
      {
        kind: 'inline-code',
        value: '[not](a-link)',
        line: 1,
        column: 10,
      },
    ]);
  });

  it('ignores links and headings inside fenced code blocks', () => {
    const md = [
      'Real [link](real.md)',
      '```ts',
      '# not a heading',
      'const x = "[fake](nope.md)";',
      '```',
      'Another [link](after.md)',
    ].join('\n');
    const refs = extractDocReferences(md);
    expect(refs.map((r) => r.value)).toEqual(['real.md', 'after.md']);
    expect(refs.map((r) => r.line)).toEqual([1, 6]);
  });

  it('handles ~~~ fences too', () => {
    const md = ['~~~', '[fake](nope.md)', '~~~', '[real](yes.md)'].join('\n');
    expect(extractDocReferences(md).map((r) => r.value)).toEqual(['yes.md']);
  });

  it('extracts multiple references on one line in order', () => {
    const refs = extractDocReferences('[a](one.md) and `code` and [b](two.md)');
    expect(refs.map((r) => [r.kind, r.value])).toEqual([
      ['link', 'one.md'],
      ['inline-code', 'code'],
      ['link', 'two.md'],
    ]);
  });

  it('flags images and parses dest', () => {
    const refs = extractDocReferences('![alt](images/diagram.png)');
    expect(refs[0]).toMatchObject({
      kind: 'link',
      value: 'images/diagram.png',
      label: 'alt',
      image: true,
    });
  });

  it('honors balanced parens in the destination', () => {
    const refs = extractDocReferences('[x](https://en.wikipedia.org/wiki/Foo_(bar))');
    expect(refs[0].value).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  it('treats an escaped bracket / backtick as literal text', () => {
    expect(extractDocReferences('\\[not a link](x.md)')).toEqual([]);
    expect(extractDocReferences('\\`not code\\`')).toEqual([]);
  });

  it('does not emit a link when there is no () destination', () => {
    expect(extractDocReferences('[just brackets] and text')).toEqual([]);
  });

  it('tracks line numbers across a multi-line doc', () => {
    const md = ['# Title', '', 'A [one](a.md)', 'B [two](b.md)'].join('\n');
    const refs = extractDocReferences(md);
    expect(refs).toEqual([
      { kind: 'link', value: 'a.md', label: 'one', line: 3, column: 3 },
      { kind: 'link', value: 'b.md', label: 'two', line: 4, column: 3 },
    ]);
  });
});
