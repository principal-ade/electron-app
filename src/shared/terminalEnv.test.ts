import { sanitizeTerminalEnv } from './terminalEnv';

describe('sanitizeTerminalEnv', () => {
  it('removes app runtime settings, telemetry settings, and credentials', () => {
    const sanitized = sanitizeTerminalEnv({
      NODE_ENV: 'production',
      NODE_PATH: '/app/native-modules',
      ELECTRON_RUN_AS_NODE: '1',
      PRINCIPAL_TELEMETRY_ENDPOINT: 'https://telemetry.example',
      Z_AI_API_KEY: 'secret',
      GITHUB_TOKEN: 'secret',
      NODE_OPTIONS: '--require app-hook',
      PATH: '/usr/bin',
      SSH_AUTH_SOCK: '/tmp/ssh-agent.sock',
      BUN_INSTALL: '/Users/test/.bun',
    });

    expect(sanitized).toEqual({
      PATH: '/usr/bin',
      SSH_AUTH_SOCK: '/tmp/ssh-agent.sock',
      BUN_INSTALL: '/Users/test/.bun',
    });
  });

  it('also removes ts-node build settings', () => {
    const sanitized = sanitizeTerminalEnv({
      TS_NODE_PROJECT: 'tsconfig.node.json',
      TS_NODE_TRANSPILE_ONLY: 'true',
      NODE_OPTIONS: '-r ts-node/register --trace-warnings',
      OTHER: 'preserved',
    });

    expect(sanitized).toEqual({ OTHER: 'preserved' });
  });
});
