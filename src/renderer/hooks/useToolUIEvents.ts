import { useEffect } from 'react';

export interface ToolUIEventDetail {
  type:
    | 'search-files'
    | 'highlight-map'
    | 'switch-view'
    | 'focus-terminal'
    | 'terminal-highlight'
    | 'focus-map'
    | 'search-content'
    | 'switch-sidebar-panel'
    | 'toggle-sidebar';
  data: any;
}

interface UseToolUIEventsOptions {
  onSearchFiles?: (data: {
    pattern: string;
    results: string[];
    searchPath: string;
  }) => void;
  onHighlightMap?: (data: {
    files: string[];
    connections: any[];
    color?: string;
    label?: string;
  }) => void;
  onSwitchView?: (data: {
    view: 'map' | 'excalidraw' | 'terminal' | 'ai';
  }) => void;
  onFocusTerminal?: () => void;
  onTerminalHighlight?: (data: {
    pattern: string;
    regex?: boolean;
    caseSensitive?: boolean;
  }) => void;
  onFocusMap?: (data: { target: string; zoom?: number }) => void;
  onSearchContent?: (data: {
    query: string;
    matches: any[];
    filePattern?: string;
  }) => void;
  onSwitchSidebarPanel?: (data: {
    panel: 'sessions' | 'contexts' | 'search';
  }) => void;
  onToggleSidebar?: (data: { visible?: boolean }) => void;
}

export function useToolUIEvents(options: UseToolUIEventsOptions) {
  useEffect(() => {
    const handleToolUIAction = (event: CustomEvent<ToolUIEventDetail>) => {
      const { type, data } = event.detail;

      switch (type) {
        case 'search-files':
          options.onSearchFiles?.(data);
          break;
        case 'highlight-map':
          options.onHighlightMap?.(data);
          break;
        case 'switch-view':
          options.onSwitchView?.(data);
          break;
        case 'focus-terminal':
          options.onFocusTerminal?.();
          break;
        case 'terminal-highlight':
          options.onTerminalHighlight?.(data);
          break;
        case 'focus-map':
          options.onFocusMap?.(data);
          break;
        case 'search-content':
          options.onSearchContent?.(data);
          break;
        case 'switch-sidebar-panel':
          options.onSwitchSidebarPanel?.(data);
          break;
        case 'toggle-sidebar':
          options.onToggleSidebar?.(data);
          break;
      }
    };

    window.addEventListener('ai-tool-ui-action', handleToolUIAction as any);

    return () => {
      window.removeEventListener(
        'ai-tool-ui-action',
        handleToolUIAction as any,
      );
    };
  }, [options]);
}
