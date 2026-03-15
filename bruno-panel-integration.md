# Bruno Panel Integration Guide

This document explains how to wire up the `sendRequest` action for the Bruno API client panel (`@principal-ade/bruno-panels`).

## Overview

The Bruno panel is browser-safe and handles:
- Parsing `.bru` files via `@usebruno/lang`
- Displaying collections, requests, and responses
- UI for editing headers, params, body, etc.

The **host** (Electron main process) must implement the actual HTTP execution via the `sendRequest` action, since HTTP requests with full header control require Node.js.

## Dependencies

Install the Bruno requests library in the Electron app:

```bash
npm install @usebruno/requests
```

## Implementing the sendRequest Action

### 1. Create the Request Handler

```typescript
// src/main/actions/bruno-actions.ts
import { makeHttpRequest } from '@usebruno/requests';
import type { BrunoResponse } from '@principal-ade/bruno-panels';

interface BrunoRequest {
  http: {
    method: string;
    url: string;
    body?: string;
  };
  headers?: Array<{ name: string; value: string; enabled: boolean }>;
  params?: Array<{ name: string; value: string; enabled: boolean; type: string }>;
  body?: {
    json?: string;
    text?: string;
    xml?: string;
    formUrlEncoded?: Array<{ name: string; value: string; enabled: boolean }>;
    multipartForm?: Array<{ name: string; value: string; enabled: boolean; type: string }>;
  };
  auth?: {
    mode?: string;
    basic?: { username: string; password: string };
    bearer?: { token: string };
  };
  script?: {
    req?: string;
    res?: string;
  };
}

export async function sendBrunoRequest(
  request: BrunoRequest,
  environment: Record<string, string> = {}
): Promise<BrunoResponse> {
  const startTime = Date.now();

  try {
    // Interpolate environment variables in URL
    let url = request.http.url;
    for (const [key, value] of Object.entries(environment)) {
      url = url.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    // Build headers object
    const headers: Record<string, string> = {};
    for (const header of request.headers || []) {
      if (header.enabled) {
        let value = header.value;
        for (const [key, val] of Object.entries(environment)) {
          value = value.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
        }
        headers[header.name] = value;
      }
    }

    // Build query params
    const queryParams = (request.params || [])
      .filter(p => p.enabled && p.type === 'query')
      .reduce((acc, p) => {
        let value = p.value;
        for (const [key, val] of Object.entries(environment)) {
          value = value.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
        }
        acc[p.name] = value;
        return acc;
      }, {} as Record<string, string>);

    // Append query params to URL
    if (Object.keys(queryParams).length > 0) {
      const urlObj = new URL(url);
      for (const [key, value] of Object.entries(queryParams)) {
        urlObj.searchParams.append(key, value);
      }
      url = urlObj.toString();
    }

    // Prepare request body
    let body: string | undefined;
    const contentType = headers['Content-Type'] || headers['content-type'];

    if (request.body?.json) {
      body = request.body.json;
      if (!contentType) {
        headers['Content-Type'] = 'application/json';
      }
    } else if (request.body?.text) {
      body = request.body.text;
    } else if (request.body?.xml) {
      body = request.body.xml;
      if (!contentType) {
        headers['Content-Type'] = 'application/xml';
      }
    }

    // Interpolate environment variables in body
    if (body) {
      for (const [key, value] of Object.entries(environment)) {
        body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }

    // Handle authentication
    if (request.auth?.mode === 'basic' && request.auth.basic) {
      const { username, password } = request.auth.basic;
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (request.auth?.mode === 'bearer' && request.auth.bearer) {
      let token = request.auth.bearer.token;
      for (const [key, value] of Object.entries(environment)) {
        token = token.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Execute the request using @usebruno/requests
    const response = await makeHttpRequest({
      method: request.http.method.toUpperCase(),
      url,
      headers,
      data: body,
    });

    const responseTime = Date.now() - startTime;

    // Calculate response size
    const responseData = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);
    const size = Buffer.byteLength(responseData, 'utf8');

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      data: response.data,
      responseTime,
      size,
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;

    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        response: {
          status: number;
          statusText: string;
          headers: Record<string, string>;
          data: unknown
        }
      };
      const { response } = axiosError;
      const responseData = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        responseTime,
        size: Buffer.byteLength(responseData, 'utf8'),
      };
    }

    // Network error or other failure
    throw error;
  }
}
```

### 2. Register the Action with Panel Framework

```typescript
// src/main/panel-actions.ts (or wherever panel actions are registered)
import { sendBrunoRequest } from './actions/bruno-actions';

export const panelActions = {
  // ... other actions

  'sendRequest': async (
    request: unknown,
    environment?: Record<string, string>
  ) => {
    return sendBrunoRequest(request as BrunoRequest, environment);
  },
};
```

### 3. Wire Up via IPC (if using preload)

If your architecture uses IPC between renderer and main:

```typescript
// src/main/ipc-handlers.ts
import { ipcMain } from 'electron';
import { sendBrunoRequest } from './actions/bruno-actions';

ipcMain.handle('panel:sendRequest', async (_event, request, environment) => {
  return sendBrunoRequest(request, environment);
});
```

```typescript
// src/preload/panel-bridge.ts
import { ipcRenderer } from 'electron';

export const panelBridge = {
  sendRequest: (request: unknown, environment?: Record<string, string>) => {
    return ipcRenderer.invoke('panel:sendRequest', request, environment);
  },
};
```

## Using @usebruno/requests Directly

If you prefer more control, `@usebruno/requests` provides these exports:

```typescript
import {
  makeHttpRequest,    // Basic HTTP requests
  makeGrpcRequest,    // gRPC support
  interpolate,        // Variable interpolation helper
} from '@usebruno/requests';
```

### Basic Usage

```typescript
const response = await makeHttpRequest({
  method: 'POST',
  url: 'https://api.example.com/users',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token123',
  },
  data: JSON.stringify({ name: 'John' }),
});
```

## Environment Variables

Bruno supports environment files (`.bru` or YAML). The panel will pass the active environment to `sendRequest`. Common patterns:

```typescript
// environments/dev.bru
vars {
  baseUrl: https://dev-api.example.com
  apiKey: dev-key-123
}

// environments/prod.bru
vars {
  baseUrl: https://api.example.com
  apiKey: {{process.env.API_KEY}}
}
```

The `sendRequest` action receives these as a flat `Record<string, string>`:

```typescript
{
  baseUrl: 'https://dev-api.example.com',
  apiKey: 'dev-key-123'
}
```

## Pre/Post Request Scripts

Bruno supports JavaScript scripts that run before/after requests. If you need to support these:

```typescript
import { runScript } from '@usebruno/requests';

// Pre-request script
if (request.script?.req) {
  const scriptContext = {
    bru: { /* bruno runtime API */ },
    req: { /* request object */ },
  };
  await runScript(request.script.req, scriptContext);
}

// Execute request...

// Post-response script
if (request.script?.res) {
  const scriptContext = {
    bru: { /* bruno runtime API */ },
    res: { /* response object */ },
  };
  await runScript(request.script.res, scriptContext);
}
```

Note: Script execution requires `vm` or sandboxed evaluation. Consider security implications.

## Security Considerations

1. **Certificate Validation**: By default, Node.js validates SSL certificates. For dev environments with self-signed certs, you may need to configure this.

2. **Proxy Support**: If users need proxy support, configure the underlying HTTP client.

3. **Script Sandboxing**: If supporting pre/post scripts, use a sandboxed VM to prevent malicious code execution.

4. **Sensitive Data**: Environment variables may contain secrets. Don't log full request/response in production.

## Testing the Integration

```typescript
// Test the action directly
const response = await sendBrunoRequest({
  http: {
    method: 'get',
    url: 'https://httpbin.org/get',
  },
  headers: [
    { name: 'Accept', value: 'application/json', enabled: true },
  ],
  params: [
    { name: 'foo', value: 'bar', enabled: true, type: 'query' },
  ],
}, {});

console.log(response.status); // 200
console.log(response.data);   // { args: { foo: 'bar' }, ... }
```
