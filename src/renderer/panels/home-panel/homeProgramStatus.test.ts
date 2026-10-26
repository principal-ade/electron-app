import { toHomeProgramStatus } from './homeProgramStatus';

jest.mock('@industry-theme/xterm-terminal-panel', () => ({
  tabIdFromContext: (scope: string, context?: string) => {
    const prefix = `${scope}:`;
    return context?.startsWith(prefix)
      ? context.slice(prefix.length) || null
      : null;
  },
}));

test('keeps two terminals in the same directory independent by tab identity', () => {
  const working = { state: 'working' as const };
  const blocked = { state: 'blocked' as const, kind: 'permission' as const };
  expect(
    toHomeProgramStatus(
      [
        { id: 's1', context: 'workspace:tab-one' },
        { id: 's2', context: 'workspace:tab-two' },
      ],
      'workspace',
      { s1: working, s2: blocked },
    ),
  ).toEqual({
    'tab-one': working,
    'tab-two': blocked,
  });
});

test('matches restored and foreign tab ids using the terminal panel convention', () => {
  expect(
    toHomeProgramStatus(
      [
        { id: 'old', context: 'workspace' },
        { id: 'other', context: 'another-window:tab-one' },
        { id: 'no-context' },
      ],
      'workspace',
      {
        old: { state: 'done' },
        other: { state: 'error' },
        'no-context': { state: 'working' },
      },
    ),
  ).toEqual({
    'tab-restored-old': { state: 'done' },
    'tab-foreign-other': { state: 'error' },
    'tab-foreign-no-context': { state: 'working' },
  });
});

test('does not keep badges for sessions that disappeared or lack a status', () => {
  expect(
    toHomeProgramStatus(
      [{ id: 'live', context: 'workspace:tab-live' }],
      'workspace',
      { gone: { state: 'working' } },
    ),
  ).toEqual({});
});

test('replaces a tab status when its terminal session is recreated', () => {
  expect(
    toHomeProgramStatus(
      [{ id: 'new', context: 'workspace:tab-one' }],
      'workspace',
      {
        old: { state: 'blocked' },
        new: { state: 'idle' },
      },
    ),
  ).toEqual({ 'tab-one': { state: 'idle' } });
});
