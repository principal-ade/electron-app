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
  FOCUS_WINDOW_BY_ID = 'window:focus-by-id',
  GET_WINDOW_ID = 'window:get-window-id',
  IS_REPOSITORY_WINDOW_OPEN = 'window:is-repository-window-open',
  GET_OPEN_REPOSITORY_WINDOWS = 'window:get-open-repository-windows',
  REPOSITORY_WINDOWS_CHANGED = 'window:repository-windows-changed',
  GET_OPEN_WORKSPACE_WINDOWS = 'window:get-open-workspace-windows',
  WORKSPACE_WINDOWS_CHANGED = 'window:workspace-windows-changed',
  // Fired once per window when it reaches `ready-to-show` (first paint).
  // Unlike WORKSPACE_WINDOWS_CHANGED (which fires at window *creation*, before
  // the renderer paints), this confirms the window is actually visible — the
  // signal an "opening…" affordance should wait on before clearing.
  WINDOW_READY = 'window:window-ready',

  // Thread operations (ephemeral multi-repository sessions)
  ADD_REPOSITORY_TO_THREAD = 'window:add-repository-to-thread',
  REMOVE_REPOSITORY_FROM_THREAD = 'window:remove-repository-from-thread',
  THREAD_REPOSITORIES_CHANGED = 'window:thread-repositories-changed',

  // Navigation events (sent to principal window)
  NAVIGATE_TO_UPDATES = 'window:navigate-to-updates',

  // Workspace-window close prompt. Main holds the close and sends
  // BEFORE_CLOSE so the renderer can surface the status modal; the renderer
  // replies with CONFIRM_CLOSE to let the window actually close.
  WORKSPACE_BEFORE_CLOSE = 'window:workspace-before-close',
  WORKSPACE_CONFIRM_CLOSE = 'window:workspace-confirm-close',

  // Cross-window tab transfer: sender invokes with tab data + target window
  // path; main pushes a TAB_RECEIVED event to the target window's webContents.
  SEND_TAB_TO_WINDOW = 'window:send-tab-to-window',
  TAB_RECEIVED = 'window:tab-received',
}
