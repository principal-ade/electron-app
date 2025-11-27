/**
 * Global type declarations for the dev-workspace window.
 *
 * This window uses a minimal preload that only exposes:
 * - terminal
 * - fileSystem
 * - repositoryMonitoring
 * - userPreferences
 *
 * If you need additional APIs, add them to:
 * 1. src/window/preload-dev-workspace.ts
 * 2. src/shared/main-process-api-interfaces/DevWorkspaceAPI.ts
 * 3. This file
 */

import type { DevWorkspaceMainProcessAPI } from '../../shared/main-process-api-interfaces/DevWorkspaceAPI';

declare global {
  interface Window {
    mainProcess: DevWorkspaceMainProcessAPI;
    appName: string;
    electronTitlebar?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      closeWithConfirmation: () => Promise<boolean>;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
    };
  }
}

export {};
