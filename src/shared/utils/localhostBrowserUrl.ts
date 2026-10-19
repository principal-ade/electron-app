import type { LocalhostBrowserTarget } from '../main-process-api-interfaces/BrowserAPI';

export class BrowserTargetError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function hasUnsafeCharacters(value: string): boolean {
  return (
    /[\s\\]/.test(value) ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

export function parseLocalhostBrowserUrl(
  value: unknown,
): LocalhostBrowserTarget {
  // Inspect the authority before URL normalization (which drops explicit :80).
  const match =
    typeof value === 'string'
      ? /^http:\/\/localhost:(\d{1,5})(?=\/|\?|#|$)/i.exec(value)
      : null;
  if (!match || hasUnsafeCharacters(value as string)) {
    throw new BrowserTargetError(
      'url must be http://localhost:<port> with no credentials',
    );
  }
  const port = Number(match[1]);
  if (port < 1 || port > 65535) {
    throw new BrowserTargetError('port must be between 1 and 65535');
  }
  const url = new URL(value as string);
  return { port, path: `${url.pathname}${url.search}${url.hash}` };
}
