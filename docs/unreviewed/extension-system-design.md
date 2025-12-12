# Extension System Design Document

## Executive Summary

This document outlines the refactoring of the Storybook sidecar implementation into a generalizable extension system that can support loadable extensions like Cline, Storybook, and other developer tools. The design leverages existing IPC patterns and window management infrastructure while adding dynamic loading, manifest-based configuration, and a comprehensive API surface.

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                             │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Extension      │  │   Window     │  │   Process       │   │
│  │    Manager      │──│   Manager    │──│   Manager       │   │
│  └────────┬────────┘  └──────────────┘  └─────────────────┘   │
│           │                                                      │
│  ┌────────▼────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Extension      │  │     IPC      │  │    Security     │   │
│  │    Registry     │  │   Router     │  │    Sandbox      │   │
│  └─────────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ IPC
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼────────┐      ┌─────────▼────────┐     ┌─────────▼────────┐
│   Extension    │      │   Extension      │     │   Extension      │
│   (Storybook)  │      │     (Cline)      │     │   (Custom Tool)  │
└────────────────┘      └──────────────────┘     └──────────────────┘
```

## Extension Manifest Specification

### VSCode-Compatible package.json Structure

We use the standard VSCode extension manifest format with our platform-specific features under the `principal-ai` namespace. This ensures 100% compatibility with existing VSCode extensions while enabling enhanced capabilities.

```json
{
  // Standard VSCode/NPM fields
  "name": "storybook-extension",
  "displayName": "Storybook Development Server",
  "version": "1.0.0",
  "description": "Run and manage Storybook development server",
  "publisher": "principal-ai",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/principal-ai/storybook-extension"
  },

  // VSCode compatibility
  "engines": {
    "vscode": "^1.74.0"
  },

  "categories": ["Other"],
  "icon": "icon.png",
  "main": "./dist/extension.js",

  // Standard VSCode activation events
  "activationEvents": [
    "onCommand:storybook.start",
    "workspaceContains:package.json"
  ],

  // Standard VSCode capabilities
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": false
    }
  },

  // Standard VSCode contributions
  "contributes": {
    "commands": [
      {
        "command": "storybook.start",
        "title": "Start Storybook Server",
        "category": "Storybook"
      },
      {
        "command": "storybook.stop",
        "title": "Stop Storybook Server",
        "category": "Storybook"
      }
    ],

    "views": {
      "explorer": [
        {
          "id": "storybook.controls",
          "name": "Storybook Controls",
          "icon": "$(book)",
          "contextualTitle": "Storybook"
        }
      ]
    },

    "menus": {
      "view/title": [
        {
          "command": "storybook.start",
          "when": "view == storybook.controls && !storybook.isRunning",
          "group": "navigation"
        },
        {
          "command": "storybook.stop",
          "when": "view == storybook.controls && storybook.isRunning",
          "group": "navigation"
        }
      ]
    },

    "configuration": {
      "title": "Storybook",
      "properties": {
        "storybook.port": {
          "type": "number",
          "default": 6006,
          "description": "Default port for Storybook server"
        },
        "storybook.autoOpen": {
          "type": "boolean",
          "default": true,
          "description": "Automatically open Storybook window when server starts"
        }
      }
    },

    "keybindings": [
      {
        "command": "storybook.start",
        "key": "ctrl+shift+s",
        "mac": "cmd+shift+s"
      }
    ]
  },

  // Extension dependencies (VSCode standard)
  "extensionDependencies": [],

  // Scripts for VSCode tooling
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },

  // Principal ADE platform-specific enhancements
  "principal-ade": {
    "version": "1.0.0",
    "engines": "^1.0.0",

    "permissions": [
      "windows.create",
      "windows.manage",
      "process.spawn",
      "filesystem.read",
      "terminal.execute",
      "webview.create"
    ],

    "sandboxOptions": {
      "enabled": true,
      "timeout": 5000,
      "memory": "512mb"
    },

    "windows": {
      "storybook": {
        "type": "sidecar",
        "defaultWidth": 1200,
        "defaultHeight": 800,
        "webPreferences": {
          "contextIsolation": true,
          "nodeIntegration": false
        }
      }
    },

    "ipcChannels": [
      "storybook:server:*",
      "storybook:window:*"
    ]
  }
}
```

### Dual Compatibility Strategy

Extensions can work in both VSCode and Principal ADE environments:

1. **VSCode Mode**: Uses only standard VSCode APIs
2. **Principal ADE Mode**: Detects enhanced environment and uses additional capabilities
3. **Graceful Degradation**: Features degrade gracefully when running in VSCode

## Extension API Surface

### Core Extension Interface

```typescript
// src/extensions/ExtensionAPI.ts

export interface ExtensionContext {
  // Extension metadata
  readonly extensionId: string;
  readonly extensionPath: string;
  readonly globalState: ExtensionMemento;
  readonly workspaceState: ExtensionMemento;
  readonly extensionMode: ExtensionMode;

  // Storage
  readonly storageUri: Uri;
  readonly globalStorageUri: Uri;
  readonly logUri: Uri;

  // Subscriptions
  readonly subscriptions: Disposable[];

  // Environmental
  readonly environmentVariableCollection: EnvironmentVariableCollection;
  readonly secrets: SecretStorage;
}

export interface ExtensionAPI {
  // Window Management
  windows: {
    create(options: WindowCreateOptions): Promise<ExtensionWindow>;
    get(id: string): ExtensionWindow | undefined;
    getAll(): ExtensionWindow[];
    focus(id: string): Promise<void>;
    close(id: string): Promise<void>;
  };

  // Process Management
  processes: {
    spawn(command: string, args: string[], options?: ProcessOptions): ChildProcess;
    exec(command: string, options?: ExecOptions): Promise<ExecResult>;
    kill(pid: number): Promise<void>;
  };

  // Terminal Integration
  terminal: {
    create(options: TerminalOptions): Terminal;
    executeCommand(command: string): Promise<string>;
    sendText(text: string): void;
    show(preserveFocus?: boolean): void;
  };

  // File System
  filesystem: {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, content: Uint8Array): Promise<void>;
    readDirectory(path: string): Promise<[string, FileType][]>;
    createDirectory(path: string): Promise<void>;
    delete(path: string, options?: { recursive?: boolean }): Promise<void>;
    watch(pattern: string, options?: WatchOptions): FileSystemWatcher;
  };

  // UI Components
  ui: {
    showMessage(message: string, type?: MessageType): void;
    showInputBox(options: InputBoxOptions): Promise<string | undefined>;
    showQuickPick(items: string[], options?: QuickPickOptions): Promise<string | undefined>;
    createWebviewPanel(viewType: string, title: string, options?: WebviewOptions): WebviewPanel;
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
    createOutputChannel(name: string): OutputChannel;
  };

  // Commands
  commands: {
    registerCommand(command: string, callback: (...args: any[]) => any): Disposable;
    executeCommand(command: string, ...rest: any[]): Promise<any>;
    getCommands(filterInternal?: boolean): Promise<string[]>;
  };

  // Events
  events: {
    onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
    onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;
    onDidSaveDocument: Event<Document>;
    onDidChangeActiveTerminal: Event<Terminal | undefined>;
  };

  // Workspace
  workspace: {
    getConfiguration(section?: string): WorkspaceConfiguration;
    findFiles(include: string, exclude?: string): Promise<Uri[]>;
    openTextDocument(uri: Uri): Promise<TextDocument>;
    applyEdit(edit: WorkspaceEdit): Promise<boolean>;
  };
}
```

### VSCode API Compatibility Layer

To ensure seamless compatibility with existing VSCode extensions, we provide a complete VSCode API implementation that maps to our enhanced capabilities:

```typescript
// src/extensions/VSCodeCompatibilityLayer.ts

import * as vscode from 'vscode';
import { PrincipalADEAPI } from './PrincipalADEAPI';

export class VSCodeCompatibilityLayer {
  private principalAPI: PrincipalADEAPI;
  private isVSCodeEnvironment: boolean;

  constructor() {
    this.isVSCodeEnvironment = this.detectEnvironment();
    if (!this.isVSCodeEnvironment) {
      this.principalAPI = new PrincipalADEAPI();
    }
  }

  private detectEnvironment(): boolean {
    // Check if running in actual VSCode
    return typeof vscode !== 'undefined' && vscode.version !== undefined;
  }

  // VSCode-compatible window API
  get window() {
    if (this.isVSCodeEnvironment) {
      return vscode.window;
    }

    // Map to Principal ADE enhanced capabilities
    return {
      createWebviewPanel: (viewType: string, title: string, viewColumn: any, options?: any) => {
        // Use our enhanced window creation
        return this.principalAPI.windows.create({
          type: 'webview',
          title,
          options
        });
      },
      showInformationMessage: (message: string) => {
        return this.principalAPI.ui.showMessage(message, 'info');
      },
      showErrorMessage: (message: string) => {
        return this.principalAPI.ui.showMessage(message, 'error');
      },
      createOutputChannel: (name: string) => {
        return this.principalAPI.ui.createOutputChannel(name);
      },
      // ... other window methods
    };
  }

  // VSCode-compatible commands API
  get commands() {
    if (this.isVSCodeEnvironment) {
      return vscode.commands;
    }

    return {
      registerCommand: (command: string, callback: (...args: any[]) => any) => {
        return this.principalAPI.commands.registerCommand(command, callback);
      },
      executeCommand: (command: string, ...rest: any[]) => {
        return this.principalAPI.commands.executeCommand(command, ...rest);
      }
    };
  }

  // VSCode-compatible workspace API
  get workspace() {
    if (this.isVSCodeEnvironment) {
      return vscode.workspace;
    }

    return {
      getConfiguration: (section?: string) => {
        return this.principalAPI.workspace.getConfiguration(section);
      },
      fs: {
        readFile: (uri: any) => {
          return this.principalAPI.filesystem.readFile(uri.fsPath);
        },
        writeFile: (uri: any, content: Uint8Array) => {
          return this.principalAPI.filesystem.writeFile(uri.fsPath, content);
        }
      },
      // ... other workspace methods
    };
  }
}

// Global compatibility export
export const compatAPI = new VSCodeCompatibilityLayer();
```

### Extension Entry Point with Dual Compatibility

```typescript
// Example: storybook-extension/src/extension.ts

import * as vscode from 'vscode';

// Type definitions for enhanced capabilities
interface PrincipalADEContext extends vscode.ExtensionContext {
  principalADE?: {
    version: string;
    permissions: string[];
    windows: any;
    processes: any;
  };
}

let storybookWindow: any;
let storybookProcess: any;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Storybook extension activated');

  // Detect if we have Principal ADE enhanced capabilities
  const ctx = context as PrincipalADEContext;
  const hasPrincipalADE = ctx.principalADE !== undefined;

  if (hasPrincipalADE) {
    console.log('Running with Principal ADE enhancements');
    // Use enhanced features when available
    await activateWithEnhancements(ctx);
  } else {
    console.log('Running in standard VSCode mode');
    // Fall back to standard VSCode functionality
    await activateStandard(context);
  }
}

async function activateWithEnhancements(context: PrincipalADEContext) {
  // Register commands with enhanced capabilities
  const startCommand = vscode.commands.registerCommand('storybook.start', async () => {
    // Use Principal ADE's enhanced process management
    storybookProcess = await context.principalADE!.processes.spawn('npm', [
      'run', 'storybook', '--', '-p', '6006'
    ]);

    // Use Principal ADE's enhanced window creation
    storybookWindow = await context.principalADE!.windows.create({
      type: 'sidecar',
      url: 'http://localhost:6006',
      title: 'Storybook',
      associatedWith: vscode.window.activeTextEditor
    });
  });

  context.subscriptions.push(startCommand);
}

async function activateStandard(context: vscode.ExtensionContext) {
  // Register commands with standard VSCode API
  const startCommand = vscode.commands.registerCommand('storybook.start', async () => {
    // Use standard VSCode terminal API
    const terminal = vscode.window.createTerminal('Storybook');
    terminal.sendText('npm run storybook');
    terminal.show();

    // Create webview panel as fallback
    const panel = vscode.window.createWebviewPanel(
      'storybook',
      'Storybook',
      vscode.ViewColumn.Two,
      { enableScripts: true }
    );

    panel.webview.html = `
      <iframe src="http://localhost:6006"
              style="width: 100%; height: 100vh; border: none;">
      </iframe>
    `;
  });

  context.subscriptions.push(startCommand);
}

export function deactivate() {
  if (storybookProcess) {
    storybookProcess.kill();
  }
  if (storybookWindow) {
    storybookWindow.close();
  }
}
```

### Extension Entry Point (Principal ADE Native API)

```typescript
// Example: storybook-extension/src/extension.ts

import { ExtensionContext, ExtensionAPI } from '@principal-ai/extension-api';

let storybookWindow: ExtensionWindow | undefined;
let storybookProcess: ChildProcess | undefined;

export async function activate(context: ExtensionContext, api: ExtensionAPI) {
  console.log('Storybook extension activated');

  // Register commands
  const startCommand = api.commands.registerCommand('storybook.start', async () => {
    await startStorybookServer(api);
  });

  const stopCommand = api.commands.registerCommand('storybook.stop', async () => {
    await stopStorybookServer(api);
  });

  // Add disposables
  context.subscriptions.push(startCommand, stopCommand);

  // Check for auto-start
  const config = api.workspace.getConfiguration('storybook');
  if (config.get('autoStart')) {
    await startStorybookServer(api);
  }
}

async function startStorybookServer(api: ExtensionAPI) {
  const config = api.workspace.getConfiguration('storybook');
  const port = config.get<number>('port') || 6006;

  // Start the server process
  storybookProcess = api.processes.spawn('npm', ['run', 'storybook', '--', '-p', port.toString()], {
    cwd: api.workspace.rootPath,
    env: { ...process.env, BROWSER: 'none' }
  });

  // Wait for server to be ready
  await waitForServer(`http://localhost:${port}`);

  // Create the window
  if (config.get('autoOpen')) {
    storybookWindow = await api.windows.create({
      url: `http://localhost:${port}`,
      title: 'Storybook',
      width: 1200,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
  }

  // Update status
  api.ui.showMessage('Storybook server started', 'info');
}

export function deactivate() {
  // Cleanup
  if (storybookProcess) {
    storybookProcess.kill();
  }
  if (storybookWindow) {
    storybookWindow.close();
  }
}
```

## Extension Loading System

### Extension Manager Implementation

```typescript
// src/main/extensions/ExtensionManager.ts

export class ExtensionManager {
  private extensions: Map<string, LoadedExtension> = new Map();
  private registry: ExtensionRegistry;
  private apiFactory: ExtensionAPIFactory;
  private sandboxManager: SandboxManager;

  constructor(
    private windowManager: WindowManager,
    private processManager: ProcessManager,
    private ipcRouter: IPCRouter
  ) {
    this.registry = new ExtensionRegistry();
    this.apiFactory = new ExtensionAPIFactory(windowManager, processManager);
    this.sandboxManager = new SandboxManager();
  }

  async loadExtension(extensionPath: string): Promise<void> {
    // 1. Read and validate manifest
    const manifest = await this.readManifest(extensionPath);
    await this.validateManifest(manifest);

    // 2. Check permissions
    const grantedPermissions = await this.checkPermissions(manifest.permissions);

    // 3. Create sandboxed context
    const sandbox = this.sandboxManager.createSandbox({
      extensionId: manifest.name,
      permissions: grantedPermissions,
      rootPath: extensionPath
    });

    // 4. Create extension API with granted permissions
    const api = this.apiFactory.createAPI(manifest.name, grantedPermissions);

    // 5. Load extension module
    const extensionModule = await this.loadModule(
      path.join(extensionPath, manifest.main),
      sandbox
    );

    // 6. Create extension context
    const context = this.createContext(manifest, extensionPath);

    // 7. Activate extension
    if (extensionModule.activate) {
      await extensionModule.activate(context, api);
    }

    // 8. Register extension
    this.extensions.set(manifest.name, {
      manifest,
      module: extensionModule,
      context,
      api,
      sandbox,
      status: 'active'
    });

    // 9. Register contributed items
    await this.registerContributions(manifest);

    // 10. Emit activation event
    this.emit('extensionActivated', manifest.name);
  }

  async unloadExtension(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension) return;

    // 1. Call deactivate if exists
    if (extension.module.deactivate) {
      await extension.module.deactivate();
    }

    // 2. Dispose subscriptions
    extension.context.subscriptions.forEach(sub => sub.dispose());

    // 3. Unregister contributions
    await this.unregisterContributions(extension.manifest);

    // 4. Clean up sandbox
    extension.sandbox.destroy();

    // 5. Remove from registry
    this.extensions.delete(extensionId);

    // 6. Emit deactivation event
    this.emit('extensionDeactivated', extensionId);
  }

  private async registerContributions(manifest: ExtensionManifest) {
    // Register commands
    if (manifest.contributes?.commands) {
      for (const command of manifest.contributes.commands) {
        this.ipcRouter.registerCommand(command.command, manifest.name);
      }
    }

    // Register views
    if (manifest.contributes?.views) {
      for (const [location, views] of Object.entries(manifest.contributes.views)) {
        for (const view of views) {
          await this.windowManager.registerView(location, view);
        }
      }
    }

    // Register menus
    if (manifest.contributes?.menus) {
      for (const [menuId, items] of Object.entries(manifest.contributes.menus)) {
        await this.registerMenuItems(menuId, items);
      }
    }
  }
}
```

### Extension Discovery

```typescript
// src/main/extensions/ExtensionDiscovery.ts

export class ExtensionDiscovery {
  private watchers: Map<string, FSWatcher> = new Map();

  async discoverExtensions(): Promise<ExtensionInfo[]> {
    const extensions: ExtensionInfo[] = [];

    // 1. Built-in extensions
    const builtInPath = path.join(__dirname, '../extensions');
    extensions.push(...await this.scanDirectory(builtInPath, 'builtin'));

    // 2. User extensions
    const userPath = path.join(app.getPath('userData'), 'extensions');
    extensions.push(...await this.scanDirectory(userPath, 'user'));

    // 3. Workspace extensions
    const workspacePath = path.join(process.cwd(), '.electron-app/extensions');
    extensions.push(...await this.scanDirectory(workspacePath, 'workspace'));

    // 4. Node modules (if packaged as npm)
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    extensions.push(...await this.scanNodeModules(nodeModulesPath));

    return extensions;
  }

  watchForChanges(callback: (event: ExtensionChangeEvent) => void) {
    const paths = [
      path.join(app.getPath('userData'), 'extensions'),
      path.join(process.cwd(), '.electron-app/extensions')
    ];

    for (const watchPath of paths) {
      const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (filename?.endsWith('manifest.json')) {
          callback({
            type: eventType as 'change' | 'rename',
            path: path.join(watchPath, filename),
            timestamp: Date.now()
          });
        }
      });

      this.watchers.set(watchPath, watcher);
    }
  }

  private async scanDirectory(dir: string, type: ExtensionType): Promise<ExtensionInfo[]> {
    if (!fs.existsSync(dir)) return [];

    const extensions: ExtensionInfo[] = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(dir, entry.name, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
          extensions.push({
            id: manifest.name,
            path: path.join(dir, entry.name),
            manifest,
            type
          });
        }
      }
    }

    return extensions;
  }
}
```

## Security Model

### Permission System

```typescript
// src/main/extensions/PermissionManager.ts

export enum Permission {
  // Window permissions
  WINDOWS_CREATE = 'windows.create',
  WINDOWS_MANAGE = 'windows.manage',

  // Process permissions
  PROCESS_SPAWN = 'process.spawn',
  PROCESS_KILL = 'process.kill',

  // File system permissions
  FILESYSTEM_READ = 'filesystem.read',
  FILESYSTEM_WRITE = 'filesystem.write',
  FILESYSTEM_DELETE = 'filesystem.delete',

  // Terminal permissions
  TERMINAL_CREATE = 'terminal.create',
  TERMINAL_EXECUTE = 'terminal.execute',

  // Network permissions
  NETWORK_REQUEST = 'network.request',

  // UI permissions
  UI_NOTIFICATION = 'ui.notification',
  WEBVIEW_CREATE = 'webview.create'
}

export class PermissionManager {
  private grantedPermissions: Map<string, Set<Permission>> = new Map();

  async requestPermissions(
    extensionId: string,
    requested: Permission[]
  ): Promise<Permission[]> {
    // Check if already granted
    const existing = this.grantedPermissions.get(extensionId) || new Set();
    const needed = requested.filter(p => !existing.has(p));

    if (needed.length === 0) {
      return requested;
    }

    // Show permission dialog
    const granted = await this.showPermissionDialog(extensionId, needed);

    // Store granted permissions
    granted.forEach(p => existing.add(p));
    this.grantedPermissions.set(extensionId, existing);

    // Persist to storage
    await this.persistPermissions();

    return Array.from(existing);
  }

  hasPermission(extensionId: string, permission: Permission): boolean {
    const permissions = this.grantedPermissions.get(extensionId);
    return permissions?.has(permission) ?? false;
  }

  private async showPermissionDialog(
    extensionId: string,
    permissions: Permission[]
  ): Promise<Permission[]> {
    const result = await dialog.showMessageBox({
      type: 'question',
      title: 'Extension Permissions',
      message: `Extension "${extensionId}" is requesting the following permissions:`,
      detail: permissions.map(p => this.getPermissionDescription(p)).join('\n'),
      checkboxLabel: 'Trust this extension',
      checkboxChecked: false,
      buttons: ['Deny', 'Allow']
    });

    return result.response === 1 ? permissions : [];
  }
}
```

### Sandbox Implementation

```typescript
// src/main/extensions/Sandbox.ts

export class ExtensionSandbox {
  private vm: VM;
  private context: any;

  constructor(
    private extensionId: string,
    private permissions: Permission[]
  ) {
    this.vm = new VM({
      timeout: 1000,
      sandbox: this.createSandboxContext()
    });
  }

  private createSandboxContext() {
    return {
      console: this.createSafeConsole(),
      setTimeout: this.createSafeTimer('setTimeout'),
      setInterval: this.createSafeTimer('setInterval'),
      clearTimeout,
      clearInterval,
      Buffer: this.permissions.includes(Permission.FILESYSTEM_READ) ? Buffer : undefined,
      process: {
        env: {},
        cwd: () => this.extensionPath,
        platform: process.platform,
        arch: process.arch
      },
      require: this.createSafeRequire()
    };
  }

  private createSafeRequire() {
    const allowedModules = ['path', 'url', 'querystring', 'events'];

    return (moduleName: string) => {
      if (allowedModules.includes(moduleName)) {
        return require(moduleName);
      }

      if (moduleName.startsWith('.')) {
        // Local module
        const fullPath = path.resolve(this.extensionPath, moduleName);
        if (!fullPath.startsWith(this.extensionPath)) {
          throw new Error(`Access denied: ${moduleName}`);
        }
        return this.vm.run(fs.readFileSync(fullPath, 'utf-8'));
      }

      throw new Error(`Module not allowed: ${moduleName}`);
    };
  }

  execute(code: string): any {
    return this.vm.run(code);
  }

  destroy() {
    // Cleanup resources
    this.context = null;
    this.vm = null;
  }
}
```

## IPC Communication

### Message Router

```typescript
// src/main/extensions/IPCRouter.ts

export class ExtensionIPCRouter {
  private handlers: Map<string, ExtensionCommandHandler> = new Map();

  constructor(private extensionManager: ExtensionManager) {
    this.setupIPCHandlers();
  }

  private setupIPCHandlers() {
    // Extension command execution
    ipcMain.handle('extension:execute-command', async (event, extensionId, command, ...args) => {
      return this.executeExtensionCommand(extensionId, command, args);
    });

    // Extension-to-extension communication
    ipcMain.handle('extension:send-message', async (event, from, to, message) => {
      return this.sendMessageToExtension(from, to, message);
    });

    // Extension events
    ipcMain.on('extension:emit-event', (event, extensionId, eventName, data) => {
      this.emitExtensionEvent(extensionId, eventName, data);
    });
  }

  private async executeExtensionCommand(
    extensionId: string,
    command: string,
    args: any[]
  ): Promise<any> {
    const extension = this.extensionManager.getExtension(extensionId);
    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    const handler = this.handlers.get(`${extensionId}:${command}`);
    if (!handler) {
      throw new Error(`Command not found: ${command}`);
    }

    // Check permissions
    if (!this.checkCommandPermissions(extension, command)) {
      throw new Error(`Permission denied for command: ${command}`);
    }

    // Execute in sandbox
    return extension.sandbox.execute(() => handler(...args));
  }

  registerCommand(command: string, extensionId: string, handler: Function) {
    this.handlers.set(`${extensionId}:${command}`, handler);
  }
}
```

## Migration Path

### Phase 1: VSCode API Compatibility Layer

1. **Implement VSCode API shim**
   - Map VSCode API to our internal APIs
   - Support standard `package.json` format
   - Add `principal-ai` namespace for enhanced features

2. **Test with existing VSCode extensions**
   - Install popular extensions like GitLens, Prettier
   - Verify basic functionality works
   - Document any compatibility issues

### Phase 2: Refactor Storybook as Standard Extension

1. **Create VSCode-compatible manifest**
   - Use standard `package.json` structure
   - Add Principal ADE enhancements under namespace
   - Ensure it works in both VSCode and our app

2. **Implement dual-mode activation**
   - Detect environment (VSCode vs Principal ADE)
   - Use enhanced features when available
   - Fall back gracefully to VSCode APIs

### Phase 3: Core Extension System

1. **Build Extension Manager**
   - Support loading from `node_modules`
   - Support loading from `.vscode/extensions`
   - Implement activation events

2. **Implement Permission System**
   - Read permissions from `principal-ai` namespace
   - Show permission dialog for first-time use
   - Store granted permissions

3. **Create Sandbox Environment**
   - Isolate extension execution
   - Enforce permission boundaries
   - Monitor resource usage

### Phase 4: Enhanced Capabilities

1. **Add Principal ADE specific features**
   - Sidecar windows
   - Process management
   - Advanced IPC channels

2. **Marketplace Integration**
   - Support installing from VSCode Marketplace
   - Support installing from OpenVSX
   - Add Principal ADE extension registry

### Phase 5: Developer Experience

1. **Extension Development Tools**
   - Yeoman generator for new extensions
   - Debugging support
   - Hot reload during development

2. **Documentation & Examples**
   - Migration guide for VSCode extensions
   - API documentation
   - Sample extensions showcasing features

## Example Extensions

### 1. Cline-like AI Assistant (VSCode Compatible)

```json
// cline-extension/package.json
{
  "name": "cline-assistant",
  "displayName": "Cline AI Assistant",
  "version": "1.0.0",
  "publisher": "principal-ai",
  "engines": {
    "vscode": "^1.74.0"
  },
  "activationEvents": [
    "onCommand:cline.assist"
  ],
  "contributes": {
    "commands": [{
      "command": "cline.assist",
      "title": "Open AI Assistant"
    }]
  },
  "principal-ade": {
    "permissions": [
      "filesystem.write",
      "terminal.execute",
      "webview.create"
    ]
  }
}
```

```typescript
// cline-extension/src/extension.ts

import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
  // Works in both VSCode and Principal ADE
  const command = vscode.commands.registerCommand('cline.assist', async () => {
    const panel = vscode.window.createWebviewPanel(
      'cline',
      'AI Assistant',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // Detect Principal ADE for enhanced features
    const ctx = context as any;
    if (ctx.principalADE) {
      // Use enhanced file operations
      panel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
          case 'executeCode':
            const result = await ctx.principalADE.terminal.executeCommand(message.code);
            panel.webview.postMessage({ type: 'result', data: result });
            break;

          case 'editFile':
            const content = await ctx.principalADE.filesystem.readFile(message.path);
            // Process with AI and write back
            await ctx.principalADE.filesystem.writeFile(message.path, processedContent);
            break;
        }
      });
    } else {
      // Fallback to VSCode API
      panel.webview.onDidReceiveMessage(async message => {
        switch (message.command) {
          case 'executeCode':
            const terminal = vscode.window.createTerminal();
            terminal.sendText(message.code);
            terminal.show();
            break;

          case 'editFile':
            const uri = vscode.Uri.file(message.path);
            const document = await vscode.workspace.openTextDocument(uri);
            const edit = new vscode.WorkspaceEdit();
            // Process and apply edits
            await vscode.workspace.applyEdit(edit);
            break;
        }
      });
    }

    panel.webview.html = getWebviewContent();
  });

  context.subscriptions.push(command);
}
```

### 2. Test Runner Extension (With Progressive Enhancement)

```json
// test-runner-extension/package.json
{
  "name": "test-runner",
  "displayName": "Test Runner",
  "version": "1.0.0",
  "publisher": "principal-ai",
  "engines": {
    "vscode": "^1.74.0"
  },
  "activationEvents": [
    "workspaceContains:**/*.test.{js,ts}"
  ],
  "contributes": {
    "commands": [
      {
        "command": "tests.runAll",
        "title": "Run All Tests"
      },
      {
        "command": "tests.runFile",
        "title": "Run Current Test File"
      }
    ]
  },
  "principal-ade": {
    "permissions": [
      "filesystem.watch",
      "process.spawn"
    ],
    "autoWatch": true
  }
}
```

```typescript
// test-runner-extension/src/extension.ts

import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Tests');
  const ctx = context as any;

  // Enhanced test runner with Principal ADE
  if (ctx.principalADE && ctx.principalADE.permissions.includes('filesystem.watch')) {
    const testRunner = new EnhancedTestRunner(ctx.principalADE);

    // Advanced file watching
    const watcher = ctx.principalADE.filesystem.watch('**/*.test.{js,ts}');
    watcher.onDidChange(uri => {
      testRunner.runTestFile(uri.fsPath);
    });

    // Direct process spawning for faster execution
    testRunner.onTestResult(result => {
      outputChannel.appendLine(formatTestResult(result));
    });
  } else {
    // Standard VSCode implementation
    const testRunner = new BasicTestRunner();

    // Use file system watcher
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.test.{js,ts}');
    watcher.onDidChange(uri => {
      const terminal = vscode.window.createTerminal('Test Runner');
      terminal.sendText(`npm test ${uri.fsPath}`);
      terminal.show();
    });

    context.subscriptions.push(watcher);
  }

  // Register commands (work in both environments)
  vscode.commands.registerCommand('tests.runAll', () => {
    outputChannel.appendLine('Running all tests...');
    const terminal = vscode.window.createTerminal('Test Runner');
    terminal.sendText('npm test');
    terminal.show();
  });

  vscode.commands.registerCommand('tests.runFile', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      outputChannel.appendLine(`Running tests in ${editor.document.fileName}`);
      const terminal = vscode.window.createTerminal('Test Runner');
      terminal.sendText(`npm test ${editor.document.fileName}`);
      terminal.show();
    }
  });
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('ExtensionManager', () => {
  it('should load valid extension', async () => {
    const manager = new ExtensionManager();
    await manager.loadExtension('/path/to/extension');
    expect(manager.getExtension('test-extension')).toBeDefined();
  });

  it('should enforce permissions', async () => {
    const manager = new ExtensionManager();
    const extension = await manager.loadExtension('/path/to/extension');

    // Try to access unpermitted API
    expect(() => extension.api.filesystem.writeFile('/etc/passwd', 'hack'))
      .toThrow('Permission denied');
  });

  it('should sandbox extension execution', async () => {
    const sandbox = new ExtensionSandbox('test', []);

    // Try to access forbidden module
    expect(() => sandbox.execute("require('child_process')"))
      .toThrow('Module not allowed');
  });
});
```

## Performance Considerations

1. **Lazy Loading**: Extensions loaded only when activated
2. **Resource Limits**: Memory and CPU limits per extension
3. **Async APIs**: Non-blocking extension operations
4. **Shared Resources**: Efficient resource sharing between extensions

## Security Considerations

1. **Manifest Validation**: Strict schema validation
2. **Permission Model**: Granular permission system
3. **Sandbox Isolation**: VM-based execution isolation
4. **Content Security Policy**: For webview content
5. **Code Signing**: Optional extension signing

## Future Enhancements

1. **Extension Marketplace**: Central repository for extensions
2. **Hot Reload**: Development mode with hot reload
3. **Extension Dependencies**: Inter-extension dependencies
4. **Remote Extensions**: Load extensions from remote sources
5. **Extension Profiling**: Performance monitoring tools

## Conclusion

This design provides a robust, secure, and extensible foundation for supporting loadable extensions. By refactoring the Storybook sidecar implementation into this system, we gain:

- **Reusability**: Core functionality available to all extensions
- **Security**: Sandboxed execution with permission control
- **Flexibility**: Support for diverse extension types
- **Maintainability**: Clear separation of concerns
- **Scalability**: Efficient resource management

The phased migration approach ensures minimal disruption while building toward a fully-featured extension ecosystem.