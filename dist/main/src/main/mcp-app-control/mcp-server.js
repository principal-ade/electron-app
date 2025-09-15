import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { app, BrowserWindow, ipcMain } from 'electron';
export class ElectronMCPServer {
    server;
    messageQueue = [];
    pendingResponsePromises = new Map();
    constructor() {
        this.server = new McpServer({
            name: 'PrincipleMD-Electron-App',
            version: '1.0.0',
        });
        this.setupTools();
        this.setupResources();
        this.setupIPCHandlers();
    }
    setupIPCHandlers() {
        // Handle incoming messages from Electron app
        ipcMain.on('mcp-send-message', (event, data) => {
            this.messageQueue.push(JSON.stringify(data));
        });
        // Handle responses to Claude requests
        ipcMain.on('mcp-response', (event, responseId, data) => {
            const promise = this.pendingResponsePromises.get(responseId);
            if (promise) {
                promise.resolve(data);
                this.pendingResponsePromises.delete(responseId);
            }
        });
    }
    setupTools() {
        // Send message to Electron app
        // Receive messages from Electron app
        this.server.tool('receive-message', {
            timeout: z.number().default(5000),
            clear: z.boolean().default(false),
        }, async ({ timeout, clear }) => {
            try {
                if (clear) {
                    this.messageQueue = [];
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Message queue cleared',
                            },
                        ],
                    };
                }
                if (this.messageQueue.length > 0) {
                    const messages = [...this.messageQueue];
                    this.messageQueue = [];
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Received ${messages.length} message(s):\n${messages.join('\n')}`,
                            },
                        ],
                    };
                }
                // Wait for new messages
                const message = await this.waitForMessage(timeout);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Received: ${message}`,
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `No messages received within ${timeout}ms`,
                        },
                    ],
                };
            }
        });
        // Control Electron windows
        this.server.tool('control-window', {
            action: z.enum([
                'minimize',
                'maximize',
                'close',
                'show',
                'hide',
                'focus',
                'reload',
            ]),
            windowId: z.string().optional(),
        }, async ({ action, windowId }) => {
            try {
                const windows = BrowserWindow.getAllWindows();
                const window = windowId
                    ? windows.find((w) => w.id.toString() === windowId)
                    : BrowserWindow.getFocusedWindow() || windows[0];
                if (!window) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'No window found',
                            },
                        ],
                    };
                }
                switch (action) {
                    case 'minimize':
                        window.minimize();
                        break;
                    case 'maximize':
                        if (window.isMaximized()) {
                            window.unmaximize();
                        }
                        else {
                            window.maximize();
                        }
                        break;
                    case 'close':
                        window.close();
                        break;
                    case 'show':
                        window.show();
                        break;
                    case 'hide':
                        window.hide();
                        break;
                    case 'focus':
                        window.focus();
                        break;
                    case 'reload':
                        window.webContents.reload();
                        break;
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Window ${action} executed on window ${window.id}`,
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error controlling window: ${error}`,
                        },
                    ],
                };
            }
        });
        // Get app information
        this.server.tool('get-app-info', { detailed: z.boolean().default(false) }, async ({ detailed }) => {
            try {
                const windows = BrowserWindow.getAllWindows();
                const basicInfo = {
                    appName: app.getName(),
                    version: app.getVersion(),
                    isReady: app.isReady(),
                    windowCount: windows.length,
                    focusedWindow: BrowserWindow.getFocusedWindow()?.id || null,
                };
                if (detailed) {
                    const detailedInfo = {
                        ...basicInfo,
                        windows: windows.map((w) => ({
                            id: w.id,
                            title: w.getTitle(),
                            url: w.webContents.getURL(),
                            bounds: w.getBounds(),
                            isVisible: w.isVisible(),
                            isMinimized: w.isMinimized(),
                            isMaximized: w.isMaximized(),
                            isFocused: w.isFocused(),
                        })),
                        appPath: app.getAppPath(),
                        userData: app.getPath('userData'),
                        platform: process.platform,
                        arch: process.arch,
                    };
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(detailedInfo, null, 2),
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(basicInfo, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error getting app info: ${error}`,
                        },
                    ],
                };
            }
        });
        // Store markdown file from MCP
        this.server.tool('store-markdown', {
            markdown: z.string(),
            title: z.string().optional(),
            projectId: z.string().optional(),
            mcpId: z.string().optional(),
            metadata: z.record(z.any()).optional(),
            windowId: z.string().optional(),
        }, async ({ markdown, title, projectId, mcpId, metadata, windowId }) => {
            try {
                // Send command to main process to store the markdown
                const responseId = `store-markdown-${Date.now()}`;
                // Create promise for response
                const responsePromise = new Promise((resolve, reject) => {
                    this.pendingResponsePromises.set(responseId, { resolve, reject });
                    // Timeout after 10 seconds
                    setTimeout(() => {
                        if (this.pendingResponsePromises.has(responseId)) {
                            this.pendingResponsePromises.delete(responseId);
                            reject(new Error('Store markdown timeout'));
                        }
                    }, 10000);
                });
                // Send command to main process
                console.log(`MCP_COMMAND:store-markdown:${JSON.stringify({
                    responseId,
                    markdown,
                    title,
                    projectId,
                    mcpId,
                    metadata,
                    windowId,
                })}`);
                // Wait for response
                const result = await responsePromise;
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Markdown stored successfully: ${JSON.stringify(result)}`,
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error storing markdown: ${error}`,
                        },
                    ],
                };
            }
        });
    }
    setupResources() {
        // Application state resource
        this.server.resource('app-state', 'electron://app/state', async () => ({
            contents: [
                {
                    uri: 'electron://app/state',
                    text: JSON.stringify({
                        appName: app.getName(),
                        version: app.getVersion(),
                        isReady: app.isReady(),
                        windows: BrowserWindow.getAllWindows().length,
                        platform: process.platform,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                    mimeType: 'application/json',
                },
            ],
        }));
        // Message queue resource
        this.server.resource('message-queue', 'electron://messages/queue', async () => ({
            contents: [
                {
                    uri: 'electron://messages/queue',
                    text: JSON.stringify({
                        messages: this.messageQueue,
                        count: this.messageQueue.length,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                    mimeType: 'application/json',
                },
            ],
        }));
    }
    async waitForMessage(timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Timeout waiting for message'));
            }, timeout);
            const checkForMessage = () => {
                if (this.messageQueue.length > 0) {
                    clearTimeout(timer);
                    resolve(this.messageQueue.shift());
                }
                else {
                    setTimeout(checkForMessage, 100);
                }
            };
            checkForMessage();
        });
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('PrincipleMD Electron MCP Server running on stdio');
    }
}
// Start the server when run directly
if (require.main === module) {
    const server = new ElectronMCPServer();
    server.start().catch(console.error);
}
