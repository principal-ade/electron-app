import { BrowserWindow, ipcMain, app, shell } from 'electron';
import { McpToolsEvent } from '../../window/main-process-api-implementations/mcpToolsApi';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
// McpToolsAdapter will contain the logic for handling tool requests for a specific window.
export class McpToolsAdapter {
    window;
    constructor(window) {
        this.window = window;
        console.log(`[McpToolsAdapter] Initialized for window ${window.id}`);
    }
    async handleGetAppInfo(params) {
        console.log(`[McpToolsAdapter WID-${this.window.id}] handleGetAppInfo`, params);
        const appInfo = {
            name: 'PrincipleMD Electron App',
            version: '1.0.2', // Updated version
            adapterWindowId: this.window.id,
            status: 'McpToolsAdapter active',
            detailed: params?.detailed ?? false,
        };
        this.window.webContents.send('display-app-info', { appInfo });
        return {
            success: true,
            message: 'App info sent to renderer.',
            data: appInfo,
        };
    }
    async handleStoreMarkdownFile(params) {
        console.log(`[McpToolsAdapter WID-${this.window.id}] handleStoreMarkdownFile`, params);
        throw new Error('Not implemented');
    }
}
// Function to register IPC Handlers. HTTPBridge will invoke these.
export function registerMcpToolsIpcHandlers(appWindows) {
    console.log('[McpTools] Registering global IPC handlers...');
    const getAdapterFromSender = (eventSender) => {
        const senderWindow = BrowserWindow.fromWebContents(eventSender);
        if (!senderWindow)
            return null;
        const appWindow = appWindows.get(senderWindow.id); // appWindow is ApplicationWindowWithMcpAdapter
        return appWindow?.mcpToolsAdapter || null; // mcpToolsAdapter is guaranteed by the type here
    };
    const getAdapterForTarget = (targetWindowId) => {
        let targetAppWindow;
        if (targetWindowId !== undefined) {
            targetAppWindow = appWindows.get(targetWindowId);
        }
        else {
            const focusedWin = BrowserWindow.getFocusedWindow();
            if (focusedWin) {
                targetAppWindow = appWindows.get(focusedWin.id);
            }
            else if (appWindows.size > 0) {
                targetAppWindow = appWindows.values().next().value;
            }
        }
        return targetAppWindow?.mcpToolsAdapter || null; // mcpToolsAdapter is guaranteed by the type here
    };
    ipcMain.handle(McpToolsEvent.GET_APP_INFO, async (event, params) => {
        const adapter = event.sender
            ? getAdapterFromSender(event.sender)
            : getAdapterForTarget(params?.targetWindowId);
        if (!adapter)
            return {
                success: false,
                error: 'McpToolsAdapter not found for target window (GET_APP_INFO).',
            };
        return adapter.handleGetAppInfo(params);
    });
    // Register the additional MCP server management handlers using enums
    // These don't need the adapter pattern since they're global operations
    // MCP Server Management
    ipcMain.handle(McpToolsEvent.GET_SERVERS, async () => {
        throw new Error('MCP GET_SERVERS not yet implemented');
    });
    ipcMain.handle(McpToolsEvent.GET_TOOLS, async (_event, serverName) => {
        throw new Error(`MCP GET_TOOLS not yet implemented for server: ${serverName}`);
    });
    ipcMain.handle(McpToolsEvent.CALL_TOOL, async (_event, params) => {
        throw new Error(`MCP CALL_TOOL not yet implemented for tool: ${params.toolName}`);
    });
    ipcMain.handle(McpToolsEvent.START_SERVER, async (_event, serverName) => {
        throw new Error(`MCP START_SERVER not yet implemented for server: ${serverName}`);
    });
    ipcMain.handle(McpToolsEvent.STOP_SERVER, async (_event, serverName) => {
        throw new Error(`MCP STOP_SERVER not yet implemented for server: ${serverName}`);
    });
    ipcMain.handle(McpToolsEvent.SEND_MESSAGE, async (_event, params) => {
        throw new Error('MCP SEND_MESSAGE not yet implemented');
    });
    // MCP Configuration - These are actually implemented
    ipcMain.handle(McpToolsEvent.GET_CONFIG, async () => {
        try {
            const configPath = path.join(app.getPath('home'), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
            const configData = await fs.readFile(configPath, 'utf-8');
            return JSON.parse(configData);
        }
        catch {
            return { servers: {}, settings: {} };
        }
    });
    ipcMain.handle(McpToolsEvent.UPDATE_CONFIG, async (_event, config) => {
        const configPath = path.join(app.getPath('home'), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        const configDir = path.dirname(configPath);
        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    });
    ipcMain.handle(McpToolsEvent.OPEN_CONFIG, async () => {
        const configPath = path.join(app.getPath('home'), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        await shell.openPath(configPath);
    });
    ipcMain.handle(McpToolsEvent.CHECK_CLAUDE_CLI, async () => {
        try {
            execSync('which claude', { encoding: 'utf-8' });
            return { installed: true };
        }
        catch {
            return { installed: false, error: 'Claude CLI not found' };
        }
    });
    ipcMain.handle(McpToolsEvent.GET_RESOLVED_SCRIPT_PATH, async () => {
        const isProd = app.isPackaged;
        return isProd
            ? path.join(process.resourcesPath, 'assets', 'principal-ai-mcp-server.cjs')
            : path.join(__dirname, '../../../assets/principal-ai-mcp-server.cjs');
    });
    console.log('[McpTools] Global IPC handlers registered.');
}
// You would add `mcpToolsAdapter: McpToolsAdapter;` to your ApplicationWindow class
// And instantiate it: `this.mcpToolsAdapter = new McpToolsAdapter(this.browserWindow);`
