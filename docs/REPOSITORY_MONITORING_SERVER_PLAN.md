# Repository Monitoring Server - Implementation Plan

## Overview
The Repository Monitoring Server will be a centralized service in the main process that provides quality metrics and repository information to the renderer process. It will build upon existing FileTree creation patterns and extend them with quality analysis capabilities.

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

### 1. Server Location and Structure

```
src/
├── main/
│   └── repository-monitoring/
│       ├── RepositoryMonitoringServer.ts    # Main server class
│       ├── QualityMetricsProcessor.ts       # Quality analysis logic
│       ├── FileTreeBuilder.ts               # FileTree creation
│       ├── ToolRunner.ts                    # Runs linting/testing tools
│       └── types.ts                         # Type definitions
```

### 2. Core Components

#### A. RepositoryMonitoringServer
Main server that coordinates all monitoring activities:

```typescript
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

  // Watch for changes
  watchRepository(path: string): void
  stopWatching(path: string): void
}
```

#### B. FileTreeBuilder
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

#### C. PackageProcessor
Extracts and analyzes package information using codebase-composition:

```typescript
import { PackageAnalyzer, PackageInfo } from '@principal-ai/codebase-composition';

class PackageProcessor {
  private packageAnalyzer = new PackageAnalyzer();

  async extractPackages(fileTree: FileTree): Promise<PackageInfo[]> {
    // Use codebase-composition to find all package.json files
    const packages = await this.packageAnalyzer.analyze(fileTree);

    // Returns array of packages found in the repository
    // Each package includes:
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

#### D. QualityMetricsProcessor
Analyzes each package independently (no aggregation in v1):

```typescript
interface PackageWithMetrics extends PackageInfo {
  metrics: QualityMetrics;
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

#### D. ToolRunner
Executes quality analysis tools:

```typescript
class ToolRunner {
  async runTests(repoPath: string): Promise<TestMetrics> {
    // Check for test framework (jest, mocha, vitest)
    const framework = await this.detectTestFramework(repoPath);

    // Run tests and parse coverage
    const result = await this.executeCommand(repoPath, framework.command);
    return this.parseTestResults(result, framework.type);
  }

  async runLinter(repoPath: string): Promise<LintMetrics> {
    // ESLint, TSLint, or other
    const hasEslint = await this.fileExists(repoPath, '.eslintrc');
    if (hasEslint) {
      const result = await this.executeCommand(repoPath, 'npx eslint . --format json');
      return this.parseEslintResults(result);
    }
    return { score: 0, available: false };
  }

  async runTypeCheck(repoPath: string): Promise<TypeMetrics> {
    // TypeScript compiler
    const hasTsConfig = await this.fileExists(repoPath, 'tsconfig.json');
    if (hasTsConfig) {
      const result = await this.executeCommand(repoPath, 'npx tsc --noEmit');
      return this.parseTypeCheckResults(result);
    }
    return { score: 0, available: false };
  }
}
```

### 3. IPC Communication

#### Main Process Handlers

```typescript
// In main/initialization.ts or similar
ipcMain.handle('repository-monitoring:get-file-tree', async (event, repoPath) => {
  return await repositoryMonitoringServer.getFileTree(repoPath);
});

ipcMain.handle('repository-monitoring:get-metrics', async (event, repoPath) => {
  return await repositoryMonitoringServer.getQualityMetrics(repoPath);
});

ipcMain.handle('repository-monitoring:get-packages', async (event, repoPath) => {
  // Get just package information without full metrics
  const fileTree = await repositoryMonitoringServer.getFileTree(repoPath);
  const packages = await repositoryMonitoringServer.packageProcessor.extractPackages(fileTree);
  const summary = await repositoryMonitoringServer.packageProcessor.getPackageSummary(packages);
  return { packages, summary };
});

ipcMain.handle('repository-monitoring:refresh', async (event, repoPath) => {
  return await repositoryMonitoringServer.refreshRepository(repoPath);
});

// Push updates
repositoryMonitoringServer.on('metrics-updated', (repoPath, metrics) => {
  mainWindow.webContents.send('repository-monitoring:metrics-updated', {
    repoPath,
    metrics
  });
});
```

#### Renderer Service

```typescript
// renderer/main-process-api/RepositoryMonitoringService.ts
export class RepositoryMonitoringService {
  static async getFileTree(repoPath: string): Promise<FileTree> {
    return await window.api.invoke('repository-monitoring:get-file-tree', repoPath);
  }

  static async getQualityMetrics(repoPath: string): Promise<ExtendedQualityMetrics> {
    return await window.api.invoke('repository-monitoring:get-metrics', repoPath);
  }

  static onMetricsUpdated(callback: (data: { repoPath: string; metrics: ExtendedQualityMetrics }) => void) {
    return window.api.on('repository-monitoring:metrics-updated', callback);
  }
}
```

### 4. Caching Strategy

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

### 5. File Watching Integration

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

### Phase 1: Basic Structure (MVP)
1. Create RepositoryMonitoringServer class
2. Implement FileTreeBuilder using existing buildFilteredFileTree
3. Add basic IPC handlers
4. Create renderer service

### Phase 2: Quality Metrics
1. Implement ToolRunner for basic tools (ESLint, Jest)
2. Create QualityMetricsProcessor
3. Add metrics calculation from FileTree
4. Return mock data when tools unavailable

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

## Benefits of This Architecture

1. **Centralized Processing**: All heavy computation in main process
2. **Reusable Data**: Multiple UI components can use same FileTree/metrics
3. **Efficient Caching**: Avoid redundant file system operations (can use SHA for cache invalidation)
4. **Tool Agnostic**: Easy to add new analysis tools
5. **Reactive Updates**: File watching triggers automatic updates
6. **Progressive Enhancement**: Works with available tools, doesn't fail without them
7. **Git-Aware**: Leverages git information for better cache invalidation and tracking

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

1. Create the basic server structure in `main/repository-monitoring/`
2. Implement FileTreeBuilder using existing patterns
3. Add IPC handlers and renderer service
4. Replace MockQualityMetricsService with real implementation
5. Add tool detection and execution
6. Implement caching and file watching