import { isTerminalCwd, parseTerminalCwd } from './cwd';
import { OscScanner } from './programStatus';

const parse = (value: string) => parseTerminalCwd(value, 'my-mac.local', 'darwin');

describe('OSC 7 cwd reports', () => {
  it('decodes a local path and supports empty, localhost and local hostnames', () => {
    expect(parse('file:///Users/me/a%20b')).toBe('/Users/me/a b');
    expect(parse('file://localhost/tmp')).toBe('/tmp');
    expect(parse('file://MY-MAC.LOCAL/tmp')).toBe('/tmp');
    expect(parse('file:///')).toBe('/');
    expect(parse('file:///tmp/%E2%9C%93')).toBe('/tmp/✓');
  });

  it.each([
    'file://remote-host/tmp',
    'https://my-mac.local/tmp',
    '/tmp',
    'file:relative',
    'file://user:password@my-mac.local/tmp',
    'file://my-mac.local:80/tmp',
    'file:///tmp?command=oops',
    'file:///tmp#fragment',
    'file:///tmp/%',
    'file:///tmp/%00',
    'file:///tmp/%0A',
    'file:///tmp/%C2%9B',
    'file:///tmp/\n',
    'file:///tmp\\other',
    'file:////remote/share',
    'file:///%2Fremote/share',
    'file:///' + 'x'.repeat(4096),
  ])('rejects unsafe or nonlocal input: %s', (payload) => {
    expect(parse(payload)).toBeNull();
  });

  it('converts local Windows drive URIs without accepting network shares', () => {
    expect(parseTerminalCwd('file:///C:/Users/a%20b', 'pc', 'win32'))
      .toBe('C:\\Users\\a b');
    expect(parseTerminalCwd('file://other/share', 'pc', 'win32')).toBeNull();
    expect(parseTerminalCwd('file:///tmp', 'pc', 'win32')).toBeNull();
    expect(isTerminalCwd('relative', 'win32')).toBe(false);
    expect(isTerminalCwd('/tmp', 'darwin')).toBe(true);
  });

  it.each(['\x07', '\x1b\\'])('reassembles chunked reports with terminator %j', (end) => {
    const scanner = new OscScanner();
    expect(scanner.push('output\x1b]7;file://my-mac.local/Users/')).toEqual([]);
    expect(scanner.push('me/a%20b' + end)).toEqual([
      { code: '7', payload: 'file://my-mac.local/Users/me/a%20b' },
    ]);
  });

  it('shares one scanner with status and prompt reports', () => {
    const scanner = new OscScanner();
    expect(scanner.push(
      '\x1b]7;file:///tmp\x07\x1b]7501;state=working\x07\x1b]133;A\x07',
    ).map((sequence) => sequence.code)).toEqual(['7', '7501', '133']);
  });
});
