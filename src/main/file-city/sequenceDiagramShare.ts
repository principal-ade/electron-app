/**
 * Web-ade integration for File City sequence-diagram payloads.
 *
 * Owns:
 *   - GitHub origin resolution from the local git remote
 *   - Bake step that inlines diff-snippet `newContents` from disk
 *   - HTTPS calls against `/api/sequence-diagrams` (POST share, GET list,
 *     GET single)
 *   - Translation of HTTP failures into typed `SequenceDiagramShareError`s
 *
 * The store delegates here from its IPC handlers; rendering code never
 * imports this directly.
 *
 * Token + base-URL conventions mirror `WebAdeService` and
 * `gitRepositoryService.pushLineCountsToWebCache` so the desktop's
 * GitHub auth posture stays consistent across web-ade integrations.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import { gitClientFactory } from '../utils/gitClientFactory';
import {
  TOKEN_KEYS,
  UnifiedSecureStorage,
} from '../services/UnifiedSecureStorage';
import {
  SequenceDiagramShareError,
  type FileCitySequenceFetchSharedResult,
  type FileCitySequenceShareResult,
  type SequenceDiagramListSharedOptions,
  type SequenceDiagramListSharedResult,
  type SequenceDiagramPayload,
  type SequenceDiagramShareOptions,
  type SharedSequenceDiagramIndexEntry,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const SLUG_REGEX = /^[A-Za-z0-9._-]+$/;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;
const GITHUB_REMOTE_REGEX = /github\.com[:/]([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/i;

const apiBase = (): string =>
  process.env.WEB_ADE_API_URL || 'https://app.principal-ade.com/api';

const webBase = (): string => apiBase().replace(/\/api\/?$/, '');

const absoluteShareUrl = (relativeOrAbsolute: string): string => {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  const base = webBase();
  return `${base}${relativeOrAbsolute.startsWith('/') ? '' : '/'}${relativeOrAbsolute}`;
};

const validSlug = (value: string | undefined): value is string =>
  typeof value === 'string' && SLUG_REGEX.test(value);

interface ResolvedOrigin {
  owner: string;
  repo: string;
}

async function resolveGithubOrigin(
  repositoryPath: string,
  override?: { owner?: string; repo?: string },
): Promise<ResolvedOrigin> {
  if (override?.owner && override?.repo) {
    if (!validSlug(override.owner) || !validSlug(override.repo)) {
      throw new SequenceDiagramShareError(
        'NO_GITHUB_REMOTE',
        'Provided owner/repo failed validation. Expected GitHub-style slug characters.',
      );
    }
    return { owner: override.owner, repo: override.repo };
  }

  let remotes: Awaited<ReturnType<typeof gitClientFactory.getRemotes>>;
  try {
    remotes = await gitClientFactory.getRemotes(repositoryPath);
  } catch (err) {
    throw new SequenceDiagramShareError(
      'NO_GITHUB_REMOTE',
      'Could not read git remotes for this repository.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  if (!remotes || remotes.length === 0) {
    throw new SequenceDiagramShareError(
      'NO_GITHUB_REMOTE',
      'Sharing requires a GitHub remote on this repo.',
    );
  }

  const candidates: ResolvedOrigin[] = [];
  const ordered = remotes.slice().sort((a, b) => {
    if (a.name === 'origin') return -1;
    if (b.name === 'origin') return 1;
    return 0;
  });
  for (const remote of ordered) {
    const remoteOwner = remote.owner;
    const remoteRepo = remote.repo;
    if (validSlug(remoteOwner) && validSlug(remoteRepo)) {
      candidates.push({ owner: remoteOwner, repo: remoteRepo });
      continue;
    }
    const match = remote.url?.match(GITHUB_REMOTE_REGEX);
    if (match) {
      candidates.push({ owner: match[1], repo: match[2] });
    }
  }

  if (candidates.length === 0) {
    throw new SequenceDiagramShareError(
      'NO_GITHUB_REMOTE',
      'Sharing requires a GitHub remote on this repo.',
    );
  }
  return candidates[0];
}

async function getGithubToken(): Promise<string> {
  const storage = UnifiedSecureStorage.getInstance();
  const tokenData = await storage.getTokenWithMetadata(TOKEN_KEYS.GITHUB_TOKEN);
  const token = tokenData?.token;
  if (!token) {
    throw new SequenceDiagramShareError(
      'NO_GITHUB_TOKEN',
      'Sign in to GitHub before sharing.',
    );
  }
  return token;
}

interface BakeResult {
  baked: SequenceDiagramPayload;
  missing: string[];
}

/**
 * Walk the payload and inline `newContents` for any diff snippet that only
 * carries `oldContents`. The web viewer doesn't have access to the producer's
 * filesystem, so unbaked diff snippets fail validation server-side.
 *
 * If `allowMissing` is false, throws `MISSING_FILES_NEEDS_CONFIRM` listing
 * the events whose source files couldn't be read. The renderer surfaces a
 * confirm prompt and retries with `allowMissing: true`, in which case this
 * returns the partially-baked payload (the unfilled snippets carry empty
 * `newContents`, which the web-ade validator accepts).
 */
async function bakeSnippets(
  payload: SequenceDiagramPayload,
  repositoryPath: string,
  options: { allowMissing: boolean },
): Promise<BakeResult> {
  const missing: string[] = [];
  const events = await Promise.all(
    payload.events.map(async (ev) => {
      const snippet = ev.snippet;
      if (!snippet || snippet.kind !== 'diff') return ev;
      if (snippet.newContents != null) return ev;
      if (!ev.sourcePath) {
        missing.push(`${ev.id} (no sourcePath)`);
        return options.allowMissing
          ? { ...ev, snippet: { ...snippet, newContents: '' } }
          : ev;
      }
      const absPath = path.isAbsolute(ev.sourcePath)
        ? ev.sourcePath
        : path.join(repositoryPath, ev.sourcePath);
      try {
        const newContents = await fs.readFile(absPath, 'utf8');
        return { ...ev, snippet: { ...snippet, newContents } };
      } catch {
        missing.push(`${ev.id} (${ev.sourcePath})`);
        return options.allowMissing
          ? { ...ev, snippet: { ...snippet, newContents: '' } }
          : ev;
      }
    }),
  );
  if (missing.length > 0 && !options.allowMissing) {
    throw new SequenceDiagramShareError(
      'MISSING_FILES_NEEDS_CONFIRM',
      `${missing.length} diff snippet${missing.length === 1 ? '' : 's'} reference missing files. Confirm to share with empty new contents for those events.`,
      { missing },
    );
  }
  return { baked: { ...payload, events }, missing };
}

interface WebAdeErrorBody {
  error?: string;
  code?: string;
}

async function readErrorBody(res: import('node-fetch').Response): Promise<WebAdeErrorBody> {
  try {
    const body = (await res.json()) as WebAdeErrorBody;
    return body ?? {};
  } catch {
    return {};
  }
}

/**
 * Map a web-ade error response to a typed SequenceDiagramShareError. Falls
 * back to generic WEB_ADE_ERROR / NETWORK_ERROR when the response/code shape
 * isn't one we recognize.
 */
function shareErrorFromResponse(
  res: import('node-fetch').Response,
  body: WebAdeErrorBody,
  context: string,
): SequenceDiagramShareError {
  const message =
    body.error || `Web-ade ${context} failed with status ${res.status}`;
  if (res.status === 403 || body.code === 'NO_REPO_ACCESS') {
    return new SequenceDiagramShareError('NO_REPO_ACCESS', message);
  }
  if (res.status === 404) {
    return new SequenceDiagramShareError('SHARE_NOT_FOUND', message);
  }
  if (body.code === 'SNIPPET_NOT_BAKED') {
    return new SequenceDiagramShareError('SNIPPET_NOT_BAKED', message);
  }
  return new SequenceDiagramShareError('WEB_ADE_ERROR', message, {
    status: res.status,
    code: body.code,
  });
}

async function postToWebAde(
  owner: string,
  repo: string,
  payload: SequenceDiagramPayload,
  token: string,
): Promise<FileCitySequenceShareResult> {
  const url = `${apiBase()}/sequence-diagrams`;
  let res: import('node-fetch').Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ owner, repo, payload }),
    });
  } catch (err) {
    throw new SequenceDiagramShareError(
      'NETWORK_ERROR',
      'Could not reach web-ade to publish the share.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw shareErrorFromResponse(res, body, 'share');
  }

  const json = (await res.json()) as {
    id: string;
    url: string;
    entry: SharedSequenceDiagramIndexEntry;
  };
  return {
    id: json.id,
    url: absoluteShareUrl(json.url),
    entry: json.entry,
  };
}

async function listFromWebAde(
  owner: string,
  repo: string,
  token: string,
): Promise<SharedSequenceDiagramIndexEntry[]> {
  const url = `${apiBase()}/sequence-diagrams/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  let res: import('node-fetch').Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new SequenceDiagramShareError(
      'NETWORK_ERROR',
      'Could not reach web-ade to list shared diagrams.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  if (res.status === 404) {
    // Treat "no index yet for this repo" as an empty list rather than an error,
    // so the panel renders a clean "No shares yet" state instead of a banner.
    return [];
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw shareErrorFromResponse(res, body, 'list');
  }
  const json = (await res.json()) as {
    entries: SharedSequenceDiagramIndexEntry[];
  };
  return json.entries ?? [];
}

async function fetchFromWebAde(
  owner: string,
  repo: string,
  id: string,
  token: string,
): Promise<FileCitySequenceFetchSharedResult> {
  if (!validSlug(owner) || !validSlug(repo)) {
    throw new SequenceDiagramShareError(
      'WEB_ADE_ERROR',
      'owner/repo failed validation.',
    );
  }
  const url = `${apiBase()}/sequence-diagrams/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(id)}`;
  let res: import('node-fetch').Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new SequenceDiagramShareError(
      'NETWORK_ERROR',
      'Could not reach web-ade to fetch the shared diagram.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw shareErrorFromResponse(res, body, 'fetch');
  }
  return (await res.json()) as FileCitySequenceFetchSharedResult;
}

export interface ShareDeps {
  loadPayload: (id: string) => Promise<SequenceDiagramPayload | null>;
}

export async function shareSequenceDiagram(
  deps: ShareDeps,
  id: string,
  options: SequenceDiagramShareOptions = {},
): Promise<FileCitySequenceShareResult> {
  const payload = await deps.loadPayload(id);
  if (!payload) {
    throw new SequenceDiagramShareError(
      'PAYLOAD_NOT_FOUND',
      `No saved sequence diagram with id ${id}.`,
    );
  }
  const repositoryPath = options.repositoryPath ?? payload.repositoryPath;
  if (!repositoryPath) {
    throw new SequenceDiagramShareError(
      'NO_GITHUB_REMOTE',
      'This payload is not associated with a repository, so it has no GitHub remote to share against.',
    );
  }

  const origin = await resolveGithubOrigin(repositoryPath, {
    owner: options.owner,
    repo: options.repo,
  });
  const token = await getGithubToken();
  const baked = await bakeSnippets(payload, repositoryPath, {
    allowMissing: options.allowMissing === true,
  });

  const serialized = JSON.stringify(baked.baked);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    const mb = (Buffer.byteLength(serialized, 'utf8') / (1024 * 1024)).toFixed(1);
    throw new SequenceDiagramShareError(
      'PAYLOAD_TOO_LARGE',
      `This walkthrough is ${mb} MB after baking — the share size cap is 10 MB.`,
    );
  }

  return postToWebAde(origin.owner, origin.repo, baked.baked, token);
}

export async function listSharedSequenceDiagrams(
  options: SequenceDiagramListSharedOptions = {},
): Promise<SequenceDiagramListSharedResult> {
  let owner = options.owner;
  let repo = options.repo;
  if (!owner || !repo) {
    if (!options.repositoryPath) {
      throw new SequenceDiagramShareError(
        'NO_GITHUB_REMOTE',
        'Listing shares requires a repositoryPath when owner/repo are not supplied.',
      );
    }
    const origin = await resolveGithubOrigin(options.repositoryPath, {
      owner,
      repo,
    });
    owner = origin.owner;
    repo = origin.repo;
  }
  const token = await getGithubToken();
  const entries = await listFromWebAde(owner, repo, token);
  return { origin: { owner, repo }, entries };
}

export async function fetchSharedSequenceDiagram(
  owner: string,
  repo: string,
  id: string,
): Promise<FileCitySequenceFetchSharedResult> {
  const token = await getGithubToken();
  return fetchFromWebAde(owner, repo, id, token);
}
