/**
 * Window IPC channel enums
 * Shared between main and renderer processes
 */

export enum WindowEvent {
  OPEN_STORE_VIEWER = 'window:open-store-viewer',
  OPEN_LOCAL_FILES = 'window:open-local-files',
  OPEN_REMOTE_FILES = 'window:open-remote-files',
  OPEN_REPOSITORY_DASHBOARD = 'window:open-repository-dashboard',
  OPEN_MARKDOWN_FILE_DIALOG = 'window:open-markdown-file-dialog',
  OPEN_SESSION_DETAILS = 'window:open-session-details',
}
