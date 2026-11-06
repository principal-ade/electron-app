import { ipcRenderer } from 'electron';
import {
  CursorSessionHistoryEvents,
  type CursorSessionHistoryAPI,
} from '../../shared/main-process-api-interfaces/CursorSessionHistoryAPI';

export const cursorSessionHistoryAPI: CursorSessionHistoryAPI = {
  list: () => ipcRenderer.invoke(CursorSessionHistoryEvents.LIST),
  search: (query) =>
    ipcRenderer.invoke(CursorSessionHistoryEvents.SEARCH, query),
  resume: (directory, sessionId) =>
    ipcRenderer.invoke(CursorSessionHistoryEvents.RESUME, directory, sessionId),
};
