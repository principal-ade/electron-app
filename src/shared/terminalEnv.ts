import { stripTsNodeEnv } from './nodeOptions';

const APP_ONLY_TERMINAL_ENV_KEYS = new Set([
  'ELECTRON_RUN_AS_NODE',
  'NODE_ENV',
  'NODE_ENV_PACKAGED_SIMULATION',
  'NODE_PATH',
  'USE_PTY_DAEMON',
]);

const SENSITIVE_ENV_KEY =
  /(?:^|_)(?:ACCESS_KEY|API_KEY|AUTH_TOKEN|CREDENTIALS?|PASSWORD|PASSWD|PAT|PRIVATE_KEY|SECRET|TOKEN)(?:_|$)/i;

/**
 * Remove application runtime settings and credential-like values before
 * passing the app's environment to an interactive shell. User shell startup
 * files can still define these values, and explicit per-session overlays are
 * applied after this filter.
 */
export function sanitizeTerminalEnv<T extends Record<string, string | undefined>>(
  env: T,
): T {
  const cleaned = stripTsNodeEnv({ ...env });

  for (const key of Object.keys(cleaned)) {
    if (
      APP_ONLY_TERMINAL_ENV_KEYS.has(key) ||
      key.startsWith('PRINCIPAL_TELEMETRY_') ||
      SENSITIVE_ENV_KEY.test(key)
    ) {
      delete cleaned[key];
    }
  }

  // NODE_OPTIONS may contain app/build-specific preload flags unrelated to
  // ts-node, so don't pass any of it through to user commands.
  delete cleaned.NODE_OPTIONS;

  return cleaned as T;
}
