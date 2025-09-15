import { BrowserWindow } from 'electron';
interface ApplicationWindowWithMcpAdapter {
    window: BrowserWindow;
    mcpToolsAdapter?: McpToolsAdapter;
}
export declare class McpToolsAdapter {
    private window;
    constructor(window: BrowserWindow);
    handleGetAppInfo(params?: {
        detailed?: boolean;
    }): Promise<any>;
    handleStoreMarkdownFile(params: {
        markdown: string;
        title: string;
        projectId: string;
        mcpId: string;
        metadata: any;
    }): Promise<any>;
}
export declare function registerMcpToolsIpcHandlers(appWindows: Map<number, ApplicationWindowWithMcpAdapter>): void;
export {};
//# sourceMappingURL=mcpToolsHandlers.d.ts.map