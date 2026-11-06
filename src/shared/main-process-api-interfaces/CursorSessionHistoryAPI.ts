export interface CursorSessionSummary {
  id: string;
  title: string;
  directory: string;
  createdAt: number;
  updatedAt: number;
  resumable: boolean;
}

export enum CursorSessionHistoryEvents {
  LIST = 'cursor-session-history:list',
  SEARCH = 'cursor-session-history:search',
  RESUME = 'cursor-session-history:resume',
}

export interface CursorSessionHistoryAPI {
  list(): Promise<CursorSessionSummary[]>;
  search(query: string): Promise<CursorSessionSummary[]>;
  resume(directory: string, sessionId: string): Promise<void>;
}
