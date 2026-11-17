/**
 * Agent Client Protocol (ACP) bridge contract.
 *
 * The main process owns the child agent process and the JSON-RPC connection;
 * the renderer only starts/controls a session and consumes typed events. The
 * protocol payload types come from `@agentclientprotocol/sdk` (type-only, so
 * nothing from the SDK is pulled into the renderer bundle by this module).
 */
import type {
  RequestPermissionRequest,
  SessionConfigOption,
  SessionUpdate,
  ToolCallLocation,
} from '@agentclientprotocol/sdk';

export enum AcpAPIEvent {
  CONNECT = 'acp:connect',
  NEW_SESSION = 'acp:new-session',
  LOAD_SESSION = 'acp:load-session',
  SET_MODEL = 'acp:set-model',
  SET_SESSION_ARTIFACTS = 'acp:set-session-artifacts',
  PROMPT = 'acp:prompt',
  CANCEL = 'acp:cancel',
  RESPOND_PERMISSION = 'acp:respond-permission',
  DISCONNECT = 'acp:disconnect',
  SESSION_EVENT = 'acp:session-event',
}

export type AcpAgentId = 'opencode' | 'claude' | 'codex' | 'cursor';

export interface AcpAgentDefinition {
  id: AcpAgentId;
  name: string;
  description: string;
  /** Human-readable launch command, for display only. */
  command: string;
  /** Executable to spawn. */
  executable: string;
  /** Arguments passed to {@link executable}. */
  args: string[];
  monogram: string;
  /** CSS modifier suffix used by the setup UI. */
  className: string;
}

export const ACP_AGENTS: ReadonlyArray<AcpAgentDefinition> = [
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding agent',
    command: 'opencode acp',
    executable: 'opencode',
    args: ['acp'],
    monogram: 'OC',
    className: 'opencode',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    description: 'Anthropic coding agent',
    command: 'npx @agentclientprotocol/claude-agent-acp@latest',
    executable: 'npx',
    args: ['-y', '@agentclientprotocol/claude-agent-acp@latest'],
    monogram: 'C',
    className: 'claude',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    description: 'OpenAI coding agent',
    command: 'npx @zed-industries/codex-acp@latest',
    executable: 'npx',
    args: ['-y', '@zed-industries/codex-acp@latest'],
    monogram: 'CX',
    className: 'codex',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    description: 'Cursor coding agent',
    command: 'agent acp',
    executable: 'agent',
    args: ['acp'],
    monogram: 'C',
    className: 'cursor',
  },
];

export const DEFAULT_ACP_AGENT: AcpAgentId = 'opencode';

/** Default model for ACP sessions created by Principal. */
export const DEFAULT_ACP_MODEL = 'opencode-go/deepseek-v4.1-flash';

export function getAcpAgent(id: AcpAgentId): AcpAgentDefinition {
  return ACP_AGENTS.find((agent) => agent.id === id) ?? ACP_AGENTS[0];
}

export interface AcpConnectRequest {
  /** Stable per-tab identity; also the key used for all later commands. */
  sessionKey: string;
  /** Absolute directory the agent session is scoped to. */
  directory: string;
  agent: AcpAgentId;
}

export interface AcpConnectResult {
  protocolVersion: number;
  agentName?: string;
  agentVersion?: string;
}

export interface AcpModelOption {
  /** Value passed back to the agent, in `provider/model` form. */
  value: string;
  /** Display name with the provider prefix removed. */
  name: string;
  description?: string;
  /** Provider id derived from the value prefix (e.g. `opencode-go`). */
  provider: string;
}

/** Model picker state advertised by the agent in `session/new`. */
export interface AcpModelSelection {
  currentValue: string;
  options: AcpModelOption[];
}

/**
 * Extract the model picker state from ACP session config options.
 *
 * OpenCode advertises a `model` select alongside `effort` and `mode`. Options
 * can be a flat list or provider groups, so both shapes are flattened here.
 */
export function normalizeAcpModelSelection(
  configOptions: ReadonlyArray<SessionConfigOption> | null | undefined,
): AcpModelSelection | undefined {
  const model = configOptions?.find((option) => option.id === 'model');
  if (!model || model.type !== 'select') return undefined;

  const options = model.options.flatMap((option) =>
    'value' in option ? [option] : option.options,
  );
  return {
    currentValue: model.currentValue,
    options: options.map((option) => {
      const slash = option.value.indexOf('/');
      const provider = slash > 0 ? option.value.slice(0, slash) : option.value;
      const prefix = `${provider}/`;
      return {
        value: option.value,
        name: option.name.startsWith(prefix)
          ? option.name.slice(prefix.length)
          : option.name,
        description: option.description ?? undefined,
        provider,
      };
    }),
  };
}

export interface AcpNewSessionRequest {
  sessionKey: string;
  /** Model to select after creating the session, in `provider/model` form. */
  model?: string;
}

export interface AcpLoadSessionRequest extends AcpNewSessionRequest {
  sessionId: string;
}

export interface AcpNewSessionResult {
  sessionId: string;
  /** Present when the agent advertises a model config option. */
  model?: AcpModelSelection;
  /**
   * Artifacts the user attached to this ACP session. Associations are scoped to
   * the agent session id, so reopening the same session restores them.
   */
  artifacts?: AcpArtifactAssociation[];
}

export interface AcpSetModelRequest {
  sessionKey: string;
  model: string;
}

export interface AcpSetModelResult {
  model: AcpModelSelection;
}

/**
 * Replace the artifacts associated with a live ACP session. Associations are
 * persisted per agent+session id, so a later `session/load` restores them.
 */
export interface AcpSetSessionArtifactsRequest {
  sessionKey: string;
  artifacts: AcpArtifactAssociation[];
}

export interface AcpSetSessionArtifactsResult {
  artifacts: AcpArtifactAssociation[];
}

export interface AcpPromptRequest {
  sessionKey: string;
  text: string;
  /**
   * Artifacts the user attached to this message for one turn. Persistent
   * session artifacts are resolved by the main process; these are staged in
   * the composer and cleared after the prompt is sent.
   */
  stagedArtifacts?: AcpArtifactAssociation[];
}

export interface AcpPromptResult {
  stopReason: string;
  /** Counts only; session update content is intentionally not summarized here. */
  sessionUpdates?: Record<string, number>;
}

export interface AcpCancelRequest {
  sessionKey: string;
}

export interface AcpRespondPermissionRequest {
  sessionKey: string;
  requestId: string;
  /** Selected option, or null to answer the request as cancelled. */
  optionId: string | null;
}

export interface AcpDisconnectRequest {
  sessionKey: string;
}

export type AcpToolProcessingOutcome =
  | 'highlighted'
  | 'already-highlighted'
  | 'no-file-paths'
  | 'no-repository'
  | 'unavailable'
  | 'failed';

/**
 * What the agent was doing to a highlighted file. Rendered as a distinct layer
 * color/render strategy so the city reads as activity, not just a file list.
 */
export type AcpFileOperation =
  | 'read'
  | 'write'
  | 'create'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'list'
  | 'execute';

export interface AcpHighlightItem {
  /** Repository-relative path. */
  path: string;
  operation: AcpFileOperation;
  /** How the path should be treated by the File City layer system. */
  kind?: 'file' | 'directory';
}

export interface AcpToolProcessingResult {
  sessionId: string;
  toolCallId: string;
  outcome: AcpToolProcessingOutcome;
  highlightPaths?: string[];
  /**
   * Per-path intent. `highlightPaths` stays for older renderers/consumers; new
   * ones should prefer this when present.
   */
  highlightItems?: AcpHighlightItem[];
}

export interface AcpToolCallSummary {
  toolCallId: string;
  title: string;
  name?: string;
  kind?: string;
  status?: string;
  locations?: ToolCallLocation[];
  highlightPaths?: string[];
  highlightItems?: AcpHighlightItem[];
  processing?: AcpToolProcessingOutcome;
  updatedAt: number;
}

export interface AcpActiveSessionSummary {
  sessionId: string;
  agentId: AcpAgentId;
  agentName: string;
  directory: string;
  isPrompting: boolean;
  toolCallCount: number;
  lastActivityAt?: number;
}

/** App artifact kinds an ACP agent can associate with its session. */
export type AcpArtifactKind = 'topic' | 'subsystem-model' | 'drawing';

/**
 * An artifact associated with an ACP session, either by the agent (a tool call
 * to the bridge route) or by the user (dragged from a side panel). User
 * associations are persisted per agent session id and re-sent as context on
 * every prompt.
 */
export interface AcpArtifactAssociation {
  kind: AcpArtifactKind;
  id: string;
  title?: string;
}

export type AcpSessionEvent =
  | { type: 'update'; update: SessionUpdate }
  | {
      type: 'permission';
      requestId: string;
      request: RequestPermissionRequest;
    }
  | { type: 'tool-processing'; result: AcpToolProcessingResult }
  | { type: 'closed'; reason?: string };

export interface AcpSessionEventEnvelope {
  sessionKey: string;
  event: AcpSessionEvent;
}

export interface AcpAPI {
  connect(request: AcpConnectRequest): Promise<AcpConnectResult>;
  newSession(request: AcpNewSessionRequest): Promise<AcpNewSessionResult>;
  loadSession(request: AcpLoadSessionRequest): Promise<AcpNewSessionResult>;
  setModel(request: AcpSetModelRequest): Promise<AcpSetModelResult>;
  setSessionArtifacts(
    request: AcpSetSessionArtifactsRequest,
  ): Promise<AcpSetSessionArtifactsResult>;
  prompt(request: AcpPromptRequest): Promise<AcpPromptResult>;
  cancel(request: AcpCancelRequest): Promise<void>;
  respondPermission(request: AcpRespondPermissionRequest): Promise<void>;
  disconnect(request: AcpDisconnectRequest): Promise<void>;
  onSessionEvent(
    callback: (envelope: AcpSessionEventEnvelope) => void,
  ): () => void;
}
