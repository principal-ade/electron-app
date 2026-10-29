import type { MainProcessAPI } from '../shared/main-process-api-interfaces/index';
import type { QuickOpenItem } from '../shared/quickOpen';

// GitHub search result type
interface GitHubSearchResult {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
  stargazers_count: number;
  clone_url: string;
  html_url: string;
}

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
      // Window Switcher API
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
      // Quick Open API
      onQuickOpenItems?: (
        callback: (event: Electron.IpcRendererEvent, items: QuickOpenItem[]) => void,
      ) => void | (() => void);
      requestQuickOpenItems?: () => void;
      selectQuickOpenItem?: (item: QuickOpenItem) => void;
      closeQuickOpen?: () => void;
      showQuickOpen?: () => void;
      copyToClipboard?: (text: string) => void;
      // GitHub search API
      searchGitHub?: (query: string) => Promise<GitHubSearchResult[]>;
      isAuthenticated?: () => Promise<boolean>;
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

  // Declare the Electron webview element for JSX
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          preload?: string;
          partition?: string;
          allowpopups?: boolean | 'true' | 'false' | '';
          useragent?: string;
          nodeintegration?: boolean | 'true' | 'false';
          nodeintegrationinsubframes?: boolean | 'true' | 'false';
          plugins?: boolean | 'true' | 'false';
          disablewebsecurity?: boolean | 'true' | 'false';
          webpreferences?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
