import type { MainProcessAPI } from '../shared/main-process-api-interfaces/index';

declare global {
  interface Window {
    mainProcess: MainProcessAPI;
    appName: string;
    __preloadTest?: { test: string };
    // Titlebar controls (exposed by preload)
    electronTitlebar?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
    };
    // Window init data for routing
    windowInitData?: unknown;
  }

  // CSS properties for webkit
  namespace React {
    interface CSSProperties {
      WebkitAppRegion?: 'drag' | 'no-drag';
    }
  }
}

export {};
