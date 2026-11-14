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
import { app as electronApp } from 'electron';
import log from 'electron-log';
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
} from '@agentclientprotocol/sdk';
import {
  AcpAPIEvent,
  DEFAULT_ACP_MODEL,
  getAcpAgent,
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
import { getProcessPath } from '../utils/processPath';

interface AcpConnectionEntry {
  key: string;
  directory: string;
  webContents: Electron.WebContents;
  child: ChildProcessWithoutNullStreams;
  app: ClientApp;
  connection: ClientConnection;
  sessionId: string | null;
  pendingPermissions: Map<
    string,
    (response: RequestPermissionResponse) => void
  >;
  closed: boolean;
  supportsLoadSession: boolean;
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

class AcpService {
  private readonly entries = new Map<string, AcpConnectionEntry>();

  async connect(
    request: AcpConnectRequest,
    webContents: Electron.WebContents,
  ): Promise<AcpConnectResult> {
    // Replacing an existing connection for the same tab is intentional: the
    // renderer may reconnect after an error without having to know whether a
    // previous process survived.
    await this.disconnect({ sessionKey: request.sessionKey });

    const agent = getAcpAgent(request.agent);
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
      directory: request.directory,
      webContents,
      child,
      app: acpClient,
      connection: undefined as unknown as ClientConnection,
      sessionId: null,
      pendingPermissions: new Map(),
      closed: false,
      supportsLoadSession: false,
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
  }

  async newSession(
    request: AcpNewSessionRequest,
  ): Promise<AcpNewSessionResult> {
    const entry = this.requireEntry(request.sessionKey);
    if (entry.sessionId) {
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
        (option) =>
          'value' in option && option.value === DEFAULT_ACP_MODEL,
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

    log.info(`[ACP] Started session ${response.sessionId} in ${entry.directory}`);
    return { sessionId: response.sessionId };
  }

  async loadSession(
    request: AcpLoadSessionRequest,
  ): Promise<AcpNewSessionResult> {
    const entry = this.requireEntry(request.sessionKey);
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
    log.info(
      `[ACP] Restored session ${request.sessionId} in ${entry.directory}`,
    );
    return { sessionId: request.sessionId };
  }

  async prompt(request: AcpPromptRequest): Promise<AcpPromptResult> {
    const entry = this.requireEntry(request.sessionKey);
    if (!entry.sessionId) {
      throw new Error('Start an ACP session before sending a prompt.');
    }

    const response = await entry.connection.agent.request(
      methods.agent.session.prompt,
      {
        sessionId: entry.sessionId,
        prompt: [{ type: 'text', text: request.text }],
      },
    );
    return { stopReason: response.stopReason };
  }

  async cancel(request: { sessionKey: string }): Promise<void> {
    const entry = this.entries.get(request.sessionKey);
    if (!entry || entry.closed || !entry.sessionId) return;

    this.cancelPendingPermissions(entry);
    await entry.connection.agent.notify(methods.agent.session.cancel, {
      sessionId: entry.sessionId,
    });
  }

  async respondPermission(
    request: AcpRespondPermissionRequest,
  ): Promise<void> {
    const entry = this.entries.get(request.sessionKey);
    if (!entry) return;

    const resolve = entry.pendingPermissions.get(request.requestId);
    if (!resolve) return;
    entry.pendingPermissions.delete(request.requestId);
    resolve(
      request.optionId
        ? {
            outcome: { outcome: 'selected', optionId: request.optionId },
          }
        : cancelledPermission(),
    );
  }

  async disconnect(request: { sessionKey: string }): Promise<void> {
    const entry = this.entries.get(request.sessionKey);
    if (!entry) return;
    this.closeEntry(entry, 'Disconnected');
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
    this.emit(entry, { type: 'update', update: notification.update });
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
    return new Promise<RequestPermissionResponse>((resolve) => {
      const finish = (response: RequestPermissionResponse) => {
        if (!entry.pendingPermissions.delete(requestId)) return;
        resolve(response);
      };

      entry.pendingPermissions.set(requestId, finish);
      signal.addEventListener(
        'abort',
        () => finish(cancelledPermission()),
        { once: true },
      );

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
