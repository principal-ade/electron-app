import { sanitizeBuildOutput, tailBuildOutput } from './buildRunOutput';

describe('build run output formatting', () => {
  test('strips terminal control sequences and redacts secret values', () => {
    expect(
      sanitizeBuildOutput('\u001b[31mfailed: long-secret\u001b[0m\r\n', [
        'secret',
        'long-secret',
      ]),
    ).toBe('failed: [REDACTED]\n');
  });

  test('returns a UTF-8-safe bounded tail', () => {
    expect(tailBuildOutput('a🙂b', 5)).toEqual({
      output: '🙂b',
      bytesReturned: 5,
      truncated: true,
    });
  });

  test('reports an untruncated output as-is', () => {
    expect(tailBuildOutput('short', 20)).toEqual({
      output: 'short',
      bytesReturned: 5,
      truncated: false,
    });
  });
});
