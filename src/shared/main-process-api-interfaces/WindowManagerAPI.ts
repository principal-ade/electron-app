export enum WindowManagerAPIEvent {
  SET_FULLSCREEN = 'window-manager:set-fullscreen',
  ON_FULLSCREEN_CHANGED = 'window-manager:on-fullscreen-changed',
  REMOVE_FULLSCREEN_CHANGED_LISTENER = 'window-manager:remove-fullscreen-changed-listener',
}

export interface WindowManagerAPI {
  setFullScreen: (flag: boolean) => void;
  onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => void;
  removeFullscreenChangedListener: () => void;
}
