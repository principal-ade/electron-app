import { ipcRenderer } from 'electron';
import { WindowManagerAPI, WindowManagerAPIEvent } from '../../shared/main-process-api-interfaces/WindowManagerAPI';

export const windowManagerAPI: WindowManagerAPI = {
  setFullScreen: (flag: boolean) => {
    ipcRenderer.send(WindowManagerAPIEvent.SET_FULLSCREEN, flag);
  },
  onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => {
    ipcRenderer.on(
      WindowManagerAPIEvent.ON_FULLSCREEN_CHANGED,
      (event, isFullscreen: boolean) => callback(isFullscreen),
    );
  },
  removeFullscreenChangedListener: () => {
    ipcRenderer.removeAllListeners(
      WindowManagerAPIEvent.REMOVE_FULLSCREEN_CHANGED_LISTENER,
    );
  },
};
