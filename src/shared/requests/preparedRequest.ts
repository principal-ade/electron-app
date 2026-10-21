import type { BrunoRequest } from '@principal-ade/bruno-panels';

/** Optional, unverified UI grouping. Neither field is resolved against a registry. */
export interface RequestTarget {
  purl: string;
  identifier: string;
}

export const REQUEST_TARGET_PURL_MAX_LENGTH = 1000;
export const REQUEST_TARGET_IDENTIFIER_MAX_LENGTH = 200;

export interface PreparedRequest {
  title: string;
  request: BrunoRequest;
  environment: Record<string, string>;
  repositoryPath?: string;
  target?: RequestTarget;
}

export interface SavedRequest extends PreparedRequest {
  id: string;
}

/** Retained definition, not a send/response history entry. */
export interface CatalogRequest extends SavedRequest {
  pinned: boolean;
}

export function requestDefinition({
  pinned: _pinned,
  ...request
}: CatalogRequest): SavedRequest {
  return request;
}

export interface OpenRequestEnvelope extends SavedRequest {
  requestId: string;
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function fields(
  value: unknown,
  allowed: string[],
): asserts value is Record<string, unknown> {
  if (
    !object(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  ) {
    throw new Error('Invalid or unsupported request fields.');
  }
}

function string(value: unknown): asserts value is string {
  if (typeof value !== 'string')
    throw new Error('Request fields must be strings.');
}

export function parseRequestTarget(value: unknown): RequestTarget {
  fields(value, ['purl', 'identifier']);
  string(value.purl);
  string(value.identifier);
  const purl = value.purl.trim();
  const identifier = value.identifier.trim();
  if (!purl || purl.length > REQUEST_TARGET_PURL_MAX_LENGTH) {
    throw new Error('Target PURL must be 1–1000 characters.');
  }
  if (!identifier || identifier.length > REQUEST_TARGET_IDENTIFIER_MAX_LENGTH) {
    throw new Error('Target identifier must be 1–200 characters.');
  }
  return { purl, identifier };
}

function entries(value: unknown, types?: string[]): void {
  if (!Array.isArray(value) || value.length > 1000) {
    throw new Error('Request entries must be an array of at most 1000 items.');
  }
  for (const entry of value) {
    fields(entry, ['name', 'value', 'enabled', ...(types ? ['type'] : [])]);
    string(entry.name);
    string(entry.value);
    if (
      typeof entry.enabled !== 'boolean' ||
      (types && !types.includes(String(entry.type)))
    ) {
      throw new Error('Invalid request entry.');
    }
  }
}

/** Accept definitions only. Scripts, tests, captured responses, and auto-send flags
 * are deliberately not part of the local agent contract. */
export function parsePreparedRequest(value: unknown): PreparedRequest {
  fields(value, [
    'title',
    'request',
    'environment',
    'repositoryPath',
    'target',
  ]);
  const target =
    value.target === undefined ? undefined : parseRequestTarget(value.target);
  const { request } = value;
  fields(request, ['meta', 'http', 'headers', 'params', 'body', 'auth']);
  fields(request.http, ['method', 'url', 'body']);
  string(request.http.method);
  string(request.http.url);
  if (!/^[A-Za-z]+$/.test(request.http.method) || !request.http.url.trim()) {
    throw new Error('A method and non-empty URL are required.');
  }
  // Templates may resolve the scheme/host at send time.
  if (
    !request.http.url.includes('{{') &&
    !/^https?:\/\//i.test(request.http.url)
  ) {
    throw new Error('Only HTTP and HTTPS requests are supported.');
  }
  if (request.http.body !== undefined) string(request.http.body);
  if (request.meta !== undefined) {
    fields(request.meta, ['name', 'type', 'seq']);
    string(request.meta.name);
    string(request.meta.type);
    if (
      request.meta.seq !== undefined &&
      typeof request.meta.seq !== 'number'
    ) {
      throw new Error('Invalid request sequence.');
    }
  }
  if (request.headers !== undefined) entries(request.headers);
  if (request.params !== undefined) entries(request.params, ['query', 'path']);
  if (request.body !== undefined) {
    fields(request.body, [
      'json',
      'text',
      'xml',
      'formUrlEncoded',
      'multipartForm',
    ]);
    if (Object.keys(request.body).length > 1)
      throw new Error('Choose one request body format.');
    for (const [mode, body] of Object.entries(request.body)) {
      if (mode === 'formUrlEncoded') entries(body);
      else if (mode === 'multipartForm') entries(body, ['text', 'file']);
      else string(body);
    }
  }
  if (request.auth !== undefined) {
    fields(request.auth, ['mode', 'basic', 'bearer']);
    if (
      request.auth.mode !== undefined &&
      !['none', 'basic', 'bearer'].includes(String(request.auth.mode))
    ) {
      throw new Error('Only basic and bearer authentication are supported.');
    }
    if (request.auth.basic !== undefined) {
      fields(request.auth.basic, ['username', 'password']);
      string(request.auth.basic.username);
      string(request.auth.basic.password);
    }
    if (request.auth.bearer !== undefined) {
      fields(request.auth.bearer, ['token']);
      string(request.auth.bearer.token);
    }
    if (
      (request.auth.mode === 'basic' && !request.auth.basic) ||
      (request.auth.mode === 'bearer' && !request.auth.bearer)
    ) {
      throw new Error('Missing authentication fields.');
    }
  }
  if (
    value.environment !== undefined &&
    (!object(value.environment) ||
      !Object.values(value.environment).every(
        (entry) => typeof entry === 'string',
      ))
  ) {
    throw new Error('Environment must contain string values.');
  }
  if (value.title !== undefined) {
    string(value.title);
    if (!value.title.trim() || value.title.length > 200)
      throw new Error('Title must be 1–200 characters.');
  }
  if (value.repositoryPath !== undefined) {
    string(value.repositoryPath);
    if (!value.repositoryPath.startsWith('/'))
      throw new Error('Repository path must be absolute.');
  }
  if (JSON.stringify(value).length > 2_000_000)
    throw new Error('Request definition is too large.');
  return {
    title: (value.title as string | undefined)?.trim() || 'HTTP request',
    request: request as unknown as BrunoRequest,
    environment:
      (value.environment as Record<string, string> | undefined) ?? {},
    repositoryPath: value.repositoryPath as string | undefined,
    ...(target && { target }),
  };
}

export function parseSavedRequest(value: unknown): SavedRequest {
  fields(value, [
    'id',
    'title',
    'request',
    'environment',
    'repositoryPath',
    'target',
  ]);
  if (typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value.id)) {
    throw new Error('Invalid saved request id.');
  }
  const { id, ...definition } = value;
  return { id, ...parsePreparedRequest(definition) };
}

export function parseCatalogRequest(value: unknown): CatalogRequest {
  if (!object(value) || typeof value.pinned !== 'boolean') {
    throw new Error('Invalid route catalog entry.');
  }
  const { pinned, ...definition } = value;
  return { ...parseSavedRequest(definition), pinned };
}
