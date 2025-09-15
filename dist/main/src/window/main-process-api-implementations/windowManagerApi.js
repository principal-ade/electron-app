import { ipcRenderer } from 'electron';
import { WindowManagerAPIEvent } from '../../shared/main-process-api-interfaces/WindowManagerAPI';
export const windowManagerAPI = {
    setFullScreen: (flag) => {
        ipcRenderer.send(WindowManagerAPIEvent.SET_FULLSCREEN, flag);
    },
    onFullscreenChanged: (callback) => {
        ipcRenderer.on(WindowManagerAPIEvent.ON_FULLSCREEN_CHANGED, (event, isFullscreen) => callback(isFullscreen));
    },
    removeFullscreenChangedListener: () => {
        ipcRenderer.removeAllListeners(WindowManagerAPIEvent.REMOVE_FULLSCREEN_CHANGED_LISTENER);
    },
};
