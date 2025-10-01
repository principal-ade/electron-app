import { RemoteAgentConfig, RemoteAgentWindowOptions, RemoteAgentWindowState, RemoteAgentMessage } from '../types/remoteAgent.types';

export enum RemoteAgentWindowEvent {
  OPEN_REMOTE_AGENT = 'remote-agent:open',
  CLOSE_REMOTE_AGENT = 'remote-agent:close',
  FOCUS_REMOTE_AGENT = 'remote-agent:focus',
  SWITCH_TO_AGENT = 'remote-agent:switch',
  LIST_REMOTE_AGENTS = 'remote-agent:list',
  GET_REMOTE_AGENT_STATE = 'remote-agent:get-state',
  GET_ACTIVE_AGENT_ID = 'remote-agent:get-active',
  REMOTE_AGENT_STATE_CHANGED = 'remote-agent:state-changed',
  REMOTE_AGENT_MESSAGE = 'remote-agent:message',
  REMOTE_AGENT_LIST_CHANGED = 'remote-agent:list-changed',
  REMOTE_AGENT_ACTIVE_CHANGED = 'remote-agent:active-changed',
  SEND_MESSAGE_TO_REMOTE_AGENT = 'remote-agent:send-message',
}

export interface RemoteAgentWindowAPI {
  openRemoteAgent: (config: RemoteAgentConfig, options?: RemoteAgentWindowOptions) => Promise<string>;
  closeRemoteAgent: (agentId: string) => Promise<void>;
  focusRemoteAgent: (agentId: string) => Promise<void>;
  switchToAgent: (agentId: string) => Promise<void>;
  listRemoteAgents: () => Promise<RemoteAgentConfig[]>;
  getActiveAgentId: () => Promise<string | null>;
  getRemoteAgentState: (agentId: string) => Promise<RemoteAgentWindowState>;
  sendMessageToRemoteAgent: (agentId: string, message: RemoteAgentMessage) => Promise<void>;
  onRemoteAgentStateChanged: (callback: (agentId: string, state: RemoteAgentWindowState) => void) => () => void;
  onRemoteAgentMessage: (callback: (agentId: string, message: RemoteAgentMessage) => void) => () => void;
  onRemoteAgentListChanged: (callback: (agents: RemoteAgentConfig[], activeAgentId: string | null) => void) => () => void;
  onRemoteAgentActiveChanged: (callback: (agentId: string) => void) => () => void;
}