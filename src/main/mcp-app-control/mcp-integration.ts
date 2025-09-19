import { spawn, ChildProcess, execSync } from 'child_process';
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { applicationWindows } from '../window/modernWindowManager';
import { EnvironmentConfig } from '../utils/environmentConfig';
import { APP_BRANDING } from '../../shared/config/appBranding';

export class ElectronMCPIntegration {
  private mcpProcess: ChildProcess | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 3;
  private lastHealthCheck: number = 0;

  constructor() {
    this.setupIPCHandlers();
  }

  private setupIPCHandlers() {
    // Handle messages from renderer wanting to send to Claude
    ipcMain.handle('send-message-to-claude', async (event, message) => {
      try {
        // Send message to MCP server's message queue
        ipcMain.emit('mcp-send-message', event, {
          message,
          timestamp: Date.now(),
          windowId: BrowserWindow.fromWebContents(event.sender)?.id,
        });

        return { success: true, message: 'Message queued for Claude' };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // Handle requests for app information
    ipcMain.handle('get-mcp-status', async () => {
      return {
        mcpServerRunning: this.mcpProcess !== null && !this.mcpProcess.killed,
        processId: this.mcpProcess?.pid || null,
        timestamp: Date.now(),
      };
    });

    // Handle requests for server health
    ipcMain.handle('get-mcp-health', async () => {
      return this.getMCPServerHealth();
    });

    // Handle MCP server start/stop requests
    ipcMain.handle(
      'control-mcp-server',
      async (event, action: 'start' | 'stop' | 'restart') => {
        try {
          switch (action) {
            case 'start':
              if (!this.mcpProcess || this.mcpProcess.killed) {
                await this.startMCPServer();
                return { success: true, message: 'MCP server started' };
              }
              return { success: false, message: 'MCP server already running' };

            case 'stop':
              this.stopMCPServer();
              return { success: true, message: 'MCP server stopped' };

            case 'restart':
              this.stopMCPServer();
              setTimeout(() => this.startMCPServer(), 1000);
              return { success: true, message: 'MCP server restarting' };

            default:
              return { success: false, message: 'Invalid action' };
          }
        } catch (error: unknown) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    );

    // Handle test IPC flow request
    ipcMain.handle('test-mcp-ipc-flow', async (event) => {
      try {
        this.testMessageFlow();
        return { success: true, message: 'Test message sent' };
      } catch (error: unknown) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  }

  async startMCPServer(): Promise<void> {
    if (this.mcpProcess && !this.mcpProcess.killed) {
      console.log('MCP server already running');
      return;
    }

    try {
      // Reset restart attempts on successful start
      if (this.mcpProcess === null) {
        this.restartAttempts = 0;
      }

      // Path to the compiled MCP server
      const isDev = process.env.NODE_ENV === 'development';
      const serverPath = EnvironmentConfig.getAssetsPath(
        APP_BRANDING.MCP_SERVER_FILENAME,
      );

      console.log('Starting MCP server at:', serverPath);

      // Verify the server file exists
      if (!require('fs').existsSync(serverPath)) {
        throw new Error(`MCP server file not found at: ${serverPath}`);
      }

      // In production, use the bundled Node.js if available (for sandboxed environments)
      let command = 'node';
      const args = [serverPath];

      if (!isDev && process.platform === 'darwin') {
        // On macOS in production, check if we have a bundled node
        const bundledNode = path.join(
          process.resourcesPath,
          '..',
          'MacOS',
          'node',
        );
        if (require('fs').existsSync(bundledNode)) {
          command = bundledNode;
          console.log('Using bundled Node.js:', command);
        }
      } else if (!isDev && process.platform === 'win32') {
        // On Windows in production, check for bundled node.exe
        const bundledNode = path.join(process.resourcesPath, 'node.exe');
        if (require('fs').existsSync(bundledNode)) {
          command = bundledNode;
          console.log('Using bundled Node.js:', command);
        }
      } else if (!isDev && process.platform === 'linux') {
        // On Linux, check for bundled node in resources
        const bundledNode = path.join(process.resourcesPath, 'node');
        if (require('fs').existsSync(bundledNode)) {
          command = bundledNode;
          console.log('Using bundled Node.js:', command);
        }
      }

      // Test if the command is executable
      try {
        if (!isDev) {
          execSync(`"${command}" --version`, { stdio: 'ignore' });
        }
      } catch (error) {
        console.error(
          `Node.js command '${command}' is not executable. Falling back to system node.`,
        );
        command = 'node'; // Fallback to system node
      }

      this.mcpProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: isDev ? path.join(__dirname, '../..') : process.resourcesPath, // CWD is electron-react/ in dev, resources path in prod
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'development',
          // Pass HTTP bridge port if available
          MCP_HTTP_BRIDGE_PORT: process.env.MCP_HTTP_BRIDGE_PORT || '3042',
        },
        // In production on macOS, we might need special spawn options for sandboxed environments
        ...(process.platform === 'darwin' && !isDev
          ? {
              detached: false,
              shell: false,
            }
          : {}),
      });

      this.mcpProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('MCP Server stdout:', output);

        // Parse MCP messages and commands
        const lines = output.split('\n').filter((line) => line.trim());
        lines.forEach((line) => {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('MCP_MESSAGE:')) {
            try {
              const jsonPart = trimmedLine.substring(12);
              console.log('🔍 Raw JSON part:', jsonPart);

              if (jsonPart) {
                const messageData = JSON.parse(jsonPart);
                console.log('📨 Parsed MCP message:', messageData);

                // Send message to renderer processes
                BrowserWindow.getAllWindows().forEach((window) => {
                  console.log('📤 Sending message to renderer:', messageData);
                  window.webContents.send('mcp-message-received', messageData);
                });
              }
            } catch (error) {
              console.error('Failed to parse MCP message:', error);
              console.error('Raw line:', trimmedLine);
            }
          } else if (trimmedLine.startsWith('MCP_COMMAND:')) {
            try {
              const commandPart = trimmedLine.substring(12);
              // Check if it has a command type prefix (e.g., "store-markdown:")
              const colonIndex = commandPart.indexOf(':');
              if (colonIndex > 0) {
                const commandType = commandPart.substring(0, colonIndex);
                const jsonPart = commandPart.substring(colonIndex + 1);
                if (jsonPart) {
                  const commandData = JSON.parse(jsonPart);
                  this.handleMCPCommand({ type: commandType, ...commandData });
                }
              } else {
                // Legacy format without command type prefix
                const command = JSON.parse(commandPart);
                this.handleMCPCommand(command);
              }
            } catch (error) {
              console.error('Failed to parse MCP command:', error);
              console.error('Raw line:', trimmedLine);
            }
          }
        });

        // Forward any output to renderer processes
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('mcp-server-output', {
            type: 'stdout',
            data: output,
            timestamp: Date.now(),
          });
        });
      });

      this.mcpProcess.stderr?.on('data', (data: Buffer) => {
        console.error('MCP Server stderr:', data.toString());

        // Forward error output to renderer processes
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('mcp-server-output', {
            type: 'stderr',
            data: data.toString(),
            timestamp: Date.now(),
          });
        });
      });

      this.mcpProcess.on('error', (error) => {
        console.error('MCP Server process error:', error);

        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('mcp-server-error', {
            error: error.message,
            timestamp: Date.now(),
          });
        });
      });

      this.mcpProcess.on('exit', (code, signal) => {
        console.log(`MCP Server exited with code ${code} and signal ${signal}`);
        this.mcpProcess = null;

        // Stop health monitoring
        this.stopHealthMonitoring();

        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('mcp-server-stopped', {
            code,
            signal,
            timestamp: Date.now(),
          });
        });

        // Auto-restart if it crashed unexpectedly (not killed intentionally)
        if (
          code !== 0 &&
          signal !== 'SIGTERM' &&
          signal !== 'SIGKILL' &&
          this.restartAttempts < this.maxRestartAttempts
        ) {
          this.restartAttempts++;
          console.log(
            `MCP Server crashed. Attempting restart (${this.restartAttempts}/${this.maxRestartAttempts})...`,
          );
          setTimeout(() => {
            this.startMCPServer().catch((error) => {
              console.error('Failed to restart MCP server:', error);
            });
          }, 2000); // Wait 2 seconds before restart
        } else if (this.restartAttempts >= this.maxRestartAttempts) {
          console.error(
            'MCP Server crashed too many times. Not attempting further restarts.',
          );
          // Notify user of critical failure
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send('mcp-server-critical-failure', {
              message:
                'MCP Server has crashed multiple times and will not be restarted automatically.',
              attempts: this.restartAttempts,
              timestamp: Date.now(),
            });
          });
        }
      });

      // Give the process a moment to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('MCP Server started with PID:', this.mcpProcess.pid);

      // Start health monitoring
      this.startHealthMonitoring();
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      throw error;
    }
  }

  private handleMCPCommand(command: any) {
    try {
      switch (command.type) {
        case 'window-control':
          this.handleWindowControl(command);
          break;
        case 'store-markdown':
          this.handleStoreMarkdown(command);
          break;
        default:
          console.log('Unknown MCP command type:', command.type);
      }
    } catch (error) {
      console.error('Error handling MCP command:', error);
    }
  }

  private handleWindowControl(command: any) {
    const { action, windowId } = command;

    try {
      const windows = BrowserWindow.getAllWindows();
      const targetWindow = windowId
        ? windows.find((w) => w.id.toString() === windowId)
        : windows[0]; // Default to first window

      if (!targetWindow) {
        console.error('Target window not found:', windowId);
        return;
      }

      switch (action) {
        case 'minimize':
          targetWindow.minimize();
          break;
        case 'maximize':
          targetWindow.maximize();
          break;
        case 'close':
          targetWindow.close();
          break;
        case 'show':
          targetWindow.show();
          break;
        case 'hide':
          targetWindow.hide();
          break;
        case 'focus':
          targetWindow.focus();
          break;
        default:
          console.log('Unknown window action:', action);
      }
    } catch (error) {
      console.error('Error controlling window:', error);
    }
  }

  private async handleStoreMarkdown(command: any) {
    const {
      responseId,
      markdown,
      title,
      projectId,
      mcpId,
      metadata,
      windowId,
    } = command;

    try {
      // Get the target window's adapter
      let targetWindow: BrowserWindow | undefined;

      if (windowId) {
        targetWindow = BrowserWindow.getAllWindows().find(
          (w) => w.id.toString() === windowId,
        );
      } else {
        targetWindow =
          BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      }

      if (!targetWindow) {
        throw new Error('No target window found');
      }

      const appWindow = applicationWindows.get(targetWindow.id);
      if (!appWindow || !appWindow.mcpToolsAdapter) {
        throw new Error('No MCP tools adapter found for window');
      }

      // Call the handler directly
      const result = await appWindow.mcpToolsAdapter.handleStoreMarkdownFile({
        markdown,
        title,
        projectId,
        mcpId,
        metadata,
      });

      // Send response back to MCP server
      if (responseId) {
        ipcMain.emit('mcp-response', null, responseId, result);
      }
    } catch (error) {
      console.error('Error storing markdown from MCP:', error);
      if (responseId) {
        ipcMain.emit('mcp-response', null, responseId, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  stopMCPServer(): void {
    if (this.mcpProcess && !this.mcpProcess.killed) {
      console.log('Stopping MCP server...');

      // Reset restart attempts since this is an intentional stop
      this.restartAttempts = 0;

      // Stop health monitoring
      this.stopHealthMonitoring();

      this.mcpProcess.kill('SIGTERM');

      // Force kill after 5 seconds if it doesn't terminate gracefully
      setTimeout(() => {
        if (this.mcpProcess && !this.mcpProcess.killed) {
          console.log('Force killing MCP server...');
          this.mcpProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  getMCPServerInfo() {
    return {
      running: this.mcpProcess !== null && !this.mcpProcess.killed,
      pid: this.mcpProcess?.pid || null,
    };
  }

  // Test method to verify IPC pipeline
  testMessageFlow() {
    console.log('🧪 Testing IPC message flow...');
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('mcp-message-received', {
        id: Date.now().toString(),
        message:
          '🧪 Test message from Electron main process - IPC pipeline working!',
        type: 'success',
        timestamp: Date.now(),
        from: 'Electron Main Process',
      });
    });
  }

  private startHealthMonitoring(): void {
    // Clear any existing interval
    this.stopHealthMonitoring();

    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      if (this.mcpProcess && !this.mcpProcess.killed) {
        // Simple health check: verify process is still running
        try {
          // Check if process is still alive
          process.kill(this.mcpProcess.pid!, 0);
          this.lastHealthCheck = Date.now();

          // Also check if the process is responsive by sending a test message
          if (this.mcpProcess.stdin && !this.mcpProcess.stdin.destroyed) {
            this.mcpProcess.stdin.write('\n'); // Send newline as a ping
          }
        } catch (error) {
          console.error('MCP Server health check failed:', error);
          // Process is not responding, trigger restart
          if (this.restartAttempts < this.maxRestartAttempts) {
            console.log('MCP Server is not responding. Restarting...');
            this.stopMCPServer();
            setTimeout(() => {
              this.startMCPServer().catch((err) => {
                console.error(
                  'Failed to restart MCP server during health check:',
                  err,
                );
              });
            }, 1000);
          }
        }
      }
    }, 30000); // 30 seconds
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  getMCPServerHealth(): {
    healthy: boolean;
    lastCheck: number;
    uptime: number;
    restartCount: number;
  } {
    const healthy = this.mcpProcess !== null && !this.mcpProcess.killed;
    const uptime =
      healthy && this.mcpProcess
        ? Date.now() - (this.mcpProcess as any).startTime
        : 0;

    return {
      healthy,
      lastCheck: this.lastHealthCheck,
      uptime,
      restartCount: this.restartAttempts,
    };
  }

  // Clean shutdown
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.stopHealthMonitoring();

      if (this.mcpProcess && !this.mcpProcess.killed) {
        this.mcpProcess.on('exit', () => resolve());
        this.stopMCPServer();
        setTimeout(resolve, 3000); // Fallback timeout
      } else {
        resolve();
      }
    });
  }
}
