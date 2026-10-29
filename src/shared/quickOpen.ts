/**
 * Shared Quick Open item shape.
 *
 * Quick Open runs in its own BrowserWindow with its own preload, so the item
 * contract crosses the main process → preload → renderer boundary. Keeping one
 * definition here stops the four copies (main loader, preload bridge, renderer
 * app, `global.d.ts`) from drifting.
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

export interface QuickOpenItem {
  id: string;
  /**
   * `ownerDirectory` is a folder holding an owner's checkouts
   * (`<base>/<owner>/<repo>`); selecting one opens a terminal there.
   */
  type: 'repository' | 'ownerDirectory' | 'workspace' | 'github';
  name: string;
  description?: string;
  remoteUrl?: string;
  localPath?: string;
  isOpen: boolean;
  openWindowId?: number;
  /** Avatar URL for display (GitHub owner avatar for repositories). */
  avatarUrl?: string;
  /** Full registry entry for repositories, so opening has the complete data. */
  alexandriaEntry?: AlexandriaEntry;
  /** Last opened timestamp, for sorting and display. */
  lastOpenedAt?: string;
  /** GitHub-specific fields. */
  fullName?: string; // e.g. "facebook/react"
  stars?: number;
  cloneUrl?: string;
  /** Owner directories only: how many registered clones live in the folder. */
  cloneCount?: number;
}
