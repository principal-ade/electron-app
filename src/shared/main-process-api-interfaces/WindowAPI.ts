/**
 * WindowAPI interface for managing application windows
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

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

  sendTabToWindow(data: TabTransferData): Promise<void>;
  onTabReceived(callback: (data: TabTransferData) => void): () => void;
}
