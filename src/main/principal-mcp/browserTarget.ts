import type { LocalhostBrowserTarget } from '../../shared/main-process-api-interfaces/BrowserAPI';
import type { ProcessEntry } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

export class BrowserTargetError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

function hasUnsafeCharacters(value: string): boolean {
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

export function resolveBrowserTarget(
  body: unknown,
  processes: ProcessEntry[],
): LocalhostBrowserTarget {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BrowserTargetError('a request body is required');
  }
  const request = body as Record<string, unknown>;
  if ((request.processId !== undefined) === (request.url !== undefined)) {
    throw new BrowserTargetError('provide exactly one of processId or url');
  }
  if (request.label !== undefined && typeof request.label !== 'string') {
    throw new BrowserTargetError('label must be a string');
  }
  let target: LocalhostBrowserTarget;
  let entry: ProcessEntry | undefined;
  if (request.processId !== undefined) {
    if (typeof request.processId !== 'string' || !request.processId) {
      throw new BrowserTargetError('processId must be a non-empty string');
    }
    entry = processes.find(
      (p) => p.id === request.processId && p.origin === 'managed',
    );
    if (!entry) throw new BrowserTargetError('unknown managed process id', 404);
    if (entry.status !== 'running' || entry.port == null) {
      throw new BrowserTargetError(
        'process is not running with a known port',
        409,
      );
    }
    const path = request.path ?? '/';
    if (
      typeof path !== 'string' ||
      !path.startsWith('/') ||
      path.startsWith('//') ||
      hasUnsafeCharacters(path)
    ) {
      throw new BrowserTargetError(
        'path must start with / and contain no whitespace or backslashes',
      );
    }
    target = parseLocalhostBrowserUrl(`http://localhost:${entry.port}${path}`);
  } else {
    if (request.path !== undefined) {
      throw new BrowserTargetError(
        'include the path in url when opening by URL',
      );
    }
    target = parseLocalhostBrowserUrl(request.url);
    const matches = processes.filter(
      (p) =>
        p.origin === 'managed' &&
        p.status === 'running' &&
        p.port === target.port,
    );
    if (matches.length === 1) [entry] = matches;
  }
  return {
    ...target,
    processId: entry?.id,
    label: (request.label as string | undefined)?.trim() || entry?.label,
  };
}
