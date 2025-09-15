import React from 'react';
export interface TerminalTab {
    id: string;
    label: string;
    directory: string;
    agentSessionId?: string;
    command?: string;
    isActive: boolean;
}
interface TabbedTerminalPanelProps {
    directory: string;
    hideHeader?: boolean;
    isVisible?: boolean;
    onTabsChange?: (tabs: TerminalTab[]) => void;
    initialTabs?: TerminalTab[];
}
export interface TabbedTerminalPanelRef {
    addClaudeSession: (sessionId: string, sessionName?: string) => Promise<void>;
}
export declare const TabbedTerminalPanel: React.ForwardRefExoticComponent<TabbedTerminalPanelProps & React.RefAttributes<TabbedTerminalPanelRef>>;
export declare const openClaudeTerminal: (sessionId: string, directory: string, sessionName?: string) => TerminalTab;
export {};
//# sourceMappingURL=TabbedTerminalPanel.d.ts.map