import type { LocalhostBrowserTarget } from '../../shared/main-process-api-interfaces/BrowserAPI';
import type { ProcessEntry } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

import {
  BrowserTargetError,
  hasUnsafeCharacters,
  parseLocalhostBrowserUrl,
} from '../../shared/utils/localhostBrowserUrl';

export {
  BrowserTargetError,
  parseLocalhostBrowserUrl,
} from '../../shared/utils/localhostBrowserUrl';

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
