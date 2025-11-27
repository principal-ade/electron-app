/**
 * Window IPC channel enums
 * Shared between main and renderer processes
 */

export enum WindowEvent {
  OPEN_STORE_VIEWER = 'window:open-store-viewer',
  OPEN_LOCAL_FILES = 'window:open-local-files',
  OPEN_REMOTE_FILES = 'window:open-remote-files',
  OPEN_REPOSITORY_DASHBOARD = 'window:open-repository-dashboard',
  // Open the dev-workspace window (panel framework)
  OPEN_DEV_WORKSPACE = 'window:open-dev-workspace',
  // Open a markdown viewer for a specific file path (no dialog)
  OPEN_MARKDOWN_VIEW = 'window:open-markdown-view',
  // Open a markdown viewer with a relative path from repository
  OPEN_MARKDOWN_VIEW_FROM_REPOSITORY = 'window:open-markdown-view-from-repository',
  // Open the markdown file selection dialog (existing)
  OPEN_MARKDOWN_FILE_DIALOG = 'window:open-markdown-file-dialog',
  OPEN_CALLIMACHUS_WINDOW = 'window:open-callimachus',
  OPEN_ALEXANDRIA_WORKSPACE = 'window:open-alexandria-workspace',
  FOCUS_OR_CREATE_MAIN_WINDOW = 'window:focus-or-create-main',
  GET_WINDOW_ID = 'window:get-window-id',
  IS_REPOSITORY_WINDOW_OPEN = 'window:is-repository-window-open',
  REPOSITORY_WINDOWS_CHANGED = 'window:repository-windows-changed',
}
