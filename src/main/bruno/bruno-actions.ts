import { makeAxiosInstance } from '@usebruno/requests';
import type {
  BrunoRequest,
  BrunoResponse,
  BrunoEnvironment,
} from '@principal-ade/bruno-panels';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Interpolate environment variables in a string
 * Replaces {{variableName}} with the corresponding value from environment
 */
function interpolate(
  value: string,
  environment: Record<string, string>,
): string {
  return value.replace(/\{\{([^{}]+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(environment, key)
      ? environment[key]
      : match,
  );
}

/**
 * Execute an HTTP request using @usebruno/requests
 */
export async function sendBrunoRequest(
  request: BrunoRequest,
  environment: Record<string, string> = {},
): Promise<BrunoResponse> {
  const axiosInstance = makeAxiosInstance();

  // Interpolate environment variables in URL
  const target = new URL(interpolate(request.http.url, environment));
  if (!/^https?:$/.test(target.protocol)) {
    throw new Error('Only HTTP and HTTPS requests can be sent.');
  }
  const pathParams = new Map(
    (request.params || [])
      .filter((param) => param.enabled && param.type === 'path')
      .map((param) => [param.name, param.value]),
  );
  target.pathname = target.pathname.replace(
    /:([a-zA-Z0-9_]+)/g,
    (match, name: string) => {
      const value = pathParams.get(name);
      return value !== undefined
        ? encodeURIComponent(interpolate(value, environment))
        : match;
    },
  );
  let url = target.toString();
  if (request.body?.multipartForm !== undefined) {
    throw new Error(
      'Sending multipart requests is not supported. Choose another body format.',
    );
  }
  if (
    request.auth?.mode &&
    !['none', 'basic', 'bearer'].includes(request.auth.mode)
  ) {
    throw new Error('Only basic and bearer authentication are supported.');
  }

  // Build headers object
  const headers: Record<string, string> = {};
  for (const header of request.headers || []) {
    if (header.enabled) {
      headers[header.name] = interpolate(header.value, environment);
    }
  }

  // Build query params and append to URL
  const queryParams = (request.params || []).filter(
    (p) => p.enabled && p.type === 'query',
  );

  if (queryParams.length > 0) {
    const urlObj = new URL(url);
    for (const param of queryParams) {
      urlObj.searchParams.append(
        param.name,
        interpolate(param.value, environment),
      );
    }
    url = urlObj.toString();
  }

  // Prepare request body
  let body: string | undefined;
  const contentType = headers['Content-Type'] || headers['content-type'];

  if (request.body?.json !== undefined) {
    body = interpolate(request.body.json, environment);
    if (!contentType) {
      headers['Content-Type'] = 'application/json';
    }
  } else if (request.body?.text !== undefined) {
    body = interpolate(request.body.text, environment);
  } else if (request.body?.xml !== undefined) {
    body = interpolate(request.body.xml, environment);
    if (!contentType) {
      headers['Content-Type'] = 'application/xml';
    }
  } else if (request.body?.formUrlEncoded) {
    const params = new URLSearchParams();
    for (const field of request.body.formUrlEncoded) {
      if (field.enabled) {
        params.append(field.name, interpolate(field.value, environment));
      }
    }
    body = params.toString();
    if (!contentType) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  // Handle authentication
  if (request.auth?.mode === 'basic' && request.auth.basic) {
    const { username, password } = request.auth.basic;
    const credentials = Buffer.from(
      `${interpolate(username, environment)}:${interpolate(password, environment)}`,
    ).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (request.auth?.mode === 'bearer' && request.auth.bearer) {
    const token = interpolate(request.auth.bearer.token, environment);
    headers['Authorization'] = `Bearer ${token}`;
  }

  const startedAt = Date.now();
  try {
    const response = await axiosInstance.request({
      method: request.http.method.toUpperCase(),
      url,
      headers,
      data: body,
      // Don't throw on non-2xx responses - return them to the panel
      validateStatus: () => true,
      timeout: 60_000,
    });

    // Calculate response size
    const responseData =
      typeof response.data === 'string'
        ? response.data
        : (JSON.stringify(response.data) ?? '');
    const size = Buffer.byteLength(responseData, 'utf8');

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      data: response.data,
      responseTime: Date.now() - startedAt,
      size,
    };
  } catch (error: unknown) {
    // Handle axios errors with more detail
    if (error && typeof error === 'object' && 'code' in error) {
      const axiosError = error as {
        code?: string;
        message?: string;
        cause?: Error;
      };
      const message =
        axiosError.cause?.message ||
        axiosError.message ||
        axiosError.code ||
        'Unknown error';
      throw new Error(`Request failed: ${message}`);
    }

    if (error instanceof Error) {
      throw new Error(`Request failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load all Bruno environments from environments/*.json files
 */
export async function loadEnvironments(
  collectionPath: string,
): Promise<BrunoEnvironment[]> {
  const environmentsDir = path.join(collectionPath, 'environments');

  try {
    const files = await fs.readdir(environmentsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const environments: BrunoEnvironment[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(environmentsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const env = JSON.parse(content) as BrunoEnvironment;
        environments.push(env);
      } catch (err) {
        console.warn('[Bruno] Failed to load environment file:', file, err);
      }
    }

    return environments;
  } catch {
    // No environments directory or not accessible
    return [];
  }
}
