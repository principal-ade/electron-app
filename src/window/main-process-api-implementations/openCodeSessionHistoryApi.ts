import { ipcRenderer } from 'electron';
import {
  OpenCodeSessionHistoryEvents,
  type OpenCodeSessionHistoryAPI,
} from '../../shared/main-process-api-interfaces/OpenCodeSessionHistoryAPI';

export const openCodeSessionHistoryAPI: OpenCodeSessionHistoryAPI = {
  list: (directory) =>
    ipcRenderer.invoke(OpenCodeSessionHistoryEvents.LIST, directory),
  listProjects: (directories) =>
    ipcRenderer.invoke(OpenCodeSessionHistoryEvents.LIST_PROJECTS, directories),
  search: (directory, query) =>
    ipcRenderer.invoke(OpenCodeSessionHistoryEvents.SEARCH, directory, query),
  searchProjects: (directories, query) =>
    ipcRenderer.invoke(
      OpenCodeSessionHistoryEvents.SEARCH_PROJECTS,
      directories,
      query,
    ),
  getResumeTarget: (directory, sessionId) =>
    ipcRenderer.invoke(
      OpenCodeSessionHistoryEvents.RESUME_TARGET,
      directory,
      sessionId,
    ),
  resume: (directory, sessionId, tabId) =>
    tabId
      ? ipcRenderer.invoke(
          OpenCodeSessionHistoryEvents.RESUME,
          directory,
          sessionId,
          tabId,
        )
      : ipcRenderer.invoke(
          OpenCodeSessionHistoryEvents.RESUME,
          directory,
          sessionId,
        ),
};
