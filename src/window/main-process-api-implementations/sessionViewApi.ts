import { ipcRenderer } from 'electron';
import type { SessionViewAPI, SessionViewResult } from '../../shared/main-process-api-interfaces/SessionViewAPI';
import type { SessionView, SessionSegment } from '../../shared/sessionViewTypes';
import { SessionViewEvent } from '../../shared/ipc-events/SessionViewEvents';

export const sessionViewApi: SessionViewAPI = {
  async getSessionView(sessionId: string): Promise<SessionViewResult<SessionView>> {
    return await ipcRenderer.invoke(SessionViewEvent.GET_VIEW, sessionId);
  },

  async getSegment(sessionId: string, segmentId: string): Promise<SessionViewResult<SessionSegment>> {
    return await ipcRenderer.invoke(SessionViewEvent.GET_SEGMENT, sessionId, segmentId);
  },

  async getStatistics(sessionId: string) {
    return await ipcRenderer.invoke(SessionViewEvent.GET_STATISTICS, sessionId);
  },
};