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
      closeWithConfirmation: () => Promise<boolean>;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
    };
    electronAPI?: {
      getWindowList?: () => void;
      selectWindow?: (windowId: number) => void;
      onWindowListUpdate?: (
        callback: (data: {
          windows?: Array<{ id: number; title: string; thumbnail?: string }>;
          selectedIndex?: number;
        }) => void,
      ) => void | (() => void);
      onSelectNext?: (callback: () => void) => void | (() => void);
      onSelectPrevious?: (callback: () => void) => void | (() => void);
      cycleSelection?: (direction: 'next' | 'previous') => void;
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
