export interface ClaudeSessionSummary {
  id: string;
  title: string;
  directory: string;
  createdAt: number;
  updatedAt: number;
}

export enum ClaudeSessionHistoryEvents {
  LIST = 'claude-session-history:list',
  SEARCH = 'claude-session-history:search',
  RESUME = 'claude-session-history:resume',
}

export interface ClaudeSessionHistoryAPI {
  list(): Promise<ClaudeSessionSummary[]>;
  search(query: string): Promise<ClaudeSessionSummary[]>;
  resume(directory: string, sessionId: string): Promise<ClaudeSessionSummary>;
}
