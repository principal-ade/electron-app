/**
 * Web-ade integration for published topics.
 *
 * Sibling of `file-city/trailShare.ts`, scoped to topics. Owns the HTTPS calls
 * against `/api/topics` (publish), `/api/topics/by-id/{id}` (read + edit), and
 * its `/trails` sub-routes (add/remove/reorder membership), translating HTTP
 * failures into the same typed `TrailShareError` the renderer already
 * discriminates on for shared trails (topics publish to the same registry, so
 * the error surface is shared rather than duplicated).
 *
 * Read (`fetchSharedTopicById`) is public-by-link, so its token is attached
 * opportunistically — present, it lets the server compute the per-user
 * `starred` flag; absent, the topic still resolves. Every other call is
 * owner-gated, so it requires a token.
 *
 * Once a topic carries a `remoteId`, web-ade is the source of truth: edits
 * write through these functions first and the local copy is reconciled from
 * the response. See `TopicRegistryService` for that gate.
 *
 * The TIPC router and registry delegate here; rendering code never imports
 * this directly.
 */

import fetch from 'node-fetch';
import type {
  DraftTopic as Topic,
  TopicStatus,
} from '@principal-ai/principal-view-core';
import {
  TOKEN_KEYS,
  UnifiedSecureStorage,
} from '../services/UnifiedSecureStorage';
import { TrailShareError } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { FetchSharedTopicResult } from '../../shared/main-process-api-interfaces/TopicAPI';

const apiBase = (): string =>
  process.env.WEB_ADE_API_URL || 'https://app.principal-ade.com/api';

const webBase = (): string => apiBase().replace(/\/api\/?$/, '');

const absoluteUrl = (relativeOrAbsolute: string): string => {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  const base = webBase();
  return `${base}${relativeOrAbsolute.startsWith('/') ? '' : '/'}${relativeOrAbsolute}`;
};

/**
 * Topics resolve without auth, so this returns `null` rather than throwing
 * when the user is signed out — read calls still succeed, just without the
 * per-user `starred` flag.
 */
async function getOptionalGithubToken(): Promise<string | null> {
  const storage = UnifiedSecureStorage.getInstance();
  const tokenData = await storage.getTokenWithMetadata(TOKEN_KEYS.GITHUB_TOKEN);
  return tokenData?.token ?? null;
}

/** Owner-gated calls (publish/edit) need a token; absent, fail fast. */
async function getRequiredGithubToken(): Promise<string> {
  const token = await getOptionalGithubToken();
  if (!token) {
    throw new TrailShareError(
      'NO_GITHUB_TOKEN',
      'Sign in to GitHub before sharing a topic.',
    );
  }
  return token;
}

interface WebAdeErrorBody {
  error?: string;
  code?: string;
}

async function readErrorBody(
  res: import('node-fetch').Response,
): Promise<WebAdeErrorBody> {
  try {
    const body = (await res.json()) as WebAdeErrorBody;
    return body ?? {};
  } catch {
    return {};
  }
}

/**
 * Map a topic-route error response onto the shared `TrailShareError` codes.
 * `TRAIL_NOT_FOUND` (a topic referencing an unshared trail) collapses to
 * `SHARE_NOT_FOUND` — the server's message carries the specific trail, so the
 * code stays coarse while the text stays actionable.
 */
function topicShareError(
  res: import('node-fetch').Response,
  body: WebAdeErrorBody,
  context: string,
): TrailShareError {
  const message =
    body.error || `Web-ade topic ${context} failed with status ${res.status}`;
  if (res.status === 401 || body.code === 'NOT_AUTHENTICATED') {
    return new TrailShareError('NO_GITHUB_TOKEN', message);
  }
  if (
    res.status === 403 ||
    body.code === 'NOT_OWNER' ||
    body.code === 'NO_REPO_ACCESS'
  ) {
    return new TrailShareError('NO_REPO_ACCESS', message);
  }
  if (
    res.status === 404 ||
    body.code === 'NOT_FOUND' ||
    body.code === 'TRAIL_NOT_FOUND'
  ) {
    return new TrailShareError('SHARE_NOT_FOUND', message);
  }
  if (body.code === 'INVALID_PAYLOAD' || body.code === 'INVALID_REQUEST') {
    return new TrailShareError('INVALID_PAYLOAD', message);
  }
  return new TrailShareError('WEB_ADE_ERROR', message, {
    status: res.status,
    code: body.code,
  });
}

/**
 * Shared request helper for the owner-gated topic calls: attaches the bearer
 * token, JSON-encodes the body when present, and maps non-2xx responses to a
 * `TrailShareError`. `context` is the verb phrase used in error messages
 * (e.g. "publish", "update", "add a trail to").
 */
async function topicRequest<T>(
  method: string,
  path: string,
  context: string,
  body?: unknown,
): Promise<T> {
  const token = await getRequiredGithubToken();
  const url = `${apiBase()}${path}`;
  let res: import('node-fetch').Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new TrailShareError(
      'NETWORK_ERROR',
      `Could not reach web-ade to ${context} the topic.`,
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }
  if (!res.ok) {
    const errBody = await readErrorBody(res);
    throw topicShareError(res, errBody, context);
  }
  return (await res.json()) as T;
}

export async function fetchSharedTopicById(
  id: string,
): Promise<FetchSharedTopicResult> {
  const token = await getOptionalGithubToken();
  const url = `${apiBase()}/topics/by-id/${encodeURIComponent(id)}`;
  let res: import('node-fetch').Response;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    throw new TrailShareError(
      'NETWORK_ERROR',
      'Could not reach web-ade to fetch the topic.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    const message =
      body.error || `Web-ade topic fetch failed with status ${res.status}`;
    if (res.status === 404 || body.code === 'NOT_FOUND') {
      throw new TrailShareError('SHARE_NOT_FOUND', message);
    }
    if (res.status === 403 || body.code === 'NO_REPO_ACCESS') {
      throw new TrailShareError('NO_REPO_ACCESS', message);
    }
    throw new TrailShareError('WEB_ADE_ERROR', message, {
      status: res.status,
      code: body.code,
    });
  }

  return (await res.json()) as FetchSharedTopicResult;
}

/** Result of publishing a topic — the server-assigned id, its public URL, and
 *  the canonical record the server stored. */
export interface PublishedTopic {
  id: string;
  url: string;
  topic: Topic;
}

/**
 * Publish a topic to web-ade. The server mints its own id and gates the
 * referenced `trailIds` — every one must already be a shared trail, or the
 * call fails with a `SHARE_NOT_FOUND` naming the offending trail.
 */
export async function publishTopicToWebAde(input: {
  title: string;
  description?: string;
  trailIds: string[];
  status?: TopicStatus;
  repos?: string[];
  visibility?: 'private' | 'public';
}): Promise<PublishedTopic> {
  const json = await topicRequest<{ id: string; url: string; topic: Topic }>(
    'POST',
    '/topics',
    'publish',
    {
      title: input.title,
      description: input.description ?? '',
      trailIds: input.trailIds,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.repos !== undefined ? { repos: input.repos } : {}),
      ...(input.visibility !== undefined
        ? { visibility: input.visibility }
        : {}),
    },
  );
  return { id: json.id, url: absoluteUrl(json.url), topic: json.topic };
}

/** Owner edit of a published topic's title/description/status/repos. Returns the
 *  server's updated canonical topic. */
export async function patchTopicOnWebAde(
  remoteId: string,
  updates: {
    title?: string;
    description?: string;
    status?: TopicStatus;
    repos?: string[];
  },
): Promise<Topic> {
  const json = await topicRequest<{ topic: Topic }>(
    'PATCH',
    `/topics/by-id/${encodeURIComponent(remoteId)}`,
    'update',
    updates,
  );
  return json.topic;
}

/** Append a (already-shared) trail to a published topic. */
export async function addTrailOnWebAde(
  remoteId: string,
  trailId: string,
): Promise<Topic> {
  const json = await topicRequest<{ topic: Topic }>(
    'POST',
    `/topics/by-id/${encodeURIComponent(remoteId)}/trails`,
    'add a trail to',
    { trailId },
  );
  return json.topic;
}

/** Remove a trail from a published topic. */
export async function removeTrailOnWebAde(
  remoteId: string,
  trailId: string,
): Promise<Topic> {
  const json = await topicRequest<{ topic: Topic }>(
    'DELETE',
    `/topics/by-id/${encodeURIComponent(remoteId)}/trails/${encodeURIComponent(trailId)}`,
    'remove a trail from',
  );
  return json.topic;
}

/** Reorder a published topic's trails. The server requires the new list to be
 *  a permutation of the existing membership (no add/remove via reorder). */
export async function reorderTrailsOnWebAde(
  remoteId: string,
  trailIds: string[],
): Promise<Topic> {
  const json = await topicRequest<{ topic: Topic }>(
    'PATCH',
    `/topics/by-id/${encodeURIComponent(remoteId)}/trails`,
    'reorder trails in',
    { trailIds },
  );
  return json.topic;
}
