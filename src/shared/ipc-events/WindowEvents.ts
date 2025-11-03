/**
 * Window IPC channel enums
 * Shared between main and renderer processes
 */

export enum WindowEvent {
  OPEN_STORE_VIEWER = 'window:open-store-viewer',
  OPEN_LOCAL_FILES = 'window:open-local-files',
  OPEN_REMOTE_FILES = 'window:open-remote-files',
  OPEN_REPOSITORY_DASHBOARD = 'window:open-repository-dashboard',
  // Open a markdown viewer for a specific file path (no dialog)
  OPEN_MARKDOWN_VIEW = 'window:open-markdown-view',
  // Open the markdown file selection dialog (existing)
  OPEN_MARKDOWN_FILE_DIALOG = 'window:open-markdown-file-dialog',
  OPEN_CALLIMACHUS_WINDOW = 'window:open-callimachus',
  OPEN_PALACE_ROOM_WORKSPACE = 'window:open-palace-room-workspace',
  TOGGLE_MAIN_WINDOW_MINIMIZE = 'window:toggle-main-window-minimize',
  MAIN_WINDOW_MINIMIZE_STATE_CHANGED = 'window:main-window-minimize-state-changed',
  GET_WINDOW_ID = 'window:get-window-id',
  IS_REPOSITORY_WINDOW_OPEN = 'window:is-repository-window-open',
  REPOSITORY_WINDOWS_CHANGED = 'window:repository-windows-changed',
}
