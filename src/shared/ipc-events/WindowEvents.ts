/**
 * Window IPC channel enums
 * Shared between main and renderer processes
 */

export enum WindowEvent {
  // Open the dev-workspace window (panel framework)
  OPEN_DEV_WORKSPACE = 'window:open-dev-workspace',
  // Open the extensions window (panel extension browser)
  OPEN_EXTENSION_WINDOW = 'window:open-extension-window',
  OPEN_ALEXANDRIA_WORKSPACE = 'window:open-alexandria-workspace',
  FOCUS_OR_CREATE_MAIN_WINDOW = 'window:focus-or-create-main',
  GET_WINDOW_ID = 'window:get-window-id',
  IS_REPOSITORY_WINDOW_OPEN = 'window:is-repository-window-open',
  REPOSITORY_WINDOWS_CHANGED = 'window:repository-windows-changed',
}
