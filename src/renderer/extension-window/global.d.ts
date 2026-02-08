/**
 * Global type declarations for the extension-window.
 *
 * This window uses a specialized preload that exposes the extension API.
 *
 * If you need additional APIs, add them to:
 * 1. src/window/preload-extension-window.ts
 * 2. src/shared/main-process-api-interfaces/ExtensionWindowAPI.ts
 * 3. This file
 */

import type { ExtensionWindowMainProcessAPI } from '../../shared/main-process-api-interfaces/ExtensionWindowAPI';

declare global {
  interface Window {
    mainProcess: ExtensionWindowMainProcessAPI;
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
