import { RemoteAgentConfig, RemoteAgentWindowOptions, RemoteAgentWindowState } from '../types/remoteAgent.types';

export enum RemoteAgentWindowEvent {
  OPEN_REMOTE_AGENT = 'remote-agent:open',
  CLOSE_REMOTE_AGENT = 'remote-agent:close',
  FOCUS_REMOTE_AGENT = 'remote-agent:focus',
  LIST_REMOTE_AGENTS = 'remote-agent:list',
  GET_REMOTE_AGENT_STATE = 'remote-agent:get-state',
  REMOTE_AGENT_STATE_CHANGED = 'remote-agent:state-changed',
  REMOTE_AGENT_MESSAGE = 'remote-agent:message',
  SEND_MESSAGE_TO_REMOTE_AGENT = 'remote-agent:send-message',
}

export interface RemoteAgentWindowAPI {
  openRemoteAgent: (config: RemoteAgentConfig, options?: RemoteAgentWindowOptions) => Promise<string>;
  closeRemoteAgent: (agentId: string) => Promise<void>;
  focusRemoteAgent: (agentId: string) => Promise<void>;
  listRemoteAgents: () => Promise<RemoteAgentConfig[]>;
  getRemoteAgentState: (agentId: string) => Promise<RemoteAgentWindowState>;
  sendMessageToRemoteAgent: (agentId: string, message: any) => Promise<void>;
  onRemoteAgentStateChanged: (callback: (agentId: string, state: RemoteAgentWindowState) => void) => () => void;
  onRemoteAgentMessage: (callback: (agentId: string, message: any) => void) => () => void;
}