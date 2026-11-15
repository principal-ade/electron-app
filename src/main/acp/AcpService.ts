/**
 * Main-process ACP connection manager.
 *
 * Each renderer tab owns one child agent process (`opencode acp` by default)
 * and one ACP JSON-RPC connection keyed by a stable `sessionKey`. The renderer
 * drives connect / session / prompt and receives `session/update` notifications
 * plus permission requests over IPC.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { app as electronApp } from 'electron';
import log from 'electron-log';
import { SpanStatusCode, type Span } from '@opentelemetry/api';
import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type ClientApp,
  type ClientConnection,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type ToolCallContent,
  type ToolCallUpdate,
} from '@agentclientprotocol/sdk';
import type { OpenCodeACPEventInput } from '@principal-ai/agent-monitoring';
import {
  AcpAPIEvent,
  DEFAULT_ACP_MODEL,
  getAcpAgent,
  type AcpAgentId,
  type AcpToolProcessingResult,
  type AcpActiveSessionSummary,
  type AcpToolCallSummary,
  type AcpConnectRequest,
  type AcpConnectResult,
  type AcpLoadSessionRequest,
  type AcpNewSessionRequest,
  type AcpNewSessionResult,
  type AcpPromptRequest,
  type AcpPromptResult,
  type AcpRespondPermissionRequest,
  type AcpSessionEvent,
  type AcpSessionEventEnvelope,
} from '../../shared/main-process-api-interfaces/AcpAPI';
import type { ACPToolProcessingResultMessage } from '../../event-processing-server/types';
import { getTracer } from '../telemetry';
import { repositoryTelemetryId } from '../telemetry/repositoryIdentity';
import { openCodeSessionHistoryService } from '../opencode/OpenCodeSessionHistoryService';
import { getProcessPath } from '../utils/processPath';
import { getEventServerManager } from '../agent-session-events/EventServerManager';

const tracer = getTracer('principal-ade-acp');
const TITLE_LOOKUP_ATTEMPTS = 5;
const TITLE_LOOKUP_INTERVAL_MS = 1_500;

interface AcpConnectionEntry {
  key: string;
  agentId: AcpAgentId;
  directory: string;
  webContents: Electron.WebContents;
  child: ChildProcessWithoutNullStreams;
  app: ClientApp;
  connection: ClientConnection;
  sessionId: string | null;
  sessionReady: boolean;
  sessionTitle: string | null;
  titleLookupStarted: boolean;
  pendingPermissions: Map<
    string,
    (response: RequestPermissionResponse) => void
  >;
  closed: boolean;
  supportsLoadSession: boolean;
  agentName: string;
  activePrompt: {
    span: Span;
    updateCounts: Map<string, number>;
    permissionRequestCount: number;
  } | null;
  toolCalls: Map<string, AcpToolCallSummary>;
  lastActivityAt?: number;
}

const cancelledPermission = (): RequestPermissionResponse => ({
  outcome: { outcome: 'cancelled' },
});

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function withAcpSpan<T>(
  name: string,
  operation: (span: Span) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name);
  try {
    const result = await operation(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    // Avoid recording exception messages: protocol/process errors can contain
    // workspace paths or agent-provided content.
    span.setAttribute(
      'error.type',
      error instanceof Error ? error.name : typeof error,
    );
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}

class AcpService {
  private readonly entries = new Map<string, AcpConnectionEntry>();

  constructor() {
    getEventServerManager().on(
      'acp-tool-processing-result',
      this.handleToolProcessingResult,
    );
  }

  getActiveSessionInfo(directory: string): {
    sessionKey: string;
    agentName: string;
    hasSession: boolean;
    isPrompting: boolean;
  } | null {
    const matches = [...this.entries.values()].filter(
      (entry) => !entry.closed && entry.directory === directory,
    );
    if (matches.length !== 1) return null;
    const [entry] = matches;
    return {
      sessionKey: entry.key,
      agentName: entry.agentName,
      hasSession: entry.sessionReady,
      isPrompting: entry.activePrompt !== null,
    };
  }

  getActiveSessions(): AcpActiveSessionSummary[] {
    return [...this.entries.values()]
      .filter((entry) => !entry.closed && entry.sessionId && entry.sessionReady)
      .map((entry) => ({
        sessionId: entry.sessionId as string,
        agentId: entry.agentId,
        agentName: entry.agentName,
        directory: entry.directory,
        isPrompting: entry.activePrompt !== null,
        toolCallCount: entry.toolCalls.size,
        lastActivityAt: entry.lastActivityAt,
      }))
      .sort(
        (left, right) =>
          (right.lastActivityAt ?? 0) - (left.lastActivityAt ?? 0),
      );
  }

  getToolCallsForSession(
    sessionId: string,
    directory?: string,
  ): AcpToolCallSummary[] | null {
    const matches = [...this.entries.values()].filter(
      (entry) =>
        !entry.closed &&
        entry.sessionReady &&
        entry.sessionId === sessionId &&
        (!directory || entry.directory === directory),
    );
    if (matches.length !== 1) return null;

    return [...matches[0].toolCalls.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((toolCall) => ({
        ...toolCall,
        locations: toolCall.locations?.map((location) => ({
          path: location.path,
          line: location.line,
        })),
      }));
  }

  async connect(
    request: AcpConnectRequest,
    webContents: Electron.WebContents,
  ): Promise<AcpConnectResult> {
    return withAcpSpan('acp.connect', async (span) => {
      // Replacing an existing connection for the same tab is intentional: the
      // renderer may reconnect after an error without having to know whether a
      // previous process survived.
      await this.disconnect({ sessionKey: request.sessionKey });

      const agent = getAcpAgent(request.agent);
      span.setAttribute('acp.agent.name', agent.name);
      span.setAttribute(
        'principal.repository.telemetry_id',
        repositoryTelemetryId(request.directory),
      );
      const child = spawn(agent.executable, agent.args, {
        cwd: request.directory,
        env: {
          ...process.env,
          PATH: getProcessPath(),
          TERM: 'dumb',
        },
        stdio: 'pipe',
      });

      try {
        await new Promise<void>((resolve, reject) => {
          child.once('spawn', resolve);
          child.once('error', reject);
        });
      } catch (error) {
        // `ENOENT` here almost always means the agent executable is not on PATH,
        // so say that instead of surfacing a bare spawn error.
        throw new Error(
          `Could not start ${agent.name} (\`${agent.command}\`): ${errorMessage(error)}. ` +
            'Make sure it is installed and available on PATH.',
        );
      }

      const acpClient = client({ name: 'Principal ADE' });

      const entry: AcpConnectionEntry = {
        key: request.sessionKey,
        agentId: request.agent,
        directory: request.directory,
        webContents,
        child,
        app: acpClient,
        connection: undefined as unknown as ClientConnection,
        sessionId: null,
        sessionReady: false,
        sessionTitle: null,
        titleLookupStarted: false,
        pendingPermissions: new Map(),
        closed: false,
        supportsLoadSession: false,
        agentName: agent.name,
        activePrompt: null,
        toolCalls: new Map(),
        lastActivityAt: Date.now(),
      };

      // Register handlers before connecting: the SDK dispatches the first
      // inbound messages as soon as the stream is attached.
      acpClient.onNotification(methods.client.session.update, ({ params }) => {
        this.handleSessionUpdate(entry, params);
      });

      acpClient.onRequest(
        methods.client.session.requestPermission,
        ({ params, signal }) =>
          this.handlePermissionRequest(entry, params, signal),
      );

      entry.connection = acpClient.connect(
        ndJsonStream(
          Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
          Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
        ),
      );

      this.entries.set(entry.key, entry);
      this.attachLifecycle(entry);

      try {
        const initialize = await entry.connection.agent.request(
          methods.agent.initialize,
          {
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: {},
            clientInfo: {
              name: 'Principal ADE',
              version: electronApp.getVersion(),
            },
          },
        );

        if (initialize.protocolVersion !== PROTOCOL_VERSION) {
          throw new Error(
            `Agent selected unsupported ACP protocol version ${initialize.protocolVersion}.`,
          );
        }
        entry.supportsLoadSession =
          initialize.agentCapabilities?.loadSession === true;
        span.setAttribute('acp.protocol.version', initialize.protocolVersion);
        span.setAttribute(
          'acp.agent.version',
          initialize.agentInfo?.version ?? 'unknown',
        );
        span.setAttribute(
          'acp.session.load_supported',
          entry.supportsLoadSession,
        );

        log.info(
          `[ACP] Connected ${agent.name} for ${request.directory} (${initialize.agentInfo?.version ?? 'unknown version'})`,
        );

        return {
          protocolVersion: initialize.protocolVersion,
          agentName: initialize.agentInfo?.name,
          agentVersion: initialize.agentInfo?.version,
        };
      } catch (error) {
        this.closeEntry(entry, errorMessage(error));
        throw error;
      }
    });
  }

  async newSession(
    request: AcpNewSessionRequest,
  ): Promise<AcpNewSessionResult> {
    return withAcpSpan('acp.session.start', async (span) => {
      const entry = this.requireEntry(request.sessionKey);
      span.setAttribute('acp.agent.name', entry.agentName);
      span.setAttribute(
        'principal.repository.telemetry_id',
        repositoryTelemetryId(entry.directory),
      );
      if (entry.sessionId) {
        span.setAttribute('acp.session.reused', true);
        return { sessionId: entry.sessionId };
      }

      const response = await entry.connection.agent.request(
        methods.agent.session.new,
        { cwd: entry.directory, mcpServers: [] },
      );
      entry.sessionId = response.sessionId;

      const modelOption = response.configOptions?.find(
        (option) => option.id === 'model',
      );
      if (
        !modelOption ||
        modelOption.type !== 'select' ||
        !modelOption.options.some(
          (option) => 'value' in option && option.value === DEFAULT_ACP_MODEL,
        )
      ) {
        throw new Error(
          `The configured OpenCode agent does not offer ${DEFAULT_ACP_MODEL}. ` +
            'Connect OpenCode Go and make sure this model is available.',
        );
      }

      await entry.connection.agent.request(
        methods.agent.session.setConfigOption,
        {
          sessionId: response.sessionId,
          configId: 'model',
          value: DEFAULT_ACP_MODEL,
        },
      );
      entry.sessionReady = true;

      span.setAttribute('acp.session.reused', false);
      log.info(
        `[ACP] Started session ${response.sessionId} in ${entry.directory}`,
      );
      return { sessionId: response.sessionId };
    });
  }

  async loadSession(
    request: AcpLoadSessionRequest,
  ): Promise<AcpNewSessionResult> {
    return withAcpSpan('acp.session.load', async (span) => {
      const entry = this.requireEntry(request.sessionKey);
      span.setAttribute('acp.agent.name', entry.agentName);
      span.setAttribute(
        'principal.repository.telemetry_id',
        repositoryTelemetryId(entry.directory),
      );
      if (entry.sessionId) {
        if (entry.sessionId !== request.sessionId) {
          throw new Error(
            'This ACP connection already has a different session loaded.',
          );
        }
        return { sessionId: entry.sessionId };
      }
      if (!entry.supportsLoadSession) {
        throw new Error(
          'This ACP agent does not support restoring saved sessions.',
        );
      }

      await entry.connection.agent.request(methods.agent.session.load, {
        sessionId: request.sessionId,
        cwd: entry.directory,
        mcpServers: [],
      });
      entry.sessionId = request.sessionId;
      entry.sessionReady = true;
      log.info(
        `[ACP] Restored session ${request.sessionId} in ${entry.directory}`,
      );
      return { sessionId: request.sessionId };
    });
  }

  async prompt(request: AcpPromptRequest): Promise<AcpPromptResult> {
    return withAcpSpan('acp.prompt', async (span) => {
      const entry = this.requireEntry(request.sessionKey);
      span.setAttribute('acp.agent.name', entry.agentName);
      span.setAttribute(
        'principal.repository.telemetry_id',
        repositoryTelemetryId(entry.directory),
      );
      if (!entry.sessionId || !entry.sessionReady) {
        throw new Error('Start an ACP session before sending a prompt.');
      }
      if (entry.activePrompt) {
        throw new Error('An ACP prompt is already in progress.');
      }

      const activePrompt = {
        span,
        updateCounts: new Map<string, number>(),
        permissionRequestCount: 0,
      };
      entry.activePrompt = activePrompt;
      try {
        const response = await entry.connection.agent.request(
          methods.agent.session.prompt,
          {
            sessionId: entry.sessionId,
            prompt: [{ type: 'text', text: request.text }],
          },
        );
        span.setAttribute('acp.prompt.stop_reason', response.stopReason);
        try {
          this.scheduleOpenCodeTitleLookup(entry, entry.sessionId);
        } catch (error) {
          // Title resolution is best-effort and must never fail a completed turn.
          span.setAttribute(
            'acp.title_lookup.schedule_error.type',
            error instanceof Error ? error.name : typeof error,
          );
        }
        return {
          stopReason: response.stopReason,
          sessionUpdates: Object.fromEntries(activePrompt.updateCounts),
        };
      } finally {
        for (const [updateType, count] of activePrompt.updateCounts) {
          span.setAttribute(`acp.session_update.${updateType}.count`, count);
        }
        span.setAttribute(
          'acp.permission.request_count',
          activePrompt.permissionRequestCount,
        );
        if (entry.activePrompt === activePrompt) entry.activePrompt = null;
      }
    });
  }

  async cancel(request: { sessionKey: string }): Promise<void> {
    return withAcpSpan('acp.prompt.cancel', async (span) => {
      const entry = this.entries.get(request.sessionKey);
      if (!entry || entry.closed || !entry.sessionId) return;

      span.setAttribute('acp.agent.name', entry.agentName);
      span.setAttribute(
        'principal.repository.telemetry_id',
        repositoryTelemetryId(entry.directory),
      );
      entry.activePrompt?.span.addEvent('acp.prompt.cancel_requested');
      this.cancelPendingPermissions(entry);
      await entry.connection.agent.notify(methods.agent.session.cancel, {
        sessionId: entry.sessionId,
      });
    });
  }

  async respondPermission(request: AcpRespondPermissionRequest): Promise<void> {
    return withAcpSpan('acp.permission.respond', async (span) => {
      const entry = this.entries.get(request.sessionKey);
      if (!entry) return;
      span.setAttribute('acp.agent.name', entry.agentName);
      span.setAttribute(
        'principal.repository.telemetry_id',
        repositoryTelemetryId(entry.directory),
      );

      const resolve = entry.pendingPermissions.get(request.requestId);
      if (!resolve) return;
      entry.pendingPermissions.delete(request.requestId);
      const outcome = request.optionId ? 'selected' : 'cancelled';
      span.setAttribute('acp.permission.outcome', outcome);
      resolve(
        request.optionId
          ? {
              outcome: { outcome: 'selected', optionId: request.optionId },
            }
          : cancelledPermission(),
      );
    });
  }

  async disconnect(request: { sessionKey: string }): Promise<void> {
    return withAcpSpan('acp.disconnect', async (span) => {
      const entry = this.entries.get(request.sessionKey);
      if (!entry) return;
      span.setAttribute('acp.agent.name', entry.agentName);
      span.setAttribute(
        'principal.repository.telemetry_id',
        repositoryTelemetryId(entry.directory),
      );
      this.closeEntry(entry, 'Disconnected');
    });
  }

  disposeAll(): void {
    for (const entry of [...this.entries.values()]) {
      this.closeEntry(entry, 'Application is shutting down');
    }
  }

  private requireEntry(sessionKey: string): AcpConnectionEntry {
    const entry = this.entries.get(sessionKey);
    if (!entry || entry.closed) {
      throw new Error('The ACP agent is not connected.');
    }
    return entry;
  }

  private attachLifecycle(entry: AcpConnectionEntry): void {
    if (!entry.webContents.isDestroyed()) {
      entry.webContents.once('destroyed', () =>
        this.closeEntry(entry, 'Window closed.'),
      );
    }

    entry.child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) log.warn(`[ACP:${entry.key}] ${text}`);
    });

    entry.child.on('error', (error) => {
      log.error(`[ACP] Agent process error for ${entry.key}:`, error);
      this.closeEntry(entry, errorMessage(error));
    });

    entry.child.on('exit', (code, signal) => {
      const reason =
        signal != null
          ? `Agent process exited (${signal}).`
          : `Agent process exited with code ${code ?? 'unknown'}.`;
      this.closeEntry(entry, reason);
    });

    void entry.connection.closed
      .then(() => this.closeEntry(entry, 'ACP connection closed.'))
      .catch((error) => this.closeEntry(entry, errorMessage(error)));
  }

  private handleSessionUpdate(
    entry: AcpConnectionEntry,
    notification: SessionNotification,
  ): void {
    if (entry.closed) return;
    if (entry.sessionId && notification.sessionId !== entry.sessionId) return;
    const updateType = notification.update.sessionUpdate;
    entry.lastActivityAt = Date.now();
    if (updateType === 'tool_call' || updateType === 'tool_call_update') {
      this.recordToolCallUpdate(entry, notification.update as ToolCallUpdate);
    }
    if (
      entry.agentId === 'opencode' &&
      entry.sessionId &&
      (updateType === 'tool_call' || updateType === 'tool_call_update')
    ) {
      const acpEvent: OpenCodeACPEventInput = {
        sessionId: notification.sessionId,
        workingDirectory: entry.directory,
        update: notification.update,
      };
      getEventServerManager().processACPEvent(acpEvent);
    }
    const sessionTitle =
      notification.update.sessionUpdate === 'session_info_update'
        ? notification.update.title
        : undefined;
    const activePrompt = entry.activePrompt;
    if (activePrompt) {
      activePrompt.updateCounts.set(
        updateType,
        (activePrompt.updateCounts.get(updateType) ?? 0) + 1,
      );
    }
    if (updateType === 'session_info_update' && sessionTitle !== undefined) {
      this.recordSessionTitleUpdate(entry, sessionTitle, 'acp_notification');
    }
    this.emit(entry, { type: 'update', update: notification.update });
  }

  private readonly handleToolProcessingResult = (
    result: ACPToolProcessingResultMessage,
  ): void => {
    const sessionResult: AcpToolProcessingResult = {
      sessionId: result.sessionId,
      toolCallId: result.toolCallId,
      outcome: result.outcome,
    };
    for (const entry of this.entries.values()) {
      if (
        entry.closed ||
        entry.agentId !== 'opencode' ||
        entry.sessionId !== result.sessionId
      ) {
        continue;
      }
      const toolCall = entry.toolCalls.get(result.toolCallId);
      const highlightPaths = [
        ...new Set([
          ...(toolCall?.highlightPaths ?? []),
          ...(result.highlightPaths ?? []),
        ]),
      ];
      if (toolCall) {
        entry.toolCalls.delete(result.toolCallId);
        entry.toolCalls.set(result.toolCallId, {
          ...toolCall,
          processing: result.outcome,
          highlightPaths,
          updatedAt: Date.now(),
        });
      }
      this.emit(entry, {
        type: 'tool-processing',
        result: { ...sessionResult, highlightPaths },
      });
    }
  };

  private recordToolCallUpdate(
    entry: AcpConnectionEntry,
    update: ToolCallUpdate,
  ): void {
    const previous = entry.toolCalls.get(update.toolCallId);
    const locations =
      update.locations == null && update.content == null
        ? previous?.locations
        : this.mergeToolLocations(
            update.locations ?? [],
            update.content,
            previous?.locations,
          );
    const next: AcpToolCallSummary = {
      toolCallId: update.toolCallId,
      title: update.title ?? previous?.title ?? 'Tool call',
      name: update.name ?? previous?.name,
      kind: update.kind ?? previous?.kind,
      status: update.status ?? previous?.status,
      locations,
      highlightPaths: previous?.highlightPaths,
      processing: previous?.processing,
      updatedAt: Date.now(),
    };
    entry.toolCalls.delete(update.toolCallId);
    entry.toolCalls.set(update.toolCallId, next);
    while (entry.toolCalls.size > 500) {
      const oldestId = entry.toolCalls.keys().next().value;
      if (oldestId === undefined) break;
      entry.toolCalls.delete(oldestId);
    }
  }

  private mergeToolLocations(
    locations: NonNullable<ToolCallUpdate['locations']>,
    content?: ToolCallContent[] | null,
    previous?: AcpToolCallSummary['locations'],
  ): AcpToolCallSummary['locations'] {
    const incoming = [
      ...locations.map(({ path, line }) => ({ path, line })),
      ...(content ?? []).flatMap((part) =>
        part.type === 'diff' ? [{ path: part.path, line: undefined }] : [],
      ),
    ];
    const unique = new Map<string, { path: string; line?: number | null }>();
    for (const location of [...(previous ?? []), ...incoming]) {
      unique.set(`${location.path}:${location.line ?? ''}`, location);
    }
    return [...unique.values()];
  }

  private scheduleOpenCodeTitleLookup(
    entry: AcpConnectionEntry,
    sessionId: string | null,
  ): void {
    if (
      !sessionId ||
      entry.agentName !== 'OpenCode' ||
      entry.sessionTitle ||
      entry.titleLookupStarted
    ) {
      return;
    }

    entry.titleLookupStarted = true;
    void this.lookupOpenCodeSessionTitle(entry, sessionId).catch((error) => {
      entry.titleLookupStarted = false;
      log.debug(
        `[ACP] OpenCode title lookup failed (${error instanceof Error ? error.name : typeof error})`,
      );
    });
  }

  private async lookupOpenCodeSessionTitle(
    entry: AcpConnectionEntry,
    sessionId: string,
  ): Promise<void> {
    try {
      for (let attempt = 0; attempt < TITLE_LOOKUP_ATTEMPTS; attempt += 1) {
        await delay(TITLE_LOOKUP_INTERVAL_MS);
        if (
          entry.closed ||
          entry.sessionId !== sessionId ||
          entry.sessionTitle
        ) {
          return;
        }

        try {
          const target = await openCodeSessionHistoryService.getResumeTarget(
            entry.directory,
            sessionId,
          );
          const title = target.title.trim();
          if (title && title !== 'Untitled session') {
            if (
              !entry.closed &&
              entry.sessionId === sessionId &&
              !entry.sessionTitle
            ) {
              this.recordSessionTitleUpdate(
                entry,
                title,
                'opencode_session_history',
              );
              this.emit(entry, {
                type: 'update',
                update: { sessionUpdate: 'session_info_update', title },
              });
            }
            return;
          }
        } catch {
          // OpenCode may not have committed its generated title yet. Retry a
          // few times; ACP itself remains usable if history lookup is absent.
        }
      }
    } finally {
      if (entry.sessionId === sessionId) entry.titleLookupStarted = false;
    }
  }

  private recordSessionTitleUpdate(
    entry: AcpConnectionEntry,
    title: string | null,
    source: 'acp_notification' | 'opencode_session_history',
  ): void {
    entry.sessionTitle = title;
    const span = tracer.startSpan('acp.session.title_updated', {
      attributes: {
        'acp.agent.name': entry.agentName,
        'acp.session.title.present': Boolean(title?.trim()),
        'acp.session.title.source': source,
        'principal.repository.telemetry_id': repositoryTelemetryId(
          entry.directory,
        ),
      },
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  private handlePermissionRequest(
    entry: AcpConnectionEntry,
    request: RequestPermissionRequest,
    signal: AbortSignal,
  ): Promise<RequestPermissionResponse> {
    if (entry.closed) {
      return Promise.resolve(cancelledPermission());
    }

    const requestId = randomUUID();
    if (entry.activePrompt) {
      entry.activePrompt.permissionRequestCount += 1;
      entry.activePrompt.span.addEvent('acp.permission.requested');
    }
    return new Promise<RequestPermissionResponse>((resolve) => {
      const finish = (response: RequestPermissionResponse) => {
        if (!entry.pendingPermissions.delete(requestId)) return;
        resolve(response);
      };

      entry.pendingPermissions.set(requestId, finish);
      signal.addEventListener('abort', () => finish(cancelledPermission()), {
        once: true,
      });

      this.emit(entry, { type: 'permission', requestId, request });
    });
  }

  private cancelPendingPermissions(entry: AcpConnectionEntry): void {
    for (const resolve of entry.pendingPermissions.values()) {
      resolve(cancelledPermission());
    }
    entry.pendingPermissions.clear();
  }

  private emit(entry: AcpConnectionEntry, event: AcpSessionEvent): void {
    if (entry.webContents.isDestroyed()) return;
    const envelope: AcpSessionEventEnvelope = {
      sessionKey: entry.key,
      event,
    };
    entry.webContents.send(AcpAPIEvent.SESSION_EVENT, envelope);
  }

  private closeEntry(entry: AcpConnectionEntry, reason: string): void {
    if (entry.closed) return;
    entry.closed = true;
    this.entries.delete(entry.key);
    this.cancelPendingPermissions(entry);

    try {
      entry.connection.close(new Error(reason));
    } catch {
      // The connection may already be closed.
    }

    try {
      entry.child.kill();
    } catch {
      // The process may already be gone.
    }

    this.emit(entry, { type: 'closed', reason });
  }
}

let service: AcpService | null = null;

export function getAcpService(): AcpService {
  if (!service) service = new AcpService();
  return service;
}
