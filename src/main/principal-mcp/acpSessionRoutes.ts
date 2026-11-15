import path from 'path';
import type { Application, Request, Response } from 'express';
import type {
  AcpActiveSessionSummary,
  AcpPromptResult,
  AcpToolCallSummary,
} from '../../shared/main-process-api-interfaces/AcpAPI';
import { SpanStatusCode } from '@opentelemetry/api';
import { getTracer } from '../telemetry';
import { repositoryTelemetryId } from '../telemetry/repositoryIdentity';

const tracer = getTracer('principal-ade-acp-mcp');
const MAX_PROMPT_LENGTH = 20_000;

export interface AcpSessionRouteDependencies {
  getRepositoryDirectories(): Promise<string[]>;
  listActiveSessions(): AcpActiveSessionSummary[];
  getToolCallsForSession(
    sessionId: string,
    directory?: string,
  ): AcpToolCallSummary[] | null;
  startSession(
    directory: string,
  ): Promise<{ agentName: string; alreadyRunning: boolean } | null>;
  getActiveSessionInfo(directory: string): {
    sessionKey: string;
    agentName: string;
    hasSession: boolean;
    isPrompting: boolean;
  } | null;
  prompt(sessionKey: string, text: string): Promise<AcpPromptResult>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isWithin(directory: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(directory));
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function rejectBrowserOrigin(req: Request, res: Response): boolean {
  if (
    req.headers.origin !== undefined ||
    req.headers['sec-fetch-site'] !== undefined
  ) {
    res.status(403).json({
      success: false,
      error: 'browser-origin requests are not allowed',
    });
    return true;
  }
  return false;
}

/**
 * Prompt an ACP session already opened in Principal. The renderer continues to
 * handle permission requests, so MCP callers cannot silently approve tools.
 */
export function registerAcpSessionRoutes(
  app: Application,
  deps: AcpSessionRouteDependencies,
): void {
  app.get('/api/acp/sessions', async (req, res) => {
    if (rejectBrowserOrigin(req, res)) return;

    if (
      req.query.directory !== undefined &&
      typeof req.query.directory !== 'string'
    ) {
      res.status(400).json({
        success: false,
        error: 'directory must be a single absolute path',
      });
      return;
    }
    const directory =
      typeof req.query.directory === 'string' ? req.query.directory : undefined;
    if (directory !== undefined && !path.isAbsolute(directory)) {
      res.status(400).json({
        success: false,
        error: 'directory must be absolute',
      });
      return;
    }

    try {
      const repositoryDirectories = (
        await deps.getRepositoryDirectories()
      ).filter((value) => typeof value === 'string' && path.isAbsolute(value));
      if (
        directory &&
        !repositoryDirectories.some((root) => isWithin(directory, root))
      ) {
        res.status(400).json({
          success: false,
          error: 'directory must be inside a registered repository',
        });
        return;
      }

      const sessions = deps
        .listActiveSessions()
        .filter(
          (session) =>
            (!directory || session.directory === directory) &&
            repositoryDirectories.some((root) =>
              isWithin(session.directory, root),
            ),
        );
      res.json({ success: true, sessions });
    } catch {
      res.status(500).json({
        success: false,
        error: 'could not read active ACP sessions',
      });
    }
  });

  app.get('/api/acp/sessions/:sessionId/tool-calls', async (req, res) => {
    if (rejectBrowserOrigin(req, res)) return;

    const sessionId =
      typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
    if (
      req.query.directory !== undefined &&
      typeof req.query.directory !== 'string'
    ) {
      res.status(400).json({
        success: false,
        error: 'directory must be a single absolute path',
      });
      return;
    }
    const directory =
      typeof req.query.directory === 'string' ? req.query.directory : undefined;
    if (req.query.limit !== undefined && typeof req.query.limit !== 'string') {
      res.status(400).json({
        success: false,
        error: 'limit must be a single integer',
      });
      return;
    }
    const rawLimit =
      typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const limit = rawLimit === undefined ? 100 : Number(rawLimit);
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'sessionId is required' });
      return;
    }
    if (directory !== undefined && !path.isAbsolute(directory)) {
      res.status(400).json({
        success: false,
        error: 'directory must be absolute',
      });
      return;
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      res.status(400).json({
        success: false,
        error: 'limit must be an integer from 1 to 200',
      });
      return;
    }

    try {
      const repositoryDirectories = (
        await deps.getRepositoryDirectories()
      ).filter((value) => typeof value === 'string' && path.isAbsolute(value));
      if (
        directory &&
        !repositoryDirectories.some((root) => isWithin(directory, root))
      ) {
        res.status(400).json({
          success: false,
          error: 'directory must be inside a registered repository',
        });
        return;
      }

      const sessions = deps
        .listActiveSessions()
        .filter(
          (session) =>
            session.sessionId === sessionId &&
            (!directory || session.directory === directory) &&
            repositoryDirectories.some((root) =>
              isWithin(session.directory, root),
            ),
        );
      if (sessions.length === 0) {
        res.status(404).json({
          success: false,
          error: 'no active ACP session found for this sessionId',
        });
        return;
      }
      if (sessions.length > 1) {
        res.status(409).json({
          success: false,
          error: 'sessionId is ambiguous; provide the directory query',
        });
        return;
      }

      const session = sessions[0];
      const toolCalls = deps.getToolCallsForSession(
        sessionId,
        session.directory,
      );
      if (!toolCalls) {
        res.status(404).json({
          success: false,
          error: 'no active ACP session found for this sessionId',
        });
        return;
      }
      const safeToolCalls = toolCalls.slice(0, limit).map((toolCall) => ({
        ...toolCall,
        locations: toolCall.locations?.flatMap((location) => {
          const absolutePath = path.resolve(
            path.isAbsolute(location.path)
              ? location.path
              : path.resolve(session.directory, location.path),
          );
          const repositoryRoot = [...repositoryDirectories]
            .filter((root) => isWithin(absolutePath, root))
            .sort((left, right) => right.length - left.length)[0];
          if (!repositoryRoot) return [];
          return [
            {
              path: path.relative(repositoryRoot, absolutePath),
              ...(location.line == null ? {} : { line: location.line }),
            },
          ];
        }),
      }));
      res.json({
        success: true,
        session,
        toolCalls: safeToolCalls,
        count: toolCalls.length,
        limit,
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'could not read ACP tool calls',
      });
    }
  });

  app.post('/api/acp/sessions/open', async (req, res) => {
    if (rejectBrowserOrigin(req, res)) return;

    const body = isObject(req.body) ? req.body : null;
    if (!body || Object.keys(body).some((key) => key !== 'directory')) {
      res.status(400).json({
        success: false,
        error: 'body must contain only directory',
      });
      return;
    }

    const directory = typeof body.directory === 'string' ? body.directory : '';
    if (!path.isAbsolute(directory)) {
      res.status(400).json({
        success: false,
        error: 'an absolute directory is required',
      });
      return;
    }

    let repositoryDirectories: string[];
    try {
      repositoryDirectories = (await deps.getRepositoryDirectories()).filter(
        (value) => typeof value === 'string' && path.isAbsolute(value),
      );
    } catch {
      res.status(500).json({
        success: false,
        error: 'could not validate registered repositories',
      });
      return;
    }
    if (!repositoryDirectories.some((root) => isWithin(directory, root))) {
      res.status(400).json({
        success: false,
        error: 'directory must be inside a registered repository',
      });
      return;
    }

    const span = tracer.startSpan('principal_mcp.acp.session.open', {
      attributes: {
        'principal.repository.telemetry_id': repositoryTelemetryId(directory),
      },
    });
    try {
      const session = await deps.startSession(directory);
      if (!session) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        res.status(503).json({
          success: false,
          error: 'could not open an ACP session in the Principal window',
        });
        return;
      }
      span.setAttribute('acp.agent.name', session.agentName);
      span.setAttribute('acp.session.already_running', session.alreadyRunning);
      span.setStatus({ code: SpanStatusCode.OK });
      res.json({
        success: true,
        opened: true,
        alreadyRunning: session.alreadyRunning,
        agent: session.agentName,
      });
    } catch (error) {
      span.setAttribute(
        'error.type',
        error instanceof Error ? error.name : typeof error,
      );
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(504).json({
        success: false,
        error: 'ACP session did not become ready in time',
      });
    } finally {
      span.end();
    }
  });

  app.post('/api/acp/prompt', async (req, res) => {
    if (rejectBrowserOrigin(req, res)) return;

    const body = isObject(req.body) ? req.body : null;
    if (
      !body ||
      Object.keys(body).some((key) => !['directory', 'text'].includes(key))
    ) {
      res.status(400).json({
        success: false,
        error: 'body must contain only directory and text',
      });
      return;
    }

    const directory = typeof body.directory === 'string' ? body.directory : '';
    const text = typeof body.text === 'string' ? body.text : '';
    if (
      !path.isAbsolute(directory) ||
      !text.trim() ||
      text.length > MAX_PROMPT_LENGTH
    ) {
      res.status(400).json({
        success: false,
        error:
          'an absolute directory and non-empty text of at most 20000 characters are required',
      });
      return;
    }

    let repositoryDirectories: string[];
    try {
      repositoryDirectories = (await deps.getRepositoryDirectories()).filter(
        (value) => typeof value === 'string' && path.isAbsolute(value),
      );
    } catch {
      res.status(500).json({
        success: false,
        error: 'could not validate registered repositories',
      });
      return;
    }
    if (!repositoryDirectories.some((root) => isWithin(directory, root))) {
      res.status(400).json({
        success: false,
        error: 'directory must be inside a registered repository',
      });
      return;
    }

    const session = deps.getActiveSessionInfo(directory);
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'no unique connected ACP session exists for this directory',
      });
      return;
    }
    if (!session.hasSession) {
      res.status(409).json({
        success: false,
        error: 'the ACP connection has not started a session yet',
      });
      return;
    }
    if (session.isPrompting) {
      res.status(409).json({
        success: false,
        error: 'an ACP prompt is already in progress',
      });
      return;
    }

    const span = tracer.startSpan('principal_mcp.acp.prompt', {
      attributes: {
        'acp.agent.name': session.agentName,
        'principal.repository.telemetry_id': repositoryTelemetryId(directory),
        'acp.prompt.length': text.length,
      },
    });
    try {
      const result = await deps.prompt(session.sessionKey, text);
      span.setAttribute('acp.prompt.stop_reason', result.stopReason);
      span.setAttribute(
        'acp.session_update.count',
        Object.values(result.sessionUpdates ?? {}).reduce(
          (total, count) => total + count,
          0,
        ),
      );
      span.setStatus({ code: SpanStatusCode.OK });
      res.json({
        success: true,
        agent: session.agentName,
        stopReason: result.stopReason,
        sessionUpdates: result.sessionUpdates ?? {},
      });
    } catch (error) {
      span.setAttribute(
        'error.type',
        error instanceof Error ? error.name : typeof error,
      );
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.status(502).json({
        success: false,
        error: 'ACP prompt failed',
      });
    } finally {
      span.end();
    }
  });
}
