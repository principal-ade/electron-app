/**
 * Window IPC channel enums
 * Shared between main and renderer processes
 */

export enum WindowEvent {
  // Open the dev-workspace window (panel framework)
  OPEN_DEV_WORKSPACE = 'window:open-dev-workspace',
  // Open the extensions window (panel extension browser)
  OPEN_EXTENSION_WINDOW = 'window:open-extension-window',
  FOCUS_OR_CREATE_MAIN_WINDOW = 'window:focus-or-create-main',
  FOCUS_WINDOW_BY_ID = 'window:focus-by-id',
  GET_WINDOW_ID = 'window:get-window-id',
  IS_REPOSITORY_WINDOW_OPEN = 'window:is-repository-window-open',
  GET_OPEN_REPOSITORY_WINDOWS = 'window:get-open-repository-windows',
  REPOSITORY_WINDOWS_CHANGED = 'window:repository-windows-changed',

  // Navigation events (sent to principal window)
  NAVIGATE_TO_UPDATES = 'window:navigate-to-updates',
  /**
   * Open (or focus) a terminal tab in the principal window at a local path.
   * Used by Quick Open when `quickOpenTarget === 'terminal'`.
   */
  OPEN_TERMINAL_TAB = 'window:open-terminal-tab',
  // Browse a remote GitHub repository without cloning it.
  OPEN_REPOSITORY_EXPLORER = 'window:open-repository-explorer',

  // Cross-window tab transfer: sender invokes with tab data + target window
  // path; main pushes a TAB_RECEIVED event to the target window's webContents.
  SEND_TAB_TO_WINDOW = 'window:send-tab-to-window',
  TAB_RECEIVED = 'window:tab-received',

  // Detached-tab transfer protocol. `OPEN_DETACHED_TAB` resolves only after the
  // destination renderer claims the token and explicitly accepts; the other
  // channels are the claim/accept/reject handshake plus the return-to-main path.
  OPEN_DETACHED_TAB = 'window:open-detached-tab',
  DETACHED_TAB_CLAIM = 'window:detached-tab-claim',
  DETACHED_TAB_ACCEPT = 'window:detached-tab-accept',
  DETACHED_TAB_REJECT = 'window:detached-tab-reject',
  RETURN_DETACHED_TAB = 'window:return-detached-tab',
  DETACHED_TAB_INCOMING = 'window:detached-tab-incoming',
  DETACHED_TAB_CLAIM_INCOMING = 'window:detached-tab-claim-incoming',
  DETACHED_TAB_ACCEPT_INCOMING = 'window:detached-tab-accept-incoming',
  DETACHED_TAB_REJECT_INCOMING = 'window:detached-tab-reject-incoming',
  // Tabs currently living in their own windows, so other windows can show
  // them and focus the window instead of opening a duplicate tab.
  GET_DETACHED_TABS = 'window:get-detached-tabs',
  DETACHED_TABS_CHANGED = 'window:detached-tabs-changed',
}
