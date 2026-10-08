/**
 * Web-ade integration for published topics.
 *
 * Owns the HTTPS calls against `/api/topics` (publish) and
 * `/api/topics/by-id/{id}` (read + edit), translating HTTP failures into the
 * typed topic-sharing errors.
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
} from '@principal-ai/subsystems-core/node';
import {
  TOKEN_KEYS,
  UnifiedSecureStorage,
} from '../services/UnifiedSecureStorage';
import type { FetchSharedTopicResult } from '../../shared/main-process-api-interfaces/TopicAPI';
import { requireHostedFeature } from '../services/FeatureAvailabilityService';

type TopicShareErrorCode =
  | 'NO_GITHUB_TOKEN'
  | 'NO_REPO_ACCESS'
  | 'SHARE_NOT_FOUND'
  | 'INVALID_PAYLOAD'
  | 'WEB_ADE_ERROR'
  | 'NETWORK_ERROR';

class TopicShareError extends Error {
  constructor(
    public readonly code: TopicShareErrorCode,
    message: string,
    public readonly details?: { status?: number; code?: string; cause?: string },
  ) {
    super(message);
    this.name = 'TopicShareError';
  }
}

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
    throw new TopicShareError(
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
 * Map a topic-route error response onto the topic-sharing error codes.
 */
function topicShareError(
  res: import('node-fetch').Response,
  body: WebAdeErrorBody,
  context: string,
): TopicShareError {
  const message =
    body.error || `Web-ade topic ${context} failed with status ${res.status}`;
  if (res.status === 401 || body.code === 'NOT_AUTHENTICATED') {
    return new TopicShareError('NO_GITHUB_TOKEN', message);
  }
  if (
    res.status === 403 ||
    body.code === 'NOT_OWNER' ||
    body.code === 'NO_REPO_ACCESS'
  ) {
    return new TopicShareError('NO_REPO_ACCESS', message);
  }
  if (
    res.status === 404 ||
    body.code === 'NOT_FOUND'
  ) {
    return new TopicShareError('SHARE_NOT_FOUND', message);
  }
  if (body.code === 'INVALID_PAYLOAD' || body.code === 'INVALID_REQUEST') {
    return new TopicShareError('INVALID_PAYLOAD', message);
  }
  return new TopicShareError('WEB_ADE_ERROR', message, {
    status: res.status,
    code: body.code,
  });
}

/**
 * Shared request helper for the owner-gated topic calls: attaches the bearer
 * token, JSON-encodes the body when present, and maps non-2xx responses to a
 * `TopicShareError`. `context` is the verb phrase used in error messages
 * (e.g. "publish", "update").
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
    throw new TopicShareError(
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
  await requireHostedFeature('topicSharing');
  const token = await getOptionalGithubToken();
  const url = `${apiBase()}/topics/by-id/${encodeURIComponent(id)}`;
  let res: import('node-fetch').Response;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    throw new TopicShareError(
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
      throw new TopicShareError('SHARE_NOT_FOUND', message);
    }
    if (res.status === 403 || body.code === 'NO_REPO_ACCESS') {
      throw new TopicShareError('NO_REPO_ACCESS', message);
    }
    throw new TopicShareError('WEB_ADE_ERROR', message, {
      status: res.status,
      code: body.code,
    });
  }

  return (await res.json()) as FetchSharedTopicResult;
}

/** Result of publishing a topic — the server-assigned id, its URL, and record. */
export interface PublishedTopic {
  id: string;
  url: string;
  topic: Topic;
}

/**
 * Publish a topic to web-ade. The server mints its own id.
 */
export async function publishTopicToWebAde(input: {
  title: string;
  description?: string;
  status?: TopicStatus;
  repos?: string[];
  visibility?: 'private' | 'public';
}): Promise<PublishedTopic> {
  await requireHostedFeature('topicSharing');
  const json = await topicRequest<{ id: string; url: string; topic: Topic }>(
    'POST',
    '/topics',
    'publish',
    {
      title: input.title,
      description: input.description ?? '',
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
  await requireHostedFeature('topicSharing');
  const json = await topicRequest<{ topic: Topic }>(
    'PATCH',
    `/topics/by-id/${encodeURIComponent(remoteId)}`,
    'update',
    updates,
  );
  return json.topic;
}
