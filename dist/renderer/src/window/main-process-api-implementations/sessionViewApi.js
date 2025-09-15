import { ipcRenderer } from 'electron';
import { SessionViewEvent } from '../../shared/ipc-events/SessionViewEvents';
export const sessionViewApi = {
    async getSessionView(sessionId) {
        return await ipcRenderer.invoke(SessionViewEvent.GET_VIEW, sessionId);
    },
    async getSegment(sessionId, segmentId) {
        return await ipcRenderer.invoke(SessionViewEvent.GET_SEGMENT, sessionId, segmentId);
    },
    async getStatistics(sessionId) {
        return await ipcRenderer.invoke(SessionViewEvent.GET_STATISTICS, sessionId);
    },
};
