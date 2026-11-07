/** Renderer-facing service for local coding-agent session history. */
export class SessionHistoryService {
  static openCode = {
    listProjects: (directories: string[]) =>
      window.mainProcess.openCodeSessionHistory.listProjects(directories),
    searchProjects: (directories: string[], query: string) =>
      window.mainProcess.openCodeSessionHistory.searchProjects(
        directories,
        query,
      ),
    resume: (directory: string, sessionId: string) =>
      window.mainProcess.openCodeSessionHistory.resume(directory, sessionId),
  };

  static claude = {
    list: () => window.mainProcess.claudeSessionHistory.list(),
    search: (query: string) =>
      window.mainProcess.claudeSessionHistory.search(query),
    resume: (directory: string, sessionId: string) =>
      window.mainProcess.claudeSessionHistory.resume(directory, sessionId),
  };

  static cursor = {
    list: () => window.mainProcess.cursorSessionHistory.list(),
    search: (query: string) =>
      window.mainProcess.cursorSessionHistory.search(query),
    resume: (directory: string, sessionId: string) =>
      window.mainProcess.cursorSessionHistory.resume(directory, sessionId),
  };
}
