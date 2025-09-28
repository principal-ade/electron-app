# Repository Monitoring Server - Implementation Plan

## Overview
The Repository Monitoring Server will be a separate utility process (like event-processing-server) that provides quality metrics and repository information to the renderer process via IPC. It will build upon existing FileTree creation patterns and extend them with quality analysis capabilities. Running as a separate process ensures the main process remains lightweight and responsive while performing CPU-intensive quality analysis tasks.

## Milestone 1 Implementation Notes (COMPLETED)

### Key Learnings and Corrections

#### Webpack Bundling Requirements (CRITICAL)
1. **Worker processes require webpack bundles**
   - Raw JS files won't work due to path resolution issues
   - Development runs from `.erb/dll/` not source directories
   - Production runs from `dist/main/`

2. **Bundle Configuration**
   - Add entry point in webpack config for worker
   - Configure externals to bundle all dependencies
   - Worker bundles must be self-contained

3. **Path Resolution in RepositoryMonitoringManager**
   ```typescript
   if (!app.isPackaged) {
     // Development: webpack bundle in .erb/dll/
     workerPath = path.join(__dirname, 'repository-monitoring-worker.bundle.dev.js');
   } else {
     // Production: webpack bundle in dist/main/
     workerPath = path.join(__dirname, 'repository-monitoring-worker.js');
   }
   ```

1. **Package Versions Matter**
   - `@principal-ai/repository-abstraction` must be v0.2.0+ for `GitFileTreeBuilder` exports
   - Run `npm install @principal-ai/repository-abstraction@0.2.0` if needed

2. **Type Reuse is Critical**
   - Always import types from existing packages instead of recreating them
   - Use `PackageLayer` from `@principal-ai/codebase-composition`
   - Use `QualityMetrics` from `@principal-ai/codebase-composition`
   - Use `LensResult` from `@principal-ai/codebase-quality-lenses` instead of custom `ToolResult`

3. **IPC Pattern Requirements**
   - Use `ipcRenderer.invoke()` directly in renderer services, NOT `window.api.invoke()`
   - Always define IPC events in an enum in `shared/main-process-api-interfaces/`
   - Register handlers in `src/main/initialization.ts`

4. **Code Style Conventions**
   - No inline union types - extract to separate type definitions
   - Use enums for event names to share between main and renderer
   - Avoid `any` type - use `unknown` or proper types from packages

5. **GitFileTreeBuilder Usage**
   - Use `commitSha` property, not `sha` in `GitSource`
   - Include `isDirty` flag from git status
   - Convert absolute paths to relative paths for the `files` array

### Files Created in Milestone 1 (TO BE MOVED)
Current location (to be moved to match separate process architecture):
- `src/main/repository-monitoring/types.ts` → `src/repository-monitoring-server/types.ts`
- `src/main/repository-monitoring/RepositoryMonitoringServer.ts` → `src/repository-monitoring-server/RepositoryMonitoringServer.ts`
- `src/main/repository-monitoring/FileTreeBuilder.ts` → `src/repository-monitoring-server/FileTreeBuilder.ts`
- `src/main/repository-monitoring/ipcHandlers.ts` → (replaced by worker-entry.ts and message handlers)

Files that remain in current locations:
- `src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts` - Shared API types
- `src/renderer/main-process-api/RepositoryMonitoringService.ts` - Renderer service

New files needed for separate process:
- `src/repository-monitoring-server/worker-entry.ts` - Worker process entry point
- `src/repository-monitoring-server/types.ts` - Message types for IPC
- `src/main/repository-monitoring/RepositoryMonitoringManager.ts` - Manager in main process
- `src/main/repository-monitoring/RepositoryMonitoringManager.test.ts` - Comprehensive test suite
- `.erb/configs/webpack.config.main.dev.ts` - Updated with worker entry point
- `.erb/configs/webpack.config.main.prod.ts` - Updated with worker entry point

### Quick Reference for Milestone 2 Team

**Key Imports You'll Need:**
```typescript
// For package analysis
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type { QualityMetrics } from '@principal-ai/codebase-composition';

// For tool execution
import type { LensResult, ToolConfiguration } from '@principal-ai/codebase-quality-lenses';
import { LensManager } from '@principal-ai/codebase-quality-lenses';

// Existing infrastructure to use
import { ElectronCLIBridgeExecutor } from '../quality-lenses/ElectronCLIBridgeExecutor';
import { PackageLayerToToolConfigBridge } from '../quality-lenses/PackageLayerToToolConfigBridge';
```

**Commands to Run Before Starting:**
```bash
# Ensure packages are up to date
npm list @principal-ai/repository-abstraction  # Should show v0.2.0+
npm list @principal-ai/codebase-composition     # Should show v0.2.0+
npm list @principal-ai/codebase-quality-lenses  # Should show latest

# Verify Milestone 1 code
npm run typecheck
npm run lint

# If you get type errors about missing exports
npm install @principal-ai/repository-abstraction@0.2.0
```

## Existing Package Infrastructure

The codebase already has several key packages that we'll leverage:

1. **@principal-ai/repository-abstraction** (v0.2.0) ⚠️ IMPORTANT
   - Provides `FileTree` and `GitFileTreeBuilder` types
   - Used for creating git-aware file trees
   - **NOTE**: Version 0.2.0+ required for `GitFileTreeBuilder` and `GitSource` exports

2. **@principal-ai/codebase-composition** (v0.2.0)
   - Provides `PackageLayer` type for package information
   - Provides `QualityMetrics` type for quality scoring
   - Used extensively in renderer for package analysis

3. **@principal-ai/codebase-quality-lenses**
   - Provides `ToolConfiguration` for tool execution
   - Provides `LensManager` for quality tool orchestration
   - Already integrated via `ElectronCLIBridgeExecutor` (see: `src/main/quality-lenses/`)

4. **Existing Bridges**
   - `PackageLayerToToolConfigBridge`: Converts PackageLayer → ToolConfiguration
   - `ElectronCLIBridgeExecutor`: Executes tools via electron-cli-bridge
   - `GitLensAdapter`: Provides git operations for quality analysis

## Current FileTree Creation Process

### How FileTree is Currently Built

1. **Renderer Process** (`loadFileSystemTree.ts`):
   - Calls `FileSystemService.buildFilteredFileTree()` via IPC
   - Uses `@principal-ai/codebase-composition` FileSystemModule
   - Transforms simple path arrays into rich FileTree structures

2. **Main Process** (`fileSystemHandlers.ts`):
   - Uses `globby` for file discovery with automatic .gitignore support
   - Applies universal ignore patterns (node_modules, dist, etc.)
   - Returns filtered paths array to renderer

3. **Key Components**:
   ```typescript
   // Main process builds filtered paths
   buildFilteredFileTree(directoryPath) → paths[]

   // Renderer transforms to FileTree
   transformPathsToFileTree(paths) → FileTree {
     sha, root, allFiles, allDirectories, stats
   }
   ```

## Repository Monitoring Server Architecture

### 1. Server Location and Structure (Separate Process)

```
src/
├── repository-monitoring-server/             # Separate utility process (like event-processing-server)
│   ├── RepositoryMonitoringServer.ts        # Main server class
│   ├── QualityMetricsProcessor.ts           # Quality analysis logic
│   ├── FileTreeBuilder.ts                   # FileTree creation
│   ├── ToolRunner.ts                        # Runs linting/testing tools
│   ├── worker-entry.ts                      # Worker process entry point
│   └── types.ts                             # Type definitions & IPC messages
├── main/
│   └── repository-monitoring/
│       └── RepositoryMonitoringManager.ts   # Manages the utility process from main
```

### 2. Core Components

#### A. RepositoryMonitoringManager (Main Process)
Manages the utility process from the main process:

```typescript
// src/main/repository-monitoring/RepositoryMonitoringManager.ts
export class RepositoryMonitoringManager extends EventEmitter {
  private worker: UtilityProcess | null = null;
  private isRunning = false;
  private messageQueue = new Map<string, (response: any) => void>();

  async start(): Promise<void> {
    this.worker = utilityProcess.fork(
      path.join(__dirname, '../repository-monitoring-server/worker-entry.js')
    );
    // Set up message handlers
  }

  async getFileTree(path: string): Promise<FileTree> {
    return this.sendRequest({ type: 'getFileTree', path });
  }

  async getQualityMetrics(path: string): Promise<ExtendedQualityMetrics> {
    return this.sendRequest({ type: 'getMetrics', path });
  }
}
```

#### B. RepositoryMonitoringServer (Worker Process)
Main server that coordinates all monitoring activities in the worker process:

```typescript
// src/repository-monitoring-server/RepositoryMonitoringServer.ts
class RepositoryMonitoringServer {
  private repositories: Map<string, RepositoryState>;
  private fileTreeCache: Map<string, CachedFileTree>;
  private metricsCache: Map<string, QualityMetrics>;

  // Core methods
  async registerRepository(path: string): Promise<void>
  async unregisterRepository(path: string): Promise<void>
  async getFileTree(path: string): Promise<FileTree>
  async getQualityMetrics(path: string): Promise<ExtendedQualityMetrics>
  async refreshRepository(path: string): Promise<void>

  // Message handler for IPC
  async handleMessage(message: MainToServerMessage): Promise<any> {
    switch(message.type) {
      case 'getFileTree':
        return this.getFileTree(message.path);
      case 'getMetrics':
        return this.getQualityMetrics(message.path);
    }
  }
}
```

#### C. FileTreeBuilder
Builds FileTree using GitFileTreeBuilder from @principal-ai/repository-abstraction:

```typescript
import { GitFileTreeBuilder, GitSource } from '@principal-ai/repository-abstraction';
import { GitService } from '../git-service';

class RepositoryFileTreeBuilder {
  private gitTreeBuilder = new GitFileTreeBuilder();

  async buildFileTree(repoPath: string): Promise<FileTree> {
    // 1. Get files from file system with globby
    const { paths, stats } = await fileSystemAdapter.buildFilteredFileTree(repoPath, {
      gitignore: true,
      includeStats: true
    });

    // 2. Get git information
    const gitInfo = await this.getGitInfo(repoPath);

    // 3. Build GitSource
    const gitSource: GitSource = {
      commitSha: gitInfo.currentCommit,
      branch: gitInfo.branch,
      isDirty: gitInfo.isDirty,
      rootPath: repoPath,
      files: paths.map((path, index) => ({
        path,
        size: stats?.[index]?.size,
        lastModified: stats?.[index]?.lastModified
      }))
    };

    // 4. Use GitFileTreeBuilder to create properly structured FileTree
    const fileTree = this.gitTreeBuilder.build(gitSource);

    // 5. Enhance with additional metadata
    return this.enhanceFileTree(fileTree, repoPath);
  }

  private async getGitInfo(repoPath: string) {
    const [currentCommit, branch, status] = await Promise.all([
      GitService.getCurrentCommit(repoPath),
      GitService.getCurrentBranch(repoPath),
      GitService.getStatus(repoPath)
    ]);

    return {
      currentCommit: currentCommit.sha,
      branch: branch.branch,
      isDirty: status.staged.length > 0 || status.unstaged.length > 0
    };
  }

  private async enhanceFileTree(tree: FileTree, repoPath: string): Promise<FileTree> {
    // Add package.json info
    const packageInfo = await this.getPackageInfo(repoPath);

    // The GitFileTreeBuilder already provides:
    // - Proper tree structure with root, allFiles, allDirectories
    // - Statistics (totalFiles, totalDirectories, totalSize, maxDepth)
    // - Metadata with git information
    // - SHA for caching/comparison

    // We just need to add any app-specific enhancements
    return {
      ...tree,
      appMetadata: {
        hasPackageJson: !!packageInfo,
        packageName: packageInfo?.name,
        dependencies: packageInfo?.dependencies ? Object.keys(packageInfo.dependencies).length : 0,
        devDependencies: packageInfo?.devDependencies ? Object.keys(packageInfo.devDependencies).length : 0
      }
    };
  }
}
```

#### D. PackageProcessor
Extracts and analyzes package information using codebase-composition:

```typescript
import { PackageLayer, FileSystemTree } from '@principal-ai/codebase-composition';
// Note: The codebase already uses PackageLayer from codebase-composition
// See: src/main/quality-lenses/PackageLayerToToolConfigBridge.ts

class PackageProcessor {
  async extractPackages(fileTree: FileTree): Promise<PackageLayer[]> {
    // Use codebase-composition to find all package.json files
    // PackageLayer already includes all needed package information
    const packages = await this.analyzePackages(fileTree);

    // Returns array of packages found in the repository
    // Each PackageLayer includes:
    return packages.map(pkg => ({
      path: pkg.path,                    // e.g., "./", "./packages/ui", etc.
      name: pkg.name,                     // from package.json name field
      version: pkg.version,               // from package.json version
      dependencies: pkg.dependencies,     // { name: version } map
      devDependencies: pkg.devDependencies,
      scripts: pkg.scripts,               // Available npm scripts
      type: pkg.type,                     // 'module' | 'commonjs' | undefined
      main: pkg.main,                     // Entry point
      workspaces: pkg.workspaces,         // Monorepo workspaces
    }));
  }

  async getPackageSummary(packages: PackageInfo[]): Promise<PackageSummary> {
    const rootPackage = packages.find(p => p.path === './' || p.path === '.');
    const workspacePackages = packages.filter(p => p.path !== './' && p.path !== '.');

    // Aggregate all dependencies
    const allDependencies = new Set<string>();
    const allDevDependencies = new Set<string>();

    packages.forEach(pkg => {
      Object.keys(pkg.dependencies || {}).forEach(d => allDependencies.add(d));
      Object.keys(pkg.devDependencies || {}).forEach(d => allDevDependencies.add(d));
    });

    return {
      isMonorepo: workspacePackages.length > 0,
      rootPackageName: rootPackage?.name,
      totalPackages: packages.length,
      workspacePackages: workspacePackages.map(p => ({
        name: p.name,
        path: p.path
      })),
      totalDependencies: allDependencies.size,
      totalDevDependencies: allDevDependencies.size,
      availableScripts: rootPackage?.scripts ? Object.keys(rootPackage.scripts) : []
    };
  }
}
```

#### E. QualityMetricsProcessor
Analyzes each package independently (no aggregation in v1):

```typescript
import { QualityMetrics } from '@principal-ai/codebase-composition';
import { ToolConfiguration } from '@principal-ai/codebase-quality-lenses';
// Note: QualityMetrics type is already defined in codebase-composition
// ToolConfiguration is from quality-lenses for tool execution

interface PackageWithMetrics {
  packageLayer: PackageLayer; // Use the full PackageLayer from codebase-composition
  metrics: QualityMetrics;    // Reuse QualityMetrics from codebase-composition
  availableTools: string[];
  toolResults: ToolResults;
  suggestions: QualitySuggestion[];
}

class QualityMetricsProcessor {
  private toolRunner: ToolRunner;
  private packageProcessor: PackageProcessor;

  async analyzeRepository(
    repoPath: string,
    fileTree: FileTree
  ): Promise<RepositoryMetrics> {
    // Extract packages first
    const packages = await this.packageProcessor.extractPackages(fileTree);

    // Analyze each package independently
    const packagesWithMetrics = await Promise.all(
      packages.map(async (pkg) => this.analyzePackage(repoPath, fileTree, pkg))
    );

    return {
      packages: packagesWithMetrics,
      // No aggregated metrics in v1 - UI will show first package or user-selected package
    };
  }

  private async analyzePackage(
    repoPath: string,
    fullFileTree: FileTree,
    packageInfo: PackageInfo
  ): Promise<PackageWithMetrics> {
    // Calculate the package directory path
    const packagePath = path.join(repoPath, packageInfo.path || '.');

    // Filter FileTree to just this package's files
    const packageFileTree = this.filterFileTreeToPackage(fullFileTree, packageInfo.path);

    // Detect what tools are available for THIS package
    const hasTypeScript = !!(packageInfo.devDependencies?.['typescript'] || packageInfo.dependencies?.['typescript']);
    const hasESLint = !!(packageInfo.devDependencies?.['eslint'] || packageInfo.dependencies?.['eslint']);
    const hasPrettier = !!(packageInfo.devDependencies?.['prettier'] || packageInfo.dependencies?.['prettier']);
    const testFramework = this.detectTestFramework(packageInfo);

    // Run tools in parallel FOR THIS PACKAGE
    const [tests, linting, types, formatting] = await Promise.all([
      testFramework
        ? this.toolRunner.runTests(packagePath, testFramework)
        : { score: 0, available: false },
      hasESLint
        ? this.toolRunner.runLinter(packagePath)
        : { score: 0, available: false },
      hasTypeScript
        ? this.toolRunner.runTypeCheck(packagePath)
        : { score: 100, available: false }, // No TS = no type errors
      hasPrettier
        ? this.toolRunner.runFormatter(packagePath)
        : { score: 0, available: false }
    ]);

    // Calculate documentation and dead code for this package
    const documentation = this.calculateDocumentation(packageFileTree);
    const deadCode = await this.detectDeadCode(packageFileTree, packageInfo);

    const metrics: QualityMetrics = {
      tests: tests.coverage || 0,
      deadCode: deadCode.percentage || 0,
      linting: linting.score || 0,
      formatting: formatting.score || 0,
      types: types.score || 0,
      documentation: documentation.score || 0
    };

    return {
      ...packageInfo,
      metrics,
      availableTools: this.getAvailableToolsForPackage(packageInfo),
      toolResults: { tests, linting, types, formatting },
      suggestions: this.generateSuggestions(metrics, { tests, linting, types, formatting })
    };
  }

  private filterFileTreeToPackage(
    fullTree: FileTree,
    packagePath: string
  ): FileTree {
    // Filter allFiles and allDirectories to only include paths within this package
    const normalizedPath = packagePath === '.' ? '' : packagePath;
    const pathPrefix = normalizedPath ? `${normalizedPath}/` : '';

    const packageFiles = fullTree.allFiles.filter(file =>
      normalizedPath === '' || file.relativePath.startsWith(pathPrefix)
    );

    const packageDirs = fullTree.allDirectories.filter(dir =>
      normalizedPath === '' || dir.relativePath === normalizedPath || dir.relativePath.startsWith(pathPrefix)
    );

    // Create a new FileTree for just this package
    return {
      ...fullTree,
      allFiles: packageFiles,
      allDirectories: packageDirs,
      // Update stats for this subset
      stats: {
        ...fullTree.stats,
        totalFiles: packageFiles.length,
        totalDirectories: packageDirs.length
      }
    };
  }

  private detectTestFramework(packageInfo: PackageInfo): string | null {
    // Check for test framework in this specific package
    const deps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };

    if (deps['jest']) return 'jest';
    if (deps['mocha']) return 'mocha';
    if (deps['vitest']) return 'vitest';
    if (deps['@testing-library/react']) return 'jest'; // Usually paired with Jest

    // Check scripts for test commands as fallback
    if (packageInfo.scripts?.test) {
      const testScript = packageInfo.scripts.test;
      if (testScript.includes('jest')) return 'jest';
      if (testScript.includes('mocha')) return 'mocha';
      if (testScript.includes('vitest')) return 'vitest';
    }

    return null;
  }

  private getAvailableToolsForPackage(packageInfo: PackageInfo): string[] {
    const tools: string[] = [];
    const deps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };

    if (deps['eslint']) tools.push('ESLint');
    if (deps['typescript']) tools.push('TypeScript');
    if (deps['prettier']) tools.push('Prettier');
    if (deps['jest'] || deps['mocha'] || deps['vitest']) tools.push('Testing');

    // Also check for tools in scripts
    if (packageInfo.scripts?.lint) tools.push('Linting');
    if (packageInfo.scripts?.typecheck || packageInfo.scripts?.['type-check']) tools.push('Type Checking');
    if (packageInfo.scripts?.format) tools.push('Formatting');

    return [...new Set(tools)]; // Remove duplicates
  }
}
```

#### F. ToolRunner
Executes quality analysis tools using the existing quality-lenses infrastructure:

```typescript
import { LensManager } from '@principal-ai/codebase-quality-lenses';
import { ElectronCLIBridgeExecutor } from '../quality-lenses/ElectronCLIBridgeExecutor';
import { PackageLayerToToolConfigBridge } from '../quality-lenses/PackageLayerToToolConfigBridge';

class ToolRunner {
  private lensManager: LensManager;
  private executor: ElectronCLIBridgeExecutor;

  constructor() {
    // Use existing ElectronCLIBridgeExecutor for command execution
    this.executor = new ElectronCLIBridgeExecutor();
    this.lensManager = new LensManager({ executor: this.executor });
  }

  async runToolsForPackage(packageLayer: PackageLayer): Promise<ToolResults> {
    // Use existing PackageLayerToToolConfigBridge to convert PackageLayer to ToolConfiguration
    const { configs } = PackageLayerToToolConfigBridge.createToolConfigurations(packageLayer);

    const results: ToolResults = {};

    // Execute each tool configuration through the lens manager
    for (const config of configs) {
      const lens = this.lensManager.getLens(config.name);
      if (lens) {
        const result = await lens.execute(config);
        results[config.name] = {
          score: this.calculateScore(result),
          available: true,
          details: result
        };
      }
    }

    return results;
  }

  private calculateScore(result: any): number {
    // Calculate score based on tool results
    // This can use the existing quality-lenses scoring logic
    return 0; // Placeholder
  }
}
```

### 3. Worker Process Bootstrap & Webpack Configuration

#### Webpack Bundle Configuration
**CRITICAL**: The worker process must be bundled by webpack to run correctly.

```javascript
// .erb/configs/webpack.config.main.dev.ts and webpack.config.main.prod.ts
entry: {
  // ... other entries
  'repository-monitoring-worker': path.join(webpackPaths.srcPath, 'repository-monitoring-server', 'worker-entry.ts'),
},

// Bundle all dependencies for the worker (self-contained)
externals: [
  ({ request, context, contextInfo, getResolve }, callback) => {
    if (contextInfo?.issuer?.includes('repository-monitoring-server')) {
      return callback(); // Bundle everything
    }
    // ... normal externalization for main process
  },
],

output: {
  // Development: .erb/dll/repository-monitoring-worker.bundle.dev.js
  // Production: dist/main/repository-monitoring-worker.js
}
```

#### Worker Entry Point
```typescript
// src/repository-monitoring-server/worker-entry.ts
import { RepositoryMonitoringServer } from './RepositoryMonitoringServer';

let server: RepositoryMonitoringServer;

async function initialize(): Promise<void> {
  console.log('[RepositoryMonitoring] Worker process starting...');

  server = new RepositoryMonitoringServer();

  // Send ready signal
  sendToMain({ type: 'ready' });
}

function handleMessage(message: MainToServerMessage): void {
  if (!message) return;

  server.handleMessage(message)
    .then(result => {
      sendToMain({
        type: 'response',
        id: message.id,
        result
      });
    })
    .catch(error => {
      sendToMain({
        type: 'error',
        id: message.id,
        error: error.message
      });
    });
}

function sendToMain(message: any): void {
  if ((process as any).parentPort) {
    (process as any).parentPort.postMessage(message);
  } else if (process.send) {
    process.send(message);
  }
}

// Set up IPC listeners
if ((process as any).parentPort) {
  (process as any).parentPort.on('message', handleMessage);
} else {
  process.on('message', handleMessage);
}

// Initialize
initialize().catch(console.error);
```

### 4. IPC Communication (Separate Process Architecture)

#### Message Types
```typescript
// src/repository-monitoring-server/types.ts
export interface MainToServerMessage {
  id: string;
  type: 'getFileTree' | 'getMetrics' | 'getPackages' | 'refresh' | 'register' | 'unregister';
  path?: string;
}

export interface ServerToMainMessage {
  type: 'ready' | 'response' | 'error' | 'event';
  id?: string;
  result?: any;
  error?: string;
  event?: {
    name: string;
    data: any;
  };
}
```

#### Main Process IPC Handlers
```typescript
// In main/initialization.ts
import { RepositoryMonitoringManager } from './repository-monitoring/RepositoryMonitoringManager';

const repositoryMonitoringManager = new RepositoryMonitoringManager();

// Start the server process
await repositoryMonitoringManager.start();

// Register IPC handlers that proxy to the worker process
ipcMain.handle('repository-monitoring:get-file-tree', async (event, repoPath) => {
  return await repositoryMonitoringManager.getFileTree(repoPath);
});

ipcMain.handle('repository-monitoring:get-metrics', async (event, repoPath) => {
  return await repositoryMonitoringManager.getQualityMetrics(repoPath);
});

ipcMain.handle('repository-monitoring:get-packages', async (event, repoPath) => {
  return await repositoryMonitoringManager.getPackages(repoPath);
});

ipcMain.handle('repository-monitoring:refresh', async (event, repoPath) => {
  return await repositoryMonitoringManager.refreshRepository(repoPath);
});

// Forward events from worker to renderer
repositoryMonitoringManager.on('metrics-updated', (repoPath, metrics) => {
  mainWindow.webContents.send('repository-monitoring:metrics-updated', {
    repoPath,
    metrics
  });
});
```

#### Renderer Service (Unchanged)
```typescript
// renderer/main-process-api/RepositoryMonitoringService.ts
// Note: The renderer service remains the same - it doesn't need to know
// that the backend runs in a separate process
export class RepositoryMonitoringService {
  static async getFileTree(repoPath: string): Promise<FileTree> {
    return await ipcRenderer.invoke('repository-monitoring:get-file-tree', repoPath);
  }

  static async getQualityMetrics(repoPath: string): Promise<ExtendedQualityMetrics> {
    return await ipcRenderer.invoke('repository-monitoring:get-metrics', repoPath);
  }

  static onMetricsUpdated(callback: (data: { repoPath: string; metrics: ExtendedQualityMetrics }) => void) {
    return ipcRenderer.on('repository-monitoring:metrics-updated', callback);
  }
}
```

### 5. Caching Strategy

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  sha?: string; // For git-based invalidation
}

class CacheManager {
  private fileTreeCache = new Map<string, CacheEntry<FileTree>>();
  private metricsCache = new Map<string, CacheEntry<ExtendedQualityMetrics>>();

  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<T> {
    const cached = this.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const data = await compute();
    this.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

### 6. File Watching Integration

```typescript
class RepositoryWatcher {
  private watcher: FSWatcher;

  watch(repoPath: string, onChange: (changes: FileChange[]) => void) {
    this.watcher = chokidar.watch(repoPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**'
      ],
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', path => onChange([{ type: 'add', path }]))
      .on('change', path => onChange([{ type: 'change', path }]))
      .on('unlink', path => onChange([{ type: 'unlink', path }]));
  }

  stop() {
    this.watcher?.close();
  }
}
```

## Implementation Phases

### Phase 1: Basic Structure (MVP) ✅ COMPLETED - NEEDS MIGRATION
1. ✅ Create RepositoryMonitoringServer class (needs migration to separate process)
2. ✅ Implement FileTreeBuilder using existing buildFilteredFileTree and GitFileTreeBuilder
3. ✅ Add basic IPC handlers with proper enum usage (needs refactoring for worker process)
4. ✅ Create renderer service (remains mostly unchanged)

### Phase 1.5: Migrate to Separate Process Architecture ✅ COMPLETED
1. ✅ Move files from `src/main/repository-monitoring/` to `src/repository-monitoring-server/`
2. ✅ Create `worker-entry.ts` for process bootstrapping
3. ✅ Implement `RepositoryMonitoringManager` in main process
4. ✅ Update IPC to use worker process communication
5. ✅ Add message type definitions for process communication
6. ✅ Configure webpack bundling for worker process (add entry point to webpack configs)
7. ✅ Fix webpack externals configuration to bundle all dependencies for worker
8. ✅ Test worker process startup and communication
9. ✅ Add comprehensive test suite for RepositoryMonitoringManager

### Phase 2: Quality Metrics - IN PROGRESS

#### Phase 2a: Package Processing ✅ COMPLETED
1. ✅ **PackageProcessor Implementation**
   - Created `src/repository-monitoring-server/PackageProcessor.ts`
   - Uses `@principal-ai/codebase-composition` PackageLayerModule for package detection
   - Implements WorkerFileSystemAdapter for reading package.json files
   - Provides `extractPackages()` and `getPackageSummary()` methods

2. ✅ **Integration with RepositoryMonitoringServer**
   - Added `getPackages()` method to RepositoryMonitoringServer
   - Integrated with existing caching system (5-minute TTL)
   - Added package data to cache invalidation on refresh

3. ✅ **IPC and API Integration**
   - Added GET_PACKAGES event to RepositoryMonitoringAPI
   - Updated IPC handlers in main process
   - Added static `getPackages()` method to RepositoryMonitoringService

4. ✅ **UI Integration and Testing**
   - Added "Get Packages" button to SystemMonitor for validation
   - Successfully migrated RepoManager components to use RepositoryMonitoringService
   - Fixed root package selection issues in Dependencies panel

5. ✅ **Cleanup and Quality Assurance**
   - Fixed linting issues after updating @principal-ai/codebase-composition
   - Removed TODO comments about type casting (types now compatible)
   - Updated package to latest version with FileTree type fixes

#### Phase 2b: Tool Detection and Quality Analysis - READY TO START

2. **Leverage Existing ToolRunner Infrastructure**
   - Use `ElectronCLIBridgeExecutor` for command execution
   - Study `PackageLayerToToolConfigBridge.createToolConfigurations()`
   - Use `LensManager` from quality-lenses for tool orchestration
   - Return `LensResult` objects, not custom result types

3. **QualityMetricsProcessor Guidelines**
   - Import `QualityMetrics` from `@principal-ai/codebase-composition`
   - Use existing scoring logic from quality-lenses
   - Focus on integration, not reimplementation

4. **Mock Data Strategy**
   - When tools unavailable, return valid `LensResult` with `success: false`
   - Include helpful error messages in the `error` field
   - Don't fail silently - log unavailable tools

### Phase 3: Caching & Performance
1. Implement CacheManager
2. Add file watching for invalidation
3. Optimize parallel tool execution
4. Add progress reporting

### Phase 4: Advanced Features
1. Dead code detection
2. Documentation analysis
3. Dependency analysis
4. Historical metrics tracking

## Key Advantages of Using GitFileTreeBuilder

1. **Consistent Structure**: GitFileTreeBuilder ensures consistent FileTree structure across the codebase
2. **Git Integration**: Automatically includes git metadata (commit SHA, branch, dirty state)
3. **Built-in Utilities**: Uses FileTreeCore utilities for proper tree building
4. **Metadata Tracking**: Includes comprehensive metadata for caching and comparison
5. **Type Safety**: Strongly typed GitSource interface ensures proper data flow

## Troubleshooting

### Worker Process Won't Start

**Error**: `Cannot find module '/path/to/repository-monitoring-server/worker-entry.js'`

**Solution**:
1. Worker processes MUST be webpack-bundled (like event-processing-server)
2. Add entry point to both webpack.config.main.dev.ts and webpack.config.main.prod.ts:
   ```javascript
   entry: {
     'repository-monitoring-worker': path.join(webpackPaths.srcPath, 'repository-monitoring-server', 'worker-entry.ts')
   }
   ```
3. Update externals configuration to bundle dependencies for worker:
   ```javascript
   const isWorkerBundle = context?.includes('repository-monitoring-server') ||
                         contextInfo?.issuer?.includes('repository-monitoring-server');
   if (isWorkerBundle) return callback(); // Bundle everything for workers
   ```
4. Verify bundle exists: `ls .erb/dll/repository-monitoring-worker.bundle.dev.js`
5. Check RepositoryMonitoringManager uses bundled file, not source file

### Worker Process Crashes Immediately

**Check**:
1. Review worker stderr output in console logs
2. Verify all imports in worker-entry.ts are available
3. Ensure types.ts exports all required message types
4. Check for circular dependencies
5. **IMPORTANT**: Delete any `.js` files in src directories - webpack may use them instead of `.ts` files
6. If you see `node:internal/modules/cjs/loader` errors:
   - Remove any compiled `.js` files: `rm src/repository-monitoring-server/*.js`
   - Let webpack recompile from TypeScript sources
7. Verify the bundle includes all dependencies (should be ~1MB not ~30KB)

### IPC Communication Failures

**Debug Steps**:
1. Enable debug logging: `logLevel: 'debug'` in RepositoryMonitoringManager config
2. Check message types match between main and worker
3. Verify message IDs are properly tracked
4. Look for timeout errors (30 second default)

## Common Pitfalls to Avoid (Lessons from Implementation)

1. **Don't Recreate Existing Types**
   - ❌ Creating custom `PackageInfo` when `PackageLayer` exists
   - ❌ Defining `ToolResult` when `LensResult` is available
   - ✅ Always check existing packages first

2. **Package Version Issues**
   - ❌ Assuming exports exist without checking
   - ✅ Verify package versions match documentation
   - ✅ Run `npm list <package-name>` to check installed version

3. **IPC Communication Patterns**
   - ❌ Using `window.api.invoke()` or `window.mainProcess.invoke()`
   - ✅ Use `ipcRenderer.invoke()` directly
   - ✅ Define enums in shared interfaces

4. **File Path Handling**
   - ❌ Passing absolute paths to `GitFileTreeBuilder`
   - ✅ Convert to relative paths using `path.relative()`

5. **Type Safety**
   - ❌ Using `any` type for flexibility
   - ❌ Using inline union types in message definitions
   - ✅ Use `unknown` or import proper types
   - ✅ Extract union types to separate type definitions
   - ✅ Let TypeScript guide you to the right property names

6. **Worker Process Setup**
   - ❌ Trying to run TypeScript files directly as worker processes
   - ❌ Forgetting to configure webpack entry points for workers
   - ❌ Not updating webpack externals for worker bundles
   - ✅ Always webpack-bundle worker processes
   - ✅ Follow event-processing-server pattern exactly
   - ✅ Ensure webpack bundles all dependencies for workers

## Benefits of This Architecture (Separate Process)

1. **Process Isolation**: Quality analysis runs in separate process, protecting main process from crashes
2. **Better Performance**: CPU-intensive operations don't block main process or UI
3. **Parallel Processing**: Multiple repositories can be analyzed concurrently
4. **Resource Management**: Worker process can be restarted independently if needed
5. **Consistent Architecture**: Matches event-processing-server pattern
6. **Scalability**: Could potentially spawn multiple worker processes for large monorepos
7. **Reusable Data**: Multiple UI components can use same FileTree/metrics
8. **Efficient Caching**: Avoid redundant file system operations (can use SHA for cache invalidation)
9. **Tool Agnostic**: Easy to add new analysis tools
10. **Reactive Updates**: File watching triggers automatic updates
11. **Progressive Enhancement**: Works with available tools, doesn't fail without them
12. **Git-Aware**: Leverages git information for better cache invalidation and tracking

## Integration with Current UI

### Package List Display

The UI can display package information in multiple ways:

```typescript
// In a new PackagesPanel.tsx component
export function PackagesPanel({ directory }: { directory: string }) {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [summary, setSummary] = useState<PackageSummary | null>(null);

  useEffect(() => {
    RepositoryMonitoringService.getPackages(directory)
      .then(result => {
        setPackages(result.packages);
        setSummary(result.summary);
      });
  }, [directory]);

  return (
    <div>
      <h3>Packages ({summary?.totalPackages || 0})</h3>

      {/* Show if monorepo */}
      {summary?.isMonorepo && (
        <Badge>Monorepo</Badge>
      )}

      {/* Root package */}
      {packages.filter(p => p.path === '.').map(pkg => (
        <div key={pkg.path}>
          <h4>{pkg.name} v{pkg.version}</h4>
          <p>Dependencies: {Object.keys(pkg.dependencies || {}).length}</p>
          <p>Dev Dependencies: {Object.keys(pkg.devDependencies || {}).length}</p>
        </div>
      ))}

      {/* Workspace packages */}
      {summary?.workspacePackages.map(wp => (
        <div key={wp.path}>
          <h5>{wp.name}</h5>
          <span>{wp.path}</span>
        </div>
      ))}

      {/* Available scripts */}
      <div>
        <h4>Available Scripts</h4>
        {summary?.availableScripts.map(script => (
          <Badge key={script}>{script}</Badge>
        ))}
      </div>
    </div>
  );
}
```

### Quality Hexagon Panel Integration (Grid Layout for Monorepos)

```typescript
// In QualityHexagonPanel.tsx
export function QualityHexagonPanel({ directory, compact = false }: Props) {
  const [packages, setPackages] = useState<PackageWithMetrics[]>([]);
  const [selectedPackageIndex, setSelectedPackageIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (directory) {
      setIsLoading(true);
      RepositoryMonitoringService.getQualityMetrics(directory)
        .then(result => {
          setPackages(result.packages);
          setIsLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setIsLoading(false);
        });
    }
  }, [directory]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Single package - show full size with details
  if (packages.length === 1) {
    const pkg = packages[0];
    return (
      <div style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
      }}>
        <div style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          marginBottom: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          Code Quality
        </div>

        <QualityHexagon
          metrics={pkg.metrics}
          tier={calculateTier(pkg.metrics)}
          showLabels={!compact}
          interactive={true}
        />

        {!compact && (
          <>
            <div style={{ marginTop: '16px' }}>
              <h4>Available Tools</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {pkg.availableTools.map(tool => (
                  <Badge key={tool}>{tool}</Badge>
                ))}
              </div>
            </div>

            {pkg.suggestions.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4>Suggestions</h4>
                {pkg.suggestions.map((s, i) => (
                  <div key={i} style={{
                    padding: '8px',
                    borderLeft: `3px solid ${
                      s.priority === 'high' ? theme.colors.error :
                      s.priority === 'medium' ? theme.colors.warning :
                      theme.colors.border
                    }`,
                    marginBottom: '4px'
                  }}>
                    {s.message}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Monorepo - show grid of hexagons
  return (
    <div style={{
      padding: '16px',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: '8px',
      border: `1px solid ${theme.colors.border}`,
    }}>
      <div style={{
        fontSize: theme.fontSizes[1],
        color: theme.colors.textSecondary,
        marginBottom: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Code Quality - {packages.length} Packages</span>
        <Badge variant="outline">Monorepo</Badge>
      </div>

      {/* Grid of hexagons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '16px',
      }}>
        {packages.map((pkg, index) => {
          const isRoot = pkg.path === '.' || pkg.path === './';
          return (
            <div
              key={pkg.path}
              style={{
                padding: '12px',
                backgroundColor: theme.colors.background,
                borderRadius: '6px',
                border: `1px solid ${
                  selectedPackageIndex === index
                    ? theme.colors.primary
                    : theme.colors.border
                }`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => setSelectedPackageIndex(index)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                if (selectedPackageIndex !== index) {
                  e.currentTarget.style.borderColor = theme.colors.border;
                }
              }}
            >
              {/* Package name and path */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{
                  fontSize: theme.fontSizes[1],
                  fontWeight: 500,
                  color: theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {pkg.name || 'Unnamed Package'}
                  {isRoot && <Badge variant="secondary" style={{ marginLeft: '8px' }}>Root</Badge>}
                </div>
                <div style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.monospace,
                }}>
                  {pkg.path}
                </div>
              </div>

              {/* Compact hexagon */}
              <div style={{ width: '100%', aspectRatio: '1 / 1' }}>
                <QualityHexagonCompact
                  metrics={pkg.metrics}
                  tier={calculateTier(pkg.metrics)}
                />
              </div>

              {/* Package stats */}
              <div style={{
                marginTop: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}>
                <span>{pkg.availableTools.length} tools</span>
                <span>{pkg.suggestions.filter(s => s.priority === 'high').length} issues</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details panel for selected package */}
      {selectedPackageIndex !== null && !compact && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: theme.colors.background,
          borderRadius: '6px',
        }}>
          <h4>{packages[selectedPackageIndex].name} Details</h4>

          <div style={{ marginTop: '12px' }}>
            <span>Available Tools:</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {packages[selectedPackageIndex].availableTools.map(tool => (
                <Badge key={tool}>{tool}</Badge>
              ))}
            </div>
          </div>

          {packages[selectedPackageIndex].suggestions.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <span>Suggestions:</span>
              {packages[selectedPackageIndex].suggestions.map((s, i) => (
                <div key={i} style={{
                  padding: '8px',
                  marginTop: '4px',
                  borderLeft: `3px solid ${
                    s.priority === 'high' ? theme.colors.error :
                    s.priority === 'medium' ? theme.colors.warning :
                    theme.colors.border
                  }`,
                }}>
                  {s.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Next Steps

1. ✅ ~~Migrate to separate process architecture~~ (COMPLETED)
2. ✅ ~~Configure webpack bundling for worker~~ (COMPLETED)
3. ✅ ~~Create comprehensive test suite~~ (COMPLETED)
4. Continue with Phase 2 (Quality Metrics) in the new architecture
5. Add tool detection and execution
6. Implement caching and file watching
7. Add integration tests for worker process communication
8. Implement graceful shutdown and cleanup