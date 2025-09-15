export interface ToolUIEventDetail {
    type: 'search-files' | 'highlight-map' | 'switch-view' | 'focus-terminal' | 'terminal-highlight' | 'focus-map' | 'search-content' | 'switch-sidebar-panel' | 'toggle-sidebar';
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
    onFocusMap?: (data: {
        target: string;
        zoom?: number;
    }) => void;
    onSearchContent?: (data: {
        query: string;
        matches: any[];
        filePattern?: string;
    }) => void;
    onSwitchSidebarPanel?: (data: {
        panel: 'sessions' | 'contexts' | 'search';
    }) => void;
    onToggleSidebar?: (data: {
        visible?: boolean;
    }) => void;
}
export declare function useToolUIEvents(options: UseToolUIEventsOptions): void;
export {};
//# sourceMappingURL=useToolUIEvents.d.ts.map