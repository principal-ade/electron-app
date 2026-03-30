import { makeAxiosInstance } from '@usebruno/requests';
import type { BrunoRequest, BrunoResponse, BrunoEnvironment } from '@principal-ade/bruno-panels';
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
  let result = value;
  for (const [key, val] of Object.entries(environment)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }
  return result;
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
  let url = interpolate(request.http.url, environment);

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

  if (request.body?.json) {
    body = interpolate(request.body.json, environment);
    if (!contentType) {
      headers['Content-Type'] = 'application/json';
    }
  } else if (request.body?.text) {
    body = interpolate(request.body.text, environment);
  } else if (request.body?.xml) {
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
    const credentials = Buffer.from(`${username}:${password}`).toString(
      'base64',
    );
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (request.auth?.mode === 'bearer' && request.auth.bearer) {
    const token = interpolate(request.auth.bearer.token, environment);
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await axiosInstance.request({
      method: request.http.method.toUpperCase(),
      url,
      headers,
      data: body,
      // Don't throw on non-2xx responses - return them to the panel
      validateStatus: () => true,
    });

    // Calculate response size
    const responseData =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
    const size = Buffer.byteLength(responseData, 'utf8');

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      data: response.data,
      responseTime: (response as { responseTime?: number }).responseTime || 0,
      size,
    };
  } catch (error: unknown) {
    // Handle axios errors with more detail
    if (error && typeof error === 'object' && 'code' in error) {
      const axiosError = error as { code?: string; message?: string; cause?: Error };
      const message = axiosError.cause?.message || axiosError.message || axiosError.code || 'Unknown error';
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
export async function loadEnvironments(collectionPath: string): Promise<BrunoEnvironment[]> {
  const environmentsDir = path.join(collectionPath, 'environments');

  try {
    const files = await fs.readdir(environmentsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

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
