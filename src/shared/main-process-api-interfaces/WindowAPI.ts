/**
 * WindowAPI interface for managing application windows
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type {
  DetachableTabDescriptor,
  DetachedTabIncomingPayload,
  DetachedTabOpenOptions,
  DetachedTabOpenResult,
  DetachedTabReturnResult,
  DetachedTabWindow,
} from '../detachedTab';

export interface RepositoryWindowState {
  remoteUrl: string;
  /** Local path for dev-workspace windows */
  localPath?: string;
  state: 'opening' | 'ready';
}

export interface DevWorkspaceOptions {
  /** Full Alexandria entry with repository metadata */
  alexandriaEntry: AlexandriaEntry;
}

export interface ExtensionWindowOptions {
  /** Optional panel to select when the extension browser opens. */
  panelId?: string;
}

export interface OpenTerminalTabPayload {
  /** Absolute local directory the terminal should start in. */
  directory: string;
  /** Optional tab label (defaults to the directory basename). */
  label?: string;
}

export interface OpenRepositoryExplorerPayload {
  owner: string;
  name: string;
  description?: string;
  stars?: number;
}

export interface TabTransferData {
  tabId: string;
  sessionId?: string;
  cwd?: string;
  direction: 'to-principal' | 'to-dev-workspace';
  targetWindowId?: number;
}

export interface WindowAPI {
  focusOrCreateMainWindow(): Promise<boolean>;
  focusWindowById(windowId: number): Promise<boolean>;
  getWindowId(): Promise<number>;

  isRepositoryWindowOpen(repository: AlexandriaEntry): Promise<boolean>;
  getOpenRepositoryWindows(): Promise<RepositoryWindowState[]>;
  onRepositoryWindowsChanged(
    callback: (repoWindows: RepositoryWindowState[]) => void,
  ): () => void;

  openDevWorkspace(
    options: DevWorkspaceOptions,
  ): Promise<{ windowId: number } | null>;
  openExtensionWindow(
    options?: ExtensionWindowOptions,
  ): Promise<{ windowId: number } | null>;

  navigateToUpdates(): Promise<boolean>;
  onNavigateToUpdates(callback: () => void): () => void;
  onOpenTerminalTab(
    callback: (payload: OpenTerminalTabPayload) => void,
  ): () => void;
  onOpenRepositoryExplorer(
    callback: (payload: OpenRepositoryExplorerPayload) => void,
  ): () => void;

  sendTabToWindow(data: TabTransferData): Promise<void>;
  onTabReceived(callback: (data: TabTransferData) => void): () => void;

  // -------------------------------------------------------------------------
  // Detached workspace tabs
  // -------------------------------------------------------------------------

  /**
   * Create (or focus) a standalone window for `tab`. Resolves only after the
   * destination renderer has claimed the transfer token and accepted it, or
   * after creation/loading fails or times out. The source must remove its tab
   * only when `transferred` is true. `options.dropPoint` places the window
   * where a drag-out was released.
   */
  openDetachedTab(
    tab: DetachableTabDescriptor,
    options?: DetachedTabOpenOptions,
  ): Promise<DetachedTabOpenResult>;

  /** Destination side: exchange the URL token for the descriptor. */
  claimDetachedTab(token: string): Promise<DetachableTabDescriptor | null>;
  /** Destination side: content rendered successfully; source may drop its tab. */
  acceptDetachedTab(token: string): Promise<boolean>;
  /** Destination side: content failed; main closes the window, source keeps tab. */
  rejectDetachedTab(token: string, reason?: string): Promise<void>;

  /** Detached window: hand the current tab back to the main window. */
  returnDetachedTabToMain(
    tab: DetachableTabDescriptor,
  ): Promise<DetachedTabReturnResult>;

  /**
   * Main window: the main process has a return transfer waiting. The callback
   * may fire more than once for the same token until it is claimed — call
   * `claimIncomingDetachedTab` exactly once per token.
   */
  onIncomingDetachedTab(
    callback: (payload: DetachedTabIncomingPayload) => void,
  ): () => void;
  /** Main window: claim the incoming transfer and get its descriptor. */
  claimIncomingDetachedTab(
    token: string,
  ): Promise<DetachableTabDescriptor | null>;
  /** Main window: tab opened successfully; main closes the detached window. */
  acceptIncomingDetachedTab(token: string): Promise<boolean>;
  /** Main window: adoption failed; the detached window stays open. */
  rejectIncomingDetachedTab(token: string, reason?: string): Promise<void>;

  /** Tabs currently hosted in their own windows. */
  getDetachedTabs(): Promise<DetachedTabWindow[]>;
  /** Fires with the full list whenever a tab is detached or its window closes. */
  onDetachedTabsChanged(
    callback: (detached: DetachedTabWindow[]) => void,
  ): () => void;
}
