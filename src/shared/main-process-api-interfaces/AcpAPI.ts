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
  SessionUpdate,
} from '@agentclientprotocol/sdk';

export enum AcpAPIEvent {
  CONNECT = 'acp:connect',
  NEW_SESSION = 'acp:new-session',
  LOAD_SESSION = 'acp:load-session',
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

export interface AcpNewSessionRequest {
  sessionKey: string;
}

export interface AcpLoadSessionRequest extends AcpNewSessionRequest {
  sessionId: string;
}

export interface AcpNewSessionResult {
  sessionId: string;
}

export interface AcpPromptRequest {
  sessionKey: string;
  text: string;
}

export interface AcpPromptResult {
  stopReason: string;
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

export type AcpSessionEvent =
  | { type: 'update'; update: SessionUpdate }
  | {
      type: 'permission';
      requestId: string;
      request: RequestPermissionRequest;
    }
  | { type: 'closed'; reason?: string };

export interface AcpSessionEventEnvelope {
  sessionKey: string;
  event: AcpSessionEvent;
}

export interface AcpAPI {
  connect(request: AcpConnectRequest): Promise<AcpConnectResult>;
  newSession(request: AcpNewSessionRequest): Promise<AcpNewSessionResult>;
  loadSession(request: AcpLoadSessionRequest): Promise<AcpNewSessionResult>;
  prompt(request: AcpPromptRequest): Promise<AcpPromptResult>;
  cancel(request: AcpCancelRequest): Promise<void>;
  respondPermission(request: AcpRespondPermissionRequest): Promise<void>;
  disconnect(request: AcpDisconnectRequest): Promise<void>;
  onSessionEvent(
    callback: (envelope: AcpSessionEventEnvelope) => void,
  ): () => void;
}
