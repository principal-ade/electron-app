import { stripTsNodeEnv, stripTsNodePreload } from './nodeOptions';

describe('stripTsNodePreload', () => {
  it('removes the ts-node require flag but keeps other options', () => {
    expect(
      stripTsNodePreload('-r ts-node/register --no-warnings --max-old-space-size=8192'),
    ).toBe('--no-warnings --max-old-space-size=8192');
  });

  it('removes the transpile-only require flag', () => {
    expect(stripTsNodePreload('-r ts-node/register/transpile-only')).toBe('');
  });
});

describe('stripTsNodeEnv', () => {
  const poisoned = {
    PATH: '/usr/bin',
    NODE_OPTIONS: '-r ts-node/register --no-warnings',
    TS_NODE_PROJECT: 'tsconfig.node.json',
    TS_NODE_TRANSPILE_ONLY: 'true',
    HOME: '/Users/tester',
  };

  it('drops TS_NODE_* and the ts-node preload', () => {
    const env = stripTsNodeEnv({ ...poisoned });

    expect(env).toEqual({
      PATH: '/usr/bin',
      NODE_OPTIONS: '--no-warnings',
      HOME: '/Users/tester',
    });
  });

  it('removes NODE_OPTIONS entirely when it only held the preload', () => {
    const env = stripTsNodeEnv({
      NODE_OPTIONS: '-r ts-node/register',
      TS_NODE_PROJECT: 'tsconfig.node.json',
    });

    expect(env).toEqual({});
  });

  it('does not mutate the input object', () => {
    const input = { ...poisoned };
    stripTsNodeEnv(input);
    expect(input).toEqual(poisoned);
  });
});
