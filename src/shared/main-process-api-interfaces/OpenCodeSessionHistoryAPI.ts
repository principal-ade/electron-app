export interface OpenCodeSessionSummary {
  id: string;
  title: string;
  directory: string;
  createdAt: number;
  updatedAt: number;
}

export interface OpenCodeResumeTarget {
  cwd: string;
  title: string;
  executable: 'opencode';
  args: ['--session', string];
}

export enum OpenCodeSessionHistoryEvents {
  LIST = 'opencode-session-history:list',
  LIST_PROJECTS = 'opencode-session-history:list-projects',
  SEARCH = 'opencode-session-history:search',
  SEARCH_PROJECTS = 'opencode-session-history:search-projects',
  RESUME_TARGET = 'opencode-session-history:resume-target',
  RESUME = 'opencode-session-history:resume',
}

export interface OpenCodeSessionHistoryAPI {
  list(directory: string): Promise<OpenCodeSessionSummary[]>;
  listProjects(directories: string[]): Promise<OpenCodeSessionSummary[]>;
  search(directory: string, query: string): Promise<OpenCodeSessionSummary[]>;
  searchProjects(
    directories: string[],
    query: string,
  ): Promise<OpenCodeSessionSummary[]>;
  getResumeTarget(
    directory: string,
    sessionId: string,
  ): Promise<OpenCodeResumeTarget>;
  resume(directory: string, sessionId: string): Promise<void>;
}
