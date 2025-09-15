import { useEffect } from 'react';
export function useToolUIEvents(options) {
    useEffect(() => {
        const handleToolUIAction = (event) => {
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
        window.addEventListener('ai-tool-ui-action', handleToolUIAction);
        return () => {
            window.removeEventListener('ai-tool-ui-action', handleToolUIAction);
        };
    }, [options]);
}
