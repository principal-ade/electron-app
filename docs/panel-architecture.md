# Electron App Panel Infrastructure - Comprehensive Architecture Guide

## Overview

This Electron application uses a sophisticated panel system for displaying various types of content including repositories, code, git information, drawings, terminals, and more. The architecture is built around a registry-based pattern with three-panel layouts and context-driven data management.

## 1. Panel Structure & Definition

### Panel Type System

**File**: `/Users/griever/Developer/electron-app/src/shared/panels/repositoryPanelCatalog.ts`

Panels are defined using a catalog system with the following core types:

```typescript
export type RepositoryPanelSurface =
  | 'explorer'      // For repository browser
  | 'manager'       // For repository management view
  | 'viewer'        // For viewing content
  | 'excalidraw'    // For drawing/diagram editing
  | 'agent'         // For AI agent interactions
  | 'principal';    // For main window/feed

export type RepositoryPanelSlice =
  | 'git'           // Git data slices
  | 'markdown'      // Markdown files
  | 'fileTree'      // File structure
  | 'packages'      // Package information
  | 'quality'       // Quality metrics
  | 'graphs';       // Dependency graphs
```

### Panel Definition Interface

```typescript
export interface RepositoryPanelDefinitionBase {
  id: string;                                    // Unique panel ID
  label: string;                                 // Display label
  description?: string;                          // Panel description
  surfaces: readonly RepositoryPanelSurface[];   // Where panel appears
  slices?: readonly RepositoryPanelSlice[];      // Required data slices
}
```

### Existing Panel Catalog

The app includes 29+ pre-defined panels:

- **Git Operations**: gitChanges, gitIssues, gitPullRequests, gitHistory, gitDiff, gitStatus
- **GitHub Integration**: githubProjects, githubSocial, githubReadme
- **Visualization**: cityVisualization, excalidrawEditor, drawings, graphsList, graphDetail
- **Terminals**: multiTerminal
- **Content Viewers**: fileTree, search, codeViewer, markdownViewer, mdxEditor
- **Development**: tools, dependencies, packageInfo, docs
- **Collaboration**: presence, agentContext, agentEvents, agentSessions
- **Repository Management**: actions, tasks

---

## 2. Panel Registration & Routing System

### Registry File Structure

**File**: `/Users/griever/Developer/electron-app/src/renderer/panels/registry.tsx`

The registry maps panel definitions to their React render components:

```typescript
export interface RepositoryPanelRenderProps {
  context: RepositoryPanelContextValue;
  actions: RepositoryPanelActions;
}

type RepositoryPanelRenderer = (
  props: RepositoryPanelRenderProps,
) => React.ReactNode;

export type RepositoryPanelDefinition = RepositoryPanelDefinitionBase & {
  render?: RepositoryPanelRenderer;
};

// Panel renderers mapping
const panelRenderers: Partial<Record<RepositoryPanelId, RepositoryPanelRenderer>> = {
  gitChanges: ({ actions }) => (
    <GitChangesPanel onFileClick={actions.openFile} />
  ),
  gitIssues: ({ context }) => (
    <GitIssuesPanel repository={context.repository ?? undefined} />
  ),
  multiTerminal: ({ context }) => (
    <MultiTerminalPanel directory={context.repositoryPath || ''} />
  ),
  // ... other panels
};
```

### Panel Discovery Functions

```typescript
// Get panels for a specific surface
export function getRepositoryPanelsForSurface(
  surface: RepositoryPanelSurface | RepositoryPanelSurface[],
): RepositoryPanelDefinition[] {
  const surfaces = Array.isArray(surface) ? surface : [surface];
  return repositoryPanelDefinitions.filter((definition) =>
    definition.surfaces.some((panelSurface) => surfaces.includes(panelSurface)),
  );
}

// Get specific panel definition
export function getRepositoryPanelDefinition(
  id: RepositoryPanelId,
): RepositoryPanelDefinition {
  const definition = repositoryPanelDefinitionMap.get(id);
  if (!definition) {
    throw new Error(`Unknown repository panel definition: ${id}`);
  }
  return definition;
}

// Initialize default visibility for panels
export function createDefaultPanelVisibility({
  surfaces,
}: {
  surfaces?: RepositoryPanelSurface[];
} = {}): RepositoryPanelVisibility {
  // Returns { visibility: {panelId: boolean}, order: [panelId] }
}
```

---

## 3. Context & Data Flow

### Panel Context System

**File**: `/Users/griever/Developer/electron-app/src/renderer/panels/RepositoryPanelProvider.tsx`

Panels receive data through a React Context system:

```typescript
export interface RepositoryPanelContextValue {
  repositoryPath: string | null;
  repository: EnhancedAlexandriaEntry | null;
  gitStatus: GitStatus;
  gitStatusLoading: boolean;
  markdownFiles: MarkdownFile[];
  fileTree: FileTree | null;
  packages: PackageLayer[] | null;
  quality: QualityMetrics | null;
  loading: boolean;
  refresh: () => Promise<void>;
  actions: RepositoryPanelActions;
  hasSlice: (slice: RepositoryPanelSlice) => boolean;
  isSliceLoading: (slice: RepositoryPanelSlice) => boolean;
}

export interface RepositoryPanelActions {
  openFile?: (filePath: string) => void;
  openGitDiff?: (filePath: string, status?: GitChangeSelectionStatus) => void;
}
```

### Data Slices

The context tracks which data is loaded via slices:
- **git**: Git status (staged, unstaged, untracked, deleted files)
- **markdown**: Markdown files in repository
- **fileTree**: File structure tree
- **packages**: Package/dependency information
- **quality**: Code quality metrics

---

## 4. IPC Communication Patterns

### Renderer Process Services

**Base Pattern**: `/Users/griever/Developer/electron-app/src/renderer/main-process-api/`

Services in the renderer process communicate with the main process via IPC:

```typescript
// Example: TerminalService
export class TerminalService {
  static async list(): Promise<TerminalInfo[]> {
    return window.mainProcess.terminal.list();
  }

  static async create(dir: string, context?: string): Promise<string> {
    return window.mainProcess.terminal.create(dir, context);
  }

  static async write(id: string, data: string): Promise<void> {
    return window.mainProcess.terminal.write(id, data);
  }

  static async onData(
    callback: (data: TerminalData) => void,
  ): Promise<() => void> {
    return window.mainProcess.terminal.onData(callback);
  }
  // ... more methods
}
```

### IPC Interface Definition

**File**: `/Users/griever/Developer/electron-app/src/shared/main-process-api-interfaces/TerminalService.ts`

```typescript
export enum TerminalAPIEvents {
  CREATE = 'terminal:create',
  WRITE = 'terminal:write',
  RESIZE = 'terminal:resize',
  DESTROY = 'terminal:destroy',
  ON_DATA = 'terminal:data',
  ON_EXIT = 'terminal:exit',
  // ... more events
}

export interface TerminalAPI {
  create: (directory: string, context?: string) => Promise<string>;
  write: (sessionId: string, data: string) => Promise<void>;
  resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
  destroy: (sessionId: string) => Promise<void>;
  onData: (callback: (data: TerminalData) => void) => () => void;
  // ... more methods
}
```

### IPC Implementation

**File**: `/Users/griever/Developer/electron-app/src/window/main-process-api-implementations/terminalApi.ts`

```typescript
export const terminalAPI: TerminalAPI = {
  create: async (directory: string, context?: string): Promise<string> => {
    return ipcRenderer.invoke(TerminalAPIEvents.CREATE, directory, context);
  },

  onData: (callback: (data: TerminalData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: TerminalData) =>
      callback(data);
    ipcRenderer.on(TerminalAPIEvents.ON_DATA, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.ON_DATA, listener);
    };
  },
  // ... more methods
};
```

### Shell Service Pattern

**File**: `/Users/griever/Developer/electron-app/src/renderer/main-process-api/ShellService.ts`

```typescript
export class ShellService {
  static async openExternal(url: string): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.shell.openExternal(url);
  }

  static async runCommand(
    command: string,
    options?: { cwd?: string; timeout?: number },
  ): Promise<{ success: boolean; output?: string; stderr?: string; code?: number }> {
    return window.mainProcess.shell.runCommand(command, options);
  }

  static async openInTerminal(params: {
    terminal: TerminalId;
    dir: string;
    command?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.shell.openInTerminal(params);
  }

  static async checkCommand(command: string): Promise<{
    exists: boolean;
    path?: string;
  }> {
    return window.mainProcess.shell.checkCommand(command);
  }
}
```

---

## 5. Terminal/Webview Content Handling

### Terminal Panel Implementation

**File**: `/Users/griever/Developer/electron-app/src/renderer/panels/TerminalPanelPackaged.tsx`

The app has a sophisticated terminal panel system:

```typescript
interface TerminalPanelPackagedProps {
  directory: string;              // Working directory
  context?: string;               // Context identifier
  onClose?: () => void;           // Close handler
  onDestroy?: () => void;         // Destroy handler
  className?: string;             // Styling
  agentSessionId?: string;        // Associated AI session
  terminalId?: string;            // Existing session to attach to
  autoFocus?: boolean;            // Auto focus terminal
  hideHeader?: boolean;           // Hide header UI
  isVisible?: boolean;            // Visibility toggle
  onSessionCreated?: (sessionId: string) => void;  // Session creation handler
  initialCommand?: string;        // Command to run on init
}

export interface TerminalPanelPackagedRef {
  scrollToBottom: () => void;
  focus: () => void;
  getTerminal: () => Terminal | null;
}
```

**Key Features**:
- Manages terminal sessions via TerminalService
- Handles ownership tracking (multi-window support)
- Subscribes to terminal data via IPC events
- Supports re-attaching to existing sessions

### Multi-Terminal Panel Architecture

**File**: `/Users/griever/Developer/electron-app/src/renderer/panels/components/MultiTerminalPanel.tsx`

```typescript
// Supports both tabbed and carousel layouts
export const MultiTerminalPanel = forwardRef<
  TabbedTerminalPanelRef | CarouselTerminalPanelRef,
  MultiTerminalPanelProps
>((props, ref) => {
  const [viewMode, setViewMode] = useState<TerminalViewMode>('tabbed');
  // Switches between TabbedTerminalPanel and CarouselTerminalPanel
});
```

### Tabbed Terminal Panel

**File**: `/Users/griever/Developer/electron-app/src/renderer/panels/components/TabbedTerminalPanel.tsx`

Implements a tab-based terminal interface:

```typescript
interface TerminalTab {
  id: string;
  label: string;
  directory: string;
  command?: string;
  isActive: boolean;
}

// Tracks multiple terminal sessions and switches between them
// Each tab gets its own TerminalPanelPackaged instance
// Tab visibility controlled via CSS (display: isActiveTab ? 'flex' : 'none')
```

### Handling External URLs/Content

The app uses iframe/webview-like approaches through:

1. **ShellService.openExternal()** - Opens URLs in browser
2. **Markdown rendering** - Renders markdown content (MarkdownDocumentViewer)
3. **GitHub README panel** - Fetches and displays markdown from GitHub
4. **Canvas-based visualization** - City visualization, Excalidraw diagrams

Example from GitHubReadmePanel:

```typescript
const fetchReadme = useCallback(async () => {
  const content = await GithubService.getFileContent(owner, repo, 'README.md');
  setReadmeContent(content);
}, [repository]);

// Renders markdown content with themed-markdown library
const slides = parseMarkdownIntoPresentation(readmeContent);
```

---

## 6. Process Management & Monitoring

### Terminal Management (Main Process)

**File**: `/Users/griever/Developer/electron-app/src/main/terminal.ts`

```typescript
interface TerminalSession {
  id: string;
  pty: any;                           // node-pty instance
  directory: string;
  context?: string;                   // Context identifier
  agentSessionId?: string;            // Associated AI session
  createdAt: number;
  lastActivity: number;
  ownedByWindowId?: number;           // Multi-window ownership
  ownershipClaimedAt?: number;
}

class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionsByRepo: Map<string, string> = new Map();
  private maxSessions = 20;
  private terminalWindows: Map<string, BrowserWindow> = new Map();
  private rendererWindows: Set<BrowserWindow> = new Set();

  // Setup IPC handlers for all terminal operations
  private setupIPCHandlers() { /* ... */ }

  // Broadcast events to renderer windows
  private broadcastToRendererWindows(channel: string, payload: unknown) { /* ... */ }
}
```

### Dev Server Support

**File**: `/Users/griever/Developer/electron-app/src/shared/types/devServer.types.ts`

The app has infrastructure for managing dev servers:

```typescript
export interface DevServerDescriptor {
  id?: string;
  command: string;                      // npm, yarn, etc.
  args?: string[];                       // ['run', 'dev']
  cwd: string;                           // Working directory
  env?: Record<string, string>;          // Environment variables
  port?: number;                         // Preferred port
  fallbackPort?: number;                 // Alternate port
  readyPattern?: string;                 // Ready detection regex
  readyTimeoutMs?: number;
  label?: string;
  urlTemplate?: string;                  // http://localhost:PORT
  build?: {                              // Pre-execution build step
    command: string;
    args?: string[];
  };
}

export interface DevServerProcessState {
  descriptor: DevServerDescriptor;
  process?: ChildProcessWithoutNullStreams | null;
  status: DevServerLifecycleStatus;      // idle|starting|running|stopped|error
  logs: DevServerLogEntry[];
  url?: string;                          // Generated URL when ready
  port?: number;
  startedAt?: number;
  readyAt?: number;
  lastError?: string;
}
```

### Localhost URL Examples in Codebase

The app is already set up to work with localhost services:

```typescript
// Git Sync Service
'ws://localhost:3001'

// Dev Server configs
'http://localhost:3000'      // Main dev server
'http://localhost:3002'      // Orbit server
'ws://localhost:3003/orbit/signal'  // WebSocket

// Callimachus connection
'http://localhost:8000/api/v1'
```

---

## 7. Example Panel Implementation Pattern

### GitChangesPanel Example

**File**: `/Users/griever/Developer/electron-app/src/renderer/panels/components/GitChangesPanel.tsx`

```typescript
export const GitChangesPanel: React.FC<GitChangesPanelProps> = ({
  onFileClick,
  emptyMessage = 'No git changes to display',
  variant = 'panel',
  selectedFile,
}) => {
  // 1. Get context data
  const {
    repository,
    repositoryPath,
    gitStatus,
    gitStatusLoading,
    actions,
    fileTree,
  } = useRepositoryPanelContext();

  // 2. Process data
  const getFileStatus = useCallback((filePath: string) => {
    if (gitStatus.staged.some((f) => f.path === filePath)) return 'staged';
    if (gitStatus.deleted.some((f) => f.path === filePath)) return 'deleted';
    // ... more checks
  }, [gitStatus]);

  // 3. Handle user interaction
  const handleFileSelect = useCallback((filePath: string) => {
    const status = getFileStatus(filePath);
    if (onFileClick) {
      onFileClick(filePath, status);
      return;
    }
    if (openGitDiff) {
      openGitDiff(filePath, status);
    }
  }, [getFileStatus, onFileClick, openGitDiff, openFile]);

  // 4. Render tree view
  return (
    <div>
      {gitStatusLoading ? (
        <LoadingState />
      ) : (
        <GitStatusFileTree
          onSelect={handleFileSelect}
          // ... props
        />
      )}
    </div>
  );
};
```

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Main Window (Renderer)               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  IntegratedShell / RepositoryExplorer            │   │
│  │  (View Container)                                │   │
│  ├──────────────────────────────────────────────────┤   │
│  │                                                  │   │
│  │  RepositoryPanelProvider (Context Provider)     │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │ Panel Rendering Layer                    │   │   │
│  │  │                                          │   │   │
│  │  │ ┌────────────────┐  ┌────────────────┐  │   │   │
│  │  │ │ GitChangesPanel│  │ MultiTerminal  │  │   │   │
│  │  │ │ (uses context) │  │ Panel          │  │   │   │
│  │  │ └────────────────┘  └────────────────┘  │   │   │
│  │  │                                          │   │   │
│  │  │ ┌────────────────┐  ┌────────────────┐  │   │   │
│  │  │ │ GitHubReadme   │  │ Other Panels   │  │   │   │
│  │  │ │ Panel          │  │ (40+)          │  │   │   │
│  │  │ └────────────────┘  └────────────────┘  │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│           │                                      │      │
│           ▼                                      ▼      │
│  ┌────────────────────┐              ┌──────────────┐  │
│  │ Services (IPC)     │              │ShellService  │  │
│  │ - TerminalService  │              │openExternal()│  │
│  │ - GitService       │              │runCommand()  │  │
│  │ - GithubService    │              │checkCommand()│  │
│  └────────────────────┘              └──────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                                    │
         │ IPC Calls                          │ IPC Calls
         ▼                                    ▼
┌─────────────────────────────────────────────────────────┐
│                  Main Process (Node.js)                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ TerminalManager                                  │   │
│  │ ┌────────────────────────────────────────────┐   │   │
│  │ │ Terminal Sessions                          │   │   │
│  │ │ - Session 1 (node-pty) ──→ PTY Process    │   │   │
│  │ │ - Session 2 (node-pty) ──→ PTY Process    │   │   │
│  │ │ - Session N ...                            │   │   │
│  │ └────────────────────────────────────────────┘   │   │
│  │                                                   │   │
│  │ Broadcasting (send to all renderer windows)     │   │
│  │ - terminal:data events                          │   │
│  │ - terminal:exit events                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Shell Handler                                    │   │
│  │ - Shell command execution                        │   │
│  │ - External URL opening                           │   │
│  │ - Command availability checking                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Dev Server/Process Monitoring                    │   │
│  │ - DevServerManager (future integration)         │   │
│  │ - Can monitor localhost services                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Creating a New "Localhost Processes" Panel

Based on the architecture, here's how to create a panel that lists localhost processes:

### Step 1: Define Panel in Catalog

Add to `/Users/griever/Developer/electron-app/src/shared/panels/repositoryPanelCatalog.ts`:

```typescript
{
  id: 'localhostProcesses',
  label: 'Localhost Processes',
  description: 'Monitor and manage running localhost services and development servers.',
  slices: [] as const,
  surfaces: ['manager', 'principal'] as const,
},
```

### Step 2: Create Panel Component

Create `/Users/griever/Developer/electron-app/src/renderer/panels/components/LocalhostProcessesPanel.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Globe, RotateCw, Zap } from 'lucide-react';

interface LocalhostProcess {
  id: string;
  name: string;
  port: number;
  url: string;
  status: 'running' | 'starting' | 'stopped' | 'error';
  pid?: number;
  startedAt?: number;
  log?: string[];
}

export const LocalhostProcessesPanel: React.FC = () => {
  const { theme } = useTheme();
  const [processes, setProcesses] = useState<LocalhostProcess[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch processes from main process via new service
    // loadProcesses();
  }, []);

  const handleProcessClick = async (process: LocalhostProcess) => {
    // Open in browser
    await ShellService.openExternal(process.url);
  };

  return (
    <div style={{ padding: '16px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Globe size={16} />
        <span>Running Services</span>
        <button onClick={() => setLoading(true)}>
          <RotateCw size={14} />
        </button>
      </div>

      {loading && <div>Loading processes...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {processes.map((process) => (
          <div
            key={process.id}
            onClick={() => handleProcessClick(process)}
            style={{
              padding: '12px',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{process.name}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                {process.url}
              </div>
            </div>
            <div style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: process.status === 'running' ? '#4CAF50' : '#999',
            }}>
              {process.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Step 3: Register in Panel Registry

Add to `/Users/griever/Developer/electron-app/src/renderer/panels/registry.tsx`:

```typescript
import { LocalhostProcessesPanel } from './components/LocalhostProcessesPanel';

const panelRenderers: Partial<Record<RepositoryPanelId, RepositoryPanelRenderer>> = {
  // ... existing renderers
  localhostProcesses: () => <LocalhostProcessesPanel />,
};
```

### Step 4: Create Main Process Service

Create `/Users/griever/Developer/electron-app/src/renderer/main-process-api/ProcessMonitorService.ts`:

```typescript
export class ProcessMonitorService {
  static async listLocalhostProcesses(): Promise<LocalhostProcess[]> {
    return window.mainProcess.processMonitor.listLocalhostProcesses();
  }

  static onProcessUpdated(
    callback: (processes: LocalhostProcess[]) => void,
  ): () => void {
    return window.mainProcess.processMonitor.onProcessUpdated(callback);
  }
}
```

### Step 5: Create IPC Interface

Create `/Users/griever/Developer/electron-app/src/shared/main-process-api-interfaces/ProcessMonitorAPI.ts`:

```typescript
export enum ProcessMonitorAPIEvents {
  LIST_LOCALHOST = 'processMonitor:listLocalhost',
  ON_PROCESS_UPDATED = 'processMonitor:updated',
}

export interface ProcessMonitorAPI {
  listLocalhostProcesses: () => Promise<LocalhostProcess[]>;
  onProcessUpdated: (callback: (processes: LocalhostProcess[]) => void) => () => void;
}
```

### Step 6: Implement Main Process Handler

Create `/Users/griever/Developer/electron-app/src/main/processMonitor.ts`:

```typescript
import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ProcessMonitorAPIEvents } from '../shared/main-process-api-interfaces/ProcessMonitorAPI';

const execAsync = promisify(exec);

class ProcessMonitor {
  private rendererWindows: Set<BrowserWindow> = new Set();

  constructor() {
    this.setupIPCHandlers();
  }

  private setupIPCHandlers() {
    ipcMain.handle(
      ProcessMonitorAPIEvents.LIST_LOCALHOST,
      async () => this.listLocalhostProcesses(),
    );
  }

  async listLocalhostProcesses(): Promise<LocalhostProcess[]> {
    try {
      // macOS: lsof -i -P -n | grep LISTEN
      // Linux: netstat -tlnp | grep LISTEN
      // Windows: netstat -ano | findstr LISTENING
      
      const { stdout } = await execAsync('lsof -i -P -n | grep LISTEN');
      
      // Parse output and extract localhost processes
      const processes = parseLocalhostProcesses(stdout);
      return processes;
    } catch (error) {
      console.error('Failed to list processes:', error);
      return [];
    }
  }

  private parseLocalhostProcesses(output: string): LocalhostProcess[] {
    // Parse lsof output and map to LocalhostProcess objects
    // Extract: port, process name, PID
  }

  setMainWindow(window: BrowserWindow) {
    this.rendererWindows.add(window);
  }
}

export const processMonitor = new ProcessMonitor();
```

---

## 10. Key Files Reference

### Panel System Files
- `/Users/griever/Developer/electron-app/src/shared/panels/repositoryPanelCatalog.ts` - Panel definitions
- `/Users/griever/Developer/electron-app/src/renderer/panels/registry.tsx` - Panel registration
- `/Users/griever/Developer/electron-app/src/renderer/panels/panelPreviews.tsx` - Panel previews
- `/Users/griever/Developer/electron-app/src/renderer/panels/RepositoryPanelProvider.tsx` - Context provider
- `/Users/griever/Developer/electron-app/src/renderer/panels/components/` - 49+ panel implementations

### IPC Communication Files
- `/Users/griever/Developer/electron-app/src/window/main-process-api-implementations/terminalApi.ts` - IPC bridge
- `/Users/griever/Developer/electron-app/src/shared/main-process-api-interfaces/TerminalService.ts` - Type definitions
- `/Users/griever/Developer/electron-app/src/renderer/main-process-api/TerminalService.ts` - Renderer service wrapper

### Terminal/Process Management Files
- `/Users/griever/Developer/electron-app/src/main/terminal.ts` - Terminal manager (main process)
- `/Users/griever/Developer/electron-app/src/main/terminalEnvironment.ts` - Terminal environment
- `/Users/griever/Developer/electron-app/src/main/terminalWrapper.ts` - Terminal wrapper utilities
- `/Users/griever/Developer/electron-app/src/shared/types/devServer.types.ts` - Dev server types

### Example Panel Implementations
- `/Users/griever/Developer/electron-app/src/renderer/panels/components/TabbedTerminalPanel.tsx` - Multi-terminal with tabs
- `/Users/griever/Developer/electron-app/src/renderer/panels/components/GitChangesPanel.tsx` - Context-based panel
- `/Users/griever/Developer/electron-app/src/renderer/panels/components/GitHubReadmePanel.tsx` - Content loading panel
- `/Users/griever/Developer/electron-app/src/renderer/panels/components/TerminalPanelPackaged.tsx` - Advanced terminal integration

---

## 11. Communication Flow Example: Terminal Session

```
User Action (Click open terminal in localhost:3000)
    ↓
Panel Component calls ShellService.openExternal('http://localhost:3000')
    ↓
ShellService.openExternal → ipcRenderer.invoke('shell:openExternal', url)
    ↓
[IPC Bridge in main process]
    ↓
Main Process Shell Handler → shell.openExternal(url)
    ↓
Opens URL in system browser
```

---

## Summary

The panel infrastructure is built on:

1. **Catalog-based registration** - All panels defined in `repositoryPanelCatalog.ts`
2. **Context-driven data** - `RepositoryPanelProvider` supplies data via React Context
3. **IPC for async operations** - Services bridge renderer and main process
4. **Ownership management** - Multi-window support with session tracking
5. **Flexible surfaces** - Panels can appear in multiple surfaces (explorer, manager, agent, principal, etc.)
6. **Data slices** - Panels declare which data they need, lazy loaded on demand

The existing terminal and shell infrastructure makes it straightforward to:
- List running processes
- Show localhost URLs/services
- Display browser content via external opening
- Manage multiple concurrent sessions
- Track process state and communicate changes to renderer

