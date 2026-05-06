/**
 * Web-ade integration for File City trail payloads.
 *
 * Owns:
 *   - GitHub origin resolution from the local git remote
 *   - Bake step that inlines diff-snippet `newContents` from disk
 *   - Note stripping (server strips them; client strip avoids posting bytes
 *     that will be discarded)
 *   - HTTPS calls against `/api/trails` (POST share, GET list, GET single)
 *   - Translation of HTTP failures into typed `TrailShareError`s
 *
 * Mirrors `sequenceDiagramShare.ts` 1:1; the only differences are the route
 * path, the marker-walking shape, and the explicit notes strip — see
 * web-ade/docs/file-city-trail-sharing.md for the contract.
 *
 * The store delegates here from its IPC handlers; rendering code never
 * imports this directly.
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
  TrailShareError,
  type FileCityTrailFetchSharedResult,
  type FileCityTrailShareResult,
  type SharedTrailIndexEntry,
  type TrailIndexEntry,
  type TrailListSharedOptions,
  type TrailListSharedResult,
  type TrailShareOptions,
} from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { TrailPayload } from '@industry-theme/file-city-panel';

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
      throw new TrailShareError(
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
    throw new TrailShareError(
      'NO_GITHUB_REMOTE',
      'Could not read git remotes for this repository.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  if (!remotes || remotes.length === 0) {
    throw new TrailShareError(
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
    throw new TrailShareError(
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
    throw new TrailShareError(
      'NO_GITHUB_TOKEN',
      'Sign in to GitHub before sharing.',
    );
  }
  return token;
}

interface BakeResult {
  baked: TrailPayload;
  missing: string[];
}

/**
 * Walk the trail's markers and inline `newContents` for any diff snippet that
 * only carries `oldContents`. The web viewer doesn't have access to the
 * producer's filesystem, so unbaked diff snippets fail validation server-side
 * with `SNIPPET_NOT_BAKED`.
 *
 * Slice snippets need no baking — line numbers index into a content source
 * resolved at view time via the host's `actions.readFile`.
 *
 * If `allowMissing` is false, throws `MISSING_FILES_NEEDS_CONFIRM` listing
 * the markers whose source files couldn't be read. The renderer surfaces a
 * confirm prompt and retries with `allowMissing: true`, in which case this
 * returns the partially-baked payload (the unfilled snippets carry empty
 * `newContents`).
 */
async function bakeSnippets(
  payload: TrailPayload,
  repositoryPath: string,
  options: { allowMissing: boolean },
): Promise<BakeResult> {
  const missing: string[] = [];
  const markers = await Promise.all(
    payload.markers.map(async (m) => {
      const snippet = m.snippet;
      if (!snippet || snippet.kind !== 'diff') return m;
      if (snippet.newContents != null) return m;
      if (!m.sourcePath) {
        missing.push(`${m.id} (no sourcePath)`);
        return options.allowMissing
          ? { ...m, snippet: { ...snippet, newContents: '' } }
          : m;
      }
      const absPath = path.isAbsolute(m.sourcePath)
        ? m.sourcePath
        : path.join(repositoryPath, m.sourcePath);
      try {
        const newContents = await fs.readFile(absPath, 'utf8');
        return { ...m, snippet: { ...snippet, newContents } };
      } catch {
        missing.push(`${m.id} (${m.sourcePath})`);
        return options.allowMissing
          ? { ...m, snippet: { ...snippet, newContents: '' } }
          : m;
      }
    }),
  );
  if (missing.length > 0 && !options.allowMissing) {
    throw new TrailShareError(
      'MISSING_FILES_NEEDS_CONFIRM',
      `${missing.length} diff snippet${missing.length === 1 ? '' : 's'} reference missing files. Confirm to share with empty new contents for those markers.`,
      { missing },
    );
  }
  return { baked: { ...payload, markers }, missing };
}

/**
 * Strip `notes` before posting. The server-side validator drops the field
 * unconditionally; stripping client-side avoids serializing bytes that will
 * be discarded and surfaces the rule clearly in the bridge code.
 */
function stripNotes(payload: TrailPayload): TrailPayload {
  if (!payload.notes) return payload;
  const { notes: _notes, ...rest } = payload;
  return rest as TrailPayload;
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

function shareErrorFromResponse(
  res: import('node-fetch').Response,
  body: WebAdeErrorBody,
  context: string,
): TrailShareError {
  const message =
    body.error || `Web-ade ${context} failed with status ${res.status}`;
  if (res.status === 403 || body.code === 'NO_REPO_ACCESS') {
    return new TrailShareError('NO_REPO_ACCESS', message);
  }
  if (res.status === 404 || body.code === 'NOT_FOUND') {
    return new TrailShareError('SHARE_NOT_FOUND', message);
  }
  if (body.code === 'SNIPPET_NOT_BAKED') {
    return new TrailShareError('SNIPPET_NOT_BAKED', message);
  }
  if (body.code === 'NOT_AUTHENTICATED') {
    return new TrailShareError('NO_GITHUB_TOKEN', message);
  }
  if (body.code === 'PAYLOAD_TOO_LARGE') {
    return new TrailShareError('PAYLOAD_TOO_LARGE', message);
  }
  return new TrailShareError('WEB_ADE_ERROR', message, {
    status: res.status,
    code: body.code,
  });
}

async function postToWebAde(
  owner: string,
  repo: string,
  payload: TrailPayload,
  token: string,
): Promise<FileCityTrailShareResult> {
  const url = `${apiBase()}/trails`;
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
    throw new TrailShareError(
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
    entry: SharedTrailIndexEntry;
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
): Promise<SharedTrailIndexEntry[]> {
  const url = `${apiBase()}/trails/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  let res: import('node-fetch').Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new TrailShareError(
      'NETWORK_ERROR',
      'Could not reach web-ade to list shared trails.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  if (res.status === 404) {
    // No index yet for this repo — empty list, not an error.
    return [];
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw shareErrorFromResponse(res, body, 'list');
  }
  const json = (await res.json()) as { entries: SharedTrailIndexEntry[] };
  return json.entries ?? [];
}

async function fetchFromWebAde(
  owner: string,
  repo: string,
  id: string,
  token: string,
): Promise<FileCityTrailFetchSharedResult> {
  if (!validSlug(owner) || !validSlug(repo)) {
    throw new TrailShareError(
      'WEB_ADE_ERROR',
      'owner/repo failed validation.',
    );
  }
  const url = `${apiBase()}/trails/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(id)}`;
  let res: import('node-fetch').Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new TrailShareError(
      'NETWORK_ERROR',
      'Could not reach web-ade to fetch the shared trail.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw shareErrorFromResponse(res, body, 'fetch');
  }
  return (await res.json()) as FileCityTrailFetchSharedResult;
}

export interface ShareDeps {
  loadPayload: (id: string) => Promise<TrailPayload | null>;
  /**
   * Resolve the host-private `repositoryPath` for a trail. Trails don't carry
   * filesystem paths on the portable schema, so the share step asks the
   * persistence layer for it via the index entry.
   */
  loadEntry: (id: string) => Promise<TrailIndexEntry | null>;
}

export async function shareTrail(
  deps: ShareDeps,
  id: string,
  options: TrailShareOptions = {},
): Promise<FileCityTrailShareResult> {
  const payload = await deps.loadPayload(id);
  if (!payload) {
    throw new TrailShareError(
      'PAYLOAD_NOT_FOUND',
      `No saved trail with id ${id}.`,
    );
  }
  const entry = await deps.loadEntry(id);
  const repositoryPath = options.repositoryPath ?? entry?.repositoryPath;
  if (!repositoryPath) {
    throw new TrailShareError(
      'NO_GITHUB_REMOTE',
      'This trail is not associated with a repository, so it has no GitHub remote to share against.',
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
  const stripped = stripNotes(baked.baked);

  const serialized = JSON.stringify(stripped);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    const mb = (Buffer.byteLength(serialized, 'utf8') / (1024 * 1024)).toFixed(1);
    throw new TrailShareError(
      'PAYLOAD_TOO_LARGE',
      `This trail is ${mb} MB after baking — the share size cap is 10 MB.`,
    );
  }

  return postToWebAde(origin.owner, origin.repo, stripped, token);
}

export async function listSharedTrails(
  options: TrailListSharedOptions = {},
): Promise<TrailListSharedResult> {
  let owner = options.owner;
  let repo = options.repo;
  if (!owner || !repo) {
    if (!options.repositoryPath) {
      throw new TrailShareError(
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

export async function fetchSharedTrail(
  owner: string,
  repo: string,
  id: string,
): Promise<FileCityTrailFetchSharedResult> {
  const token = await getGithubToken();
  return fetchFromWebAde(owner, repo, id, token);
}
