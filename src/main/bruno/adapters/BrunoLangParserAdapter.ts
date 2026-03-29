/**
 * Bruno Lang Parser Adapter
 *
 * Implements IParserAdapter using @usebruno/lang for .bru file parsing.
 * This is Node.js only - not browser-safe.
 */

import type { BrunoRequest } from '@principal-ade/bruno-panels';
import type { IParserAdapter, ParseResult } from './interfaces';

// @usebruno/lang doesn't have TypeScript definitions
const { bruToJsonV2, jsonToBruV2 } = require('@usebruno/lang');

/**
 * Maps the @usebruno/lang output to our BrunoRequest type
 */
function mapToBrunoRequest(parsed: Record<string, unknown>): BrunoRequest {
  const meta = parsed.meta as Record<string, unknown> | undefined;
  const http = parsed.http as Record<string, unknown> | undefined;
  const headers = parsed.headers as Array<Record<string, unknown>> | undefined;
  const params = parsed.params as Array<Record<string, unknown>> | undefined;
  const body = parsed.body as Record<string, unknown> | undefined;
  const auth = parsed.auth as Record<string, unknown> | undefined;

  const request: BrunoRequest = {
    http: {
      method: (http?.method as string) || 'GET',
      url: (http?.url as string) || '',
    },
  };

  if (meta) {
    request.meta = {
      name: (meta.name as string) || '',
      type: (meta.type as string) || 'http',
      seq: meta.seq as number | undefined,
    };
  }

  if (headers && Array.isArray(headers)) {
    request.headers = headers.map((h) => ({
      name: (h.name as string) || '',
      value: (h.value as string) || '',
      enabled: h.enabled !== false,
    }));
  }

  if (params && Array.isArray(params)) {
    request.params = params.map((p) => ({
      name: (p.name as string) || '',
      value: (p.value as string) || '',
      enabled: p.enabled !== false,
      type: (p.type as string) || 'query',
    }));
  }

  if (body) {
    request.body = {};
    if (body.json) request.body.json = body.json as string;
    if (body.text) request.body.text = body.text as string;
    if (body.xml) request.body.xml = body.xml as string;
    if (body.formUrlEncoded && Array.isArray(body.formUrlEncoded)) {
      request.body.formUrlEncoded = (
        body.formUrlEncoded as Array<Record<string, unknown>>
      ).map((f) => ({
        name: (f.name as string) || '',
        value: (f.value as string) || '',
        enabled: f.enabled !== false,
      }));
    }
    if (body.multipartForm && Array.isArray(body.multipartForm)) {
      request.body.multipartForm = (
        body.multipartForm as Array<Record<string, unknown>>
      ).map((f) => ({
        name: (f.name as string) || '',
        value: (f.value as string) || '',
        enabled: f.enabled !== false,
        type: (f.type as string) || 'text',
      }));
    }
  }

  if (auth) {
    request.auth = {
      mode: auth.mode as string | undefined,
    };
    if (auth.basic) {
      const basic = auth.basic as Record<string, unknown>;
      request.auth.basic = {
        username: (basic.username as string) || '',
        password: (basic.password as string) || '',
      };
    }
    if (auth.bearer) {
      const bearer = auth.bearer as Record<string, unknown>;
      request.auth.bearer = {
        token: (bearer.token as string) || '',
      };
    }
  }

  return request;
}

export class BrunoLangParserAdapter implements IParserAdapter {
  async parseBruFile(content: string): Promise<ParseResult> {
    try {
      const parsed = bruToJsonV2(content);

      // Check if parsing returned an error structure
      if (parsed.error) {
        return {
          success: false,
          errors: [
            {
              message: parsed.error.message || 'Parse error',
              severity: 'error',
              line: parsed.error.line,
              column: parsed.error.column,
            },
          ],
        };
      }

      const request = mapToBrunoRequest(parsed);

      return {
        success: true,
        request,
      };
    } catch (error) {
      // Handle parsing exceptions
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown parse error';

      // Try to extract line/column from error message if available
      const lineMatch = errorMessage.match(/line (\d+)/i);
      const columnMatch = errorMessage.match(/column (\d+)/i);

      return {
        success: false,
        errors: [
          {
            message: errorMessage,
            severity: 'error',
            line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
            column: columnMatch ? parseInt(columnMatch[1], 10) : undefined,
          },
        ],
      };
    }
  }

  async serializeToBru(request: BrunoRequest): Promise<string> {
    try {
      // Convert our BrunoRequest back to the format @usebruno/lang expects
      const brunoFormat = {
        meta: request.meta,
        http: request.http,
        headers: request.headers,
        params: request.params,
        body: request.body,
        auth: request.auth,
      };

      return jsonToBruV2(brunoFormat);
    } catch (error) {
      throw new Error(
        `Failed to serialize to .bru format: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
