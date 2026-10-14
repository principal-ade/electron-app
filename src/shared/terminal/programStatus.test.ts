import {
  OscScanner,
  ProgramStatusRegistry,
  parseProgramStatusPayload,
  PROGRAM_STATUS_FEATURE_DETECTION_REPLY,
} from './programStatus';

const ST = '\x1b\\';
const BEL = '\x07';
const enc = (s: string): string => Buffer.from(s, 'utf-8').toString('base64');

describe('OscScanner', () => {
  it('extracts a 7501 sequence terminated by ST', () => {
    const scanner = new OscScanner();
    const seqs = scanner.push(`\x1b]7501;state=working:app=brew${ST}`);
    expect(seqs).toEqual([{ code: '7501', payload: 'state=working:app=brew' }]);
  });

  it('extracts a 7501 sequence terminated by BEL', () => {
    const scanner = new OscScanner();
    const seqs = scanner.push(`\x1b]7501;state=done${BEL}`);
    expect(seqs).toEqual([{ code: '7501', payload: 'state=done' }]);
  });

  it('reassembles a sequence split across chunks', () => {
    const scanner = new OscScanner();
    expect(scanner.push('\x1b]7501;sta')).toEqual([]);
    expect(scanner.push('te=blocked:kind=auth')).toEqual([]);
    const seqs = scanner.push(ST);
    expect(seqs).toEqual([
      { code: '7501', payload: 'state=blocked:kind=auth' },
    ]);
  });

  it('preserves a trailing lone ESC between chunks', () => {
    const scanner = new OscScanner();
    expect(scanner.push('output\x1b')).toEqual([]);
    const seqs = scanner.push(']7501;state=done' + BEL);
    expect(seqs).toEqual([{ code: '7501', payload: 'state=done' }]);
  });

  it('extracts OSC 133 A (shell prompt)', () => {
    const scanner = new OscScanner();
    const seqs = scanner.push(`\x1b]133;A${BEL}`);
    expect(seqs).toEqual([{ code: '133', payload: 'A' }]);
  });

  it('passes through normal output untouched', () => {
    const scanner = new OscScanner();
    expect(scanner.push('hello world\r\n')).toEqual([]);
  });

  it('drops an oversized unterminated sequence', () => {
    const scanner = new OscScanner();
    scanner.push('\x1b]7501;' + 'x'.repeat(5000));
    // A following valid sequence is still parsed.
    const seqs = scanner.push(`${BEL}\x1b]7501;state=done${BEL}`);
    expect(seqs).toEqual([{ code: '7501', payload: 'state=done' }]);
  });
});

describe('parseProgramStatusPayload', () => {
  it('parses working with app and progress', () => {
    expect(
      parseProgramStatusPayload('state=working:app=brew:progress=40'),
    ).toEqual({ state: 'working', app: 'brew', progress: 40 });
  });

  it('parses blocked with kind and decoded msg', () => {
    const record = parseProgramStatusPayload(
      `state=blocked:kind=permission:app=terraform:msg=${enc('Apply 3 to add?')}`,
    );
    expect(record).toEqual({
      state: 'blocked',
      kind: 'permission',
      app: 'terraform',
      msg: 'Apply 3 to add?',
    });
  });

  it('detects a feature-detection query', () => {
    expect(parseProgramStatusPayload('?')).toBe('query');
  });

  it('returns a clear directive', () => {
    expect(parseProgramStatusPayload('state=clear:id=us-east')).toEqual({
      id: 'us-east',
      state: 'clear',
    });
  });

  it('ignores a report with a missing or unknown state', () => {
    expect(parseProgramStatusPayload('app=brew')).toBeNull();
    expect(parseProgramStatusPayload('state=bogus')).toBeNull();
  });

  it('ignores a report with a malformed id', () => {
    // Value chars are valid, but the id grammar (empty segment) is not.
    expect(parseProgramStatusPayload('state=working:id=a//b')).toBeNull();
  });

  it('discards the whole report when msg contains a control character', () => {
    expect(
      parseProgramStatusPayload(`state=done:msg=${enc('line\nbreak')}`),
    ).toBeNull();
  });

  it('discards the whole report when msg is not valid base64', () => {
    // 'a' is a valid value char but an invalid base64 length (mod 4 == 1).
    expect(parseProgramStatusPayload('state=done:msg=a')).toBeNull();
  });

  it('enforces the msg encoded-size limit', () => {
    const tooLong = 'A'.repeat(2733);
    expect(parseProgramStatusPayload(`state=done:msg=${tooLong}`)).toBeNull();
  });

  it('ignores kind/progress when not applicable, and keeps last value', () => {
    // progress only applies to working/blocked; kind only to blocked.
    expect(parseProgramStatusPayload('state=done:progress=10:kind=auth')).toEqual(
      { state: 'done' },
    );
    // repeated key: last wins
    expect(parseProgramStatusPayload('state=working:app=a:app=b')).toEqual({
      state: 'working',
      app: 'b',
    });
  });

  it('skips malformed pairs but processes the rest', () => {
    expect(parseProgramStatusPayload('state=working:broken:app=brew')).toEqual({
      state: 'working',
      app: 'brew',
    });
  });

  it('exposes a feature-detection reply that contains no report data', () => {
    expect(PROGRAM_STATUS_FEATURE_DETECTION_REPLY.startsWith('\x1b]7501;?')).toBe(
      true,
    );
  });
});

describe('ProgramStatusRegistry', () => {
  it('stores and replaces records by id (root when absent)', () => {
    const registry = new ProgramStatusRegistry();
    registry.applyReport({ state: 'working', app: 'brew' });
    registry.applyReport({ state: 'done', app: 'brew' });
    expect(registry.list()).toEqual([{ state: 'done', app: 'brew' }]);
  });

  it('keeps sibling records independent', () => {
    const registry = new ProgramStatusRegistry();
    registry.applyReport({ state: 'working', app: 'deploy' });
    registry.applyReport({ state: 'blocked', kind: 'question', id: 'eu-west' });
    registry.applyReport({ state: 'done', id: 'us-east' });
    const byId = Object.fromEntries(registry.list().map((r) => [r.id ?? '', r.state]));
    expect(byId).toEqual({ '': 'working', 'eu-west': 'blocked', 'us-east': 'done' });
  });

  it('clear removes a record and its descendants', () => {
    const registry = new ProgramStatusRegistry();
    registry.applyReport({ state: 'working', id: 'build' });
    registry.applyReport({ state: 'working', id: 'build/test' });
    registry.applyReport({ state: 'done', id: 'other' });
    registry.applyReport({ id: 'build', state: 'clear' });
    expect(registry.list().map((r) => r.id).sort()).toEqual(['other']);
  });

  it('dropTransient keeps done/error and removes working/blocked/idle', () => {
    const registry = new ProgramStatusRegistry();
    registry.applyReport({ state: 'working', id: 'a' });
    registry.applyReport({ state: 'blocked', kind: 'auth', id: 'b' });
    registry.applyReport({ state: 'done', id: 'c' });
    registry.applyReport({ state: 'error', id: 'd' });
    registry.dropTransient();
    expect(registry.list().map((r) => r.id).sort()).toEqual(['c', 'd']);
  });

  it('resolves app from the nearest ancestor', () => {
    const registry = new ProgramStatusRegistry();
    registry.applyReport({ state: 'working', app: 'deploy' });
    registry.applyReport({ state: 'working', id: 'us-east', progress: 40 });
    const child = registry.list().find((r) => r.id === 'us-east');
    expect(child?.app).toBe('deploy');
  });

  it('evicts the least-recently-updated record past the cap', () => {
    const registry = new ProgramStatusRegistry();
    for (let i = 0; i < 300; i++) {
      registry.applyReport({ state: 'done', id: `r${i}` });
    }
    expect(registry.size).toBe(256);
    expect(registry.list().some((r) => r.id === 'r0')).toBe(false);
    expect(registry.list().some((r) => r.id === 'r299')).toBe(true);
  });
});
