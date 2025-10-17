# Quality Lens CLI Package Design

## Executive Summary

Create a standalone CLI package (`@principal-ai/quality-lens-cli`) that extracts quality lens processing functionality from the Electron app for use in CI/CD pipelines, particularly GitHub Actions. The CLI will analyze repositories, run quality lenses (ESLint, Jest, TypeScript, Knip, etc.), and output structured results for database storage.

**Goal**: Enable automated quality analysis that runs in GitHub Actions and saves results to a database for tracking code quality over time.

**Approach**: Extract reusable components from the Electron app, replace Electron-specific infrastructure with Node.js equivalents, and package as a standalone NPM CLI tool.

---

## Current Architecture Analysis

### What We Have in the Electron App

The electron-app currently implements a comprehensive quality lens processing system integrated with Electron's architecture:

#### Core Components

**1. Quality Lens Service** (`src/main/quality-lenses/QualityLensService.ts:1-334`)
- Singleton service managing all quality lenses
- Maps tool names to lens implementations (eslint, jest, typescript, knip, git)
- Lines 44-68: Initializes 5 lenses with ElectronCLIBridgeExecutor
- Lines 101-192: `executeWithPackageLayer()` - executes lenses using PackageLayer data
- Lines 237-258: Command parsing logic (npm run, yarn, pnpm)
- Lines 263-295: Success determination from lens results

**2. Executor Bridge** (`src/main/quality-lenses/ElectronCLIBridgeExecutor.ts:1-145`)
- Implements `Executor` interface from `@principal-ai/codebase-quality-lenses`
- Lines 22-90: `execute()` method - delegates to ElectronCLI
- Lines 92-143: `isAvailable()` method - checks command availability
- **ELECTRON-SPECIFIC**: Uses utility processes via CLIBridge

**3. CLI Bridge Infrastructure** (`src/main/electron-cli-bridge/CLIBridge.ts:1-410`)
- Lines 1-410: Core orchestrator managing utility process workers
- Routes commands to universal worker
- Handles inter-process communication (IPC)
- **ELECTRON-SPECIFIC**: Uses Electron's utilityProcess API

**4. Git Integration** (`src/main/quality-lenses/GitLensAdapter.ts:1-204`)
- Singleton adapter for Git operations
- Lines 47-83: `getCurrentCommit()`
- Lines 85-121: `getLastCommitInfo()`
- Lines 123-161: `getGitStatus()`
- Lines 163-177: `getCurrentBranch()`
- **ELECTRON-SPECIFIC**: Wraps GitLens from vscode-git package

**5. IPC Handlers** (`src/main/repository-monitoring/ipcHandlers.ts:366-393`)
- Registers IPC handlers for repository monitoring events
- Lines 366-393: `EXECUTE_TOOL` handler delegates to QualityLensService
- **ELECTRON-SPECIFIC**: Uses Electron's ipcMain

**6. Package Discovery** (`src/repository-monitoring-server/PackageProcessor.ts`)
- Uses `@principal-ai/codebase-composition-package` to discover packages
- Extracts PackageLayer data with quality metrics
- **REUSABLE**: Already uses standalone package

#### Execution Flow

```
ToolsPanel.tsx (UI)
  ↓
RepositoryMonitoringService.executeTool() (renderer)
  ↓ [IPC: EXECUTE_TOOL event]
ipcHandlers.ts (main process)
  ↓
QualityLensService.executeWithPackageLayer()
  ↓
Lens.configure() + Lens.run()
  ↓
ElectronCLIBridgeExecutor.execute()
  ↓
CLIBridge → utilityProcess worker
  ↓
Node.js child_process executes command
  ↓
Results returned as LensResult
```

### What's Reusable

✅ **Already Standalone**:
- `@principal-ai/codebase-quality-lenses` - Lens implementations (ESLint, Jest, TypeScript, Knip)
- `@principal-ai/codebase-composition-package` - Package discovery and quality metrics
- Lens result interfaces and data structures
- Command parsing logic (`QualityLensService.ts:237-258`)

✅ **Easily Extractable**:
- `QualityLensService.ts:44-68` - Lens initialization
- `QualityLensService.ts:101-192` - Execution logic
- `QualityLensService.ts:237-258` - Command parsing
- `QualityLensService.ts:263-295` - Success determination

### What's Electron-Specific (Needs Replacement)

❌ **Must Replace**:
- `ElectronCLIBridgeExecutor` → Replace with `NodeExecutor` using `child_process`
- `CLIBridge` → Not needed, direct child_process spawn
- `GitLensAdapter` → Replace with simple git CLI wrapper
- All IPC handlers → Not needed in CLI
- UI components → Not needed in CLI

---

## Proposed Architecture

### New Package Structure

```
@principal-ai/quality-lens-cli/
├── src/
│   ├── cli.ts                      # CLI entry point
│   ├── executor/
│   │   └── NodeExecutor.ts         # Implements Executor interface
│   ├── service/
│   │   └── QualityLensService.ts   # Extracted from electron-app
│   ├── scanner/
│   │   ├── RepositoryScanner.ts    # Package discovery
│   │   └── PackageDetector.ts      # Lens detection
│   ├── git/
│   │   └── GitAdapter.ts           # Simple git CLI wrapper
│   ├── output/
│   │   ├── JsonFormatter.ts        # JSON output for DB
│   │   └── ConsoleReporter.ts      # Human-readable console
│   ├── database/
│   │   └── DatabaseClient.ts       # Optional DB integration
│   └── types.ts                    # Shared TypeScript interfaces
├── bin/
│   └── quality-lens.js             # Executable entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Dependencies

```json
{
  "name": "@principal-ai/quality-lens-cli",
  "version": "1.0.0",
  "bin": {
    "quality-lens": "./bin/quality-lens.js"
  },
  "dependencies": {
    "@principal-ai/codebase-quality-lenses": "^0.5.0",
    "@principal-ai/codebase-composition-package": "^0.2.7",
    "yargs": "^17.7.2",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/yargs": "^17.0.32",
    "typescript": "^5.0.0"
  },
  "optionalDependencies": {
    "pg": "^8.11.0"
  }
}
```

---

## Implementation Details

### 1. NodeExecutor (Replaces ElectronCLIBridgeExecutor)

**File**: `src/executor/NodeExecutor.ts`

**Purpose**: Implements the `Executor` interface from `@principal-ai/codebase-quality-lenses` using Node.js `child_process` instead of Electron utility processes.

**Reference**: Based on `src/main/quality-lenses/ElectronCLIBridgeExecutor.ts:22-143`

```typescript
import { Executor } from '@principal-ai/codebase-quality-lenses';
import { spawn } from 'child_process';
import { which } from './utils';

/**
 * Executes commands using Node.js child_process
 * Replaces ElectronCLIBridgeExecutor for CLI usage
 */
export class NodeExecutor implements Executor {
  /**
   * Execute a command and return output
   * @param command - Command to execute (e.g., 'npm', 'eslint')
   * @param args - Command arguments
   * @param cwd - Working directory
   */
  async execute(
    command: string,
    args: string[],
    cwd: string
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        shell: true,
        env: {
          ...process.env,
          // Ensure npm/yarn/pnpm can find node
          PATH: process.env.PATH,
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? 0,
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check if a command is available
   * @param command - Command to check (e.g., 'npm', 'eslint')
   */
  async isAvailable(command: string): Promise<boolean> {
    try {
      const path = await which(command);
      return !!path;
    } catch {
      return false;
    }
  }
}

/**
 * Simple which implementation
 */
async function which(command: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(
      process.platform === 'win32' ? 'where' : 'which',
      [command],
      { shell: true }
    );

    let stdout = '';
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.on('close', (exitCode) => {
      if (exitCode === 0 && stdout.trim()) {
        resolve(stdout.trim().split('\n')[0]);
      } else {
        resolve(null);
      }
    });
  });
}
```

---

### 2. QualityLensService (Extracted from Electron App)

**File**: `src/service/QualityLensService.ts`

**Purpose**: Core orchestration service for running quality lenses. Extracted from electron-app with Electron dependencies removed.

**Reference**: Based on `src/main/quality-lenses/QualityLensService.ts:1-334`

```typescript
import {
  Lens,
  ESLintLens,
  JestLens,
  TypeScriptLens,
  KnipLens,
  LensResult,
} from '@principal-ai/codebase-quality-lenses';
import { PackageLayer, PackageCommand } from '@principal-ai/codebase-composition-package';
import { NodeExecutor } from '../executor/NodeExecutor';
import * as path from 'path';

/**
 * Request to execute a quality lens
 */
export interface ToolExecutionRequest {
  repoPath: string;
  packageLayer: PackageLayer;
  packageCommand: PackageCommand;
}

/**
 * Response from lens execution
 */
export interface ToolExecutionResponse {
  success: boolean;
  toolName: string;
  command: string;
  packagePath: string;
  exitCode: number;
  duration: number;
  stdout: string;
  stderr: string;
  lensResult?: LensResult;
  qualityContext?: {
    lensId?: string;
    operation?: string;
    availableLenses?: string[];
    missingLenses?: string[];
  };
}

/**
 * Service for executing quality lenses on packages
 * Extracted from src/main/quality-lenses/QualityLensService.ts
 */
export class QualityLensService {
  private lenses: Map<string, Lens>;
  private executor: NodeExecutor;

  constructor() {
    this.executor = new NodeExecutor();
    this.lenses = new Map();
    this.initializeLenses();
  }

  /**
   * Initialize all available lenses
   * Reference: QualityLensService.ts:44-68
   */
  private initializeLenses(): void {
    // ESLint
    const eslintLens = new ESLintLens(this.executor);
    this.lenses.set('eslint', eslintLens);
    this.lenses.set('lint', eslintLens);

    // Jest
    const jestLens = new JestLens(this.executor);
    this.lenses.set('jest', jestLens);
    this.lenses.set('test', jestLens);

    // TypeScript
    const tsLens = new TypeScriptLens(this.executor);
    this.lenses.set('typescript', tsLens);
    this.lenses.set('typecheck', tsLens);
    this.lenses.set('tsc', tsLens);

    // Knip
    const knipLens = new KnipLens(this.executor);
    this.lenses.set('knip', knipLens);
    this.lenses.set('deadcode', knipLens);

    console.log(`[QualityLensService] Initialized ${this.lenses.size} lenses`);
  }

  /**
   * Execute a quality tool using PackageCommand metadata
   * Reference: QualityLensService.ts:101-192
   */
  public async executeTool(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResponse> {
    const { packageLayer, packageCommand, repoPath } = request;
    const startTime = Date.now();

    // Validate that this is a lens command
    if (!packageCommand.isLensCommand || !packageCommand.lensId) {
      throw new Error(
        `Command "${packageCommand.name}" is not a lens command`
      );
    }

    // Determine working directory
    const cwd = path.join(repoPath, packageLayer.packageData.path);

    // Find lens by ID
    const lens = this.lenses.get(packageCommand.lensId);

    if (!lens) {
      throw new Error(
        `No lens registered for: ${packageCommand.lensId}`
      );
    }

    console.log(
      `[QualityLensService] Using ${lens.name} for command: ${packageCommand.name}`
    );

    try {
      // Parse command string
      const { command, args } = this.parseCommandString(
        packageCommand.command
      );

      // Configure the lens
      lens.configure({
        cwd,
        tool: {
          name: packageCommand.lensId,
          command,
          args,
          cwd,
          available: true,
        },
      });

      // Run the lens pipeline
      const lensResult = await lens.run();

      // Return results with lens metadata
      return {
        success: this.determineLensSuccess(lensResult),
        toolName: packageCommand.lensId,
        command: packageCommand.command,
        packagePath: packageLayer.packageData.path,
        exitCode: this.determineExitCode(lensResult),
        duration: Date.now() - startTime,
        stdout: lensResult.raw?.stdout || '',
        stderr: lensResult.raw?.stderr || lensResult.error?.message || '',
        lensResult,
        qualityContext: {
          lensId: packageCommand.lensId,
          operation: packageCommand.lensOperation,
          availableLenses: packageLayer.qualityMetrics?.availableLenses,
          missingLenses: packageLayer.qualityMetrics?.missingLenses,
        },
      };
    } catch (error: any) {
      throw new Error(
        `Failed to execute ${packageCommand.lensId}: ${error.message}`
      );
    }
  }

  /**
   * Parse command string into command + args
   * Reference: QualityLensService.ts:237-258
   */
  private parseCommandString(commandString: string): {
    command: string;
    args: string[];
  } {
    // Handle npm/yarn/pnpm run scripts
    if (commandString.startsWith('npm run ')) {
      return {
        command: 'npm',
        args: ['run', ...commandString.split(' ').slice(2)],
      };
    }
    if (commandString.startsWith('yarn ')) {
      return {
        command: 'yarn',
        args: commandString.split(' ').slice(1),
      };
    }
    if (commandString.startsWith('pnpm ')) {
      return {
        command: 'pnpm',
        args: commandString.split(' ').slice(1),
      };
    }

    // Direct command (e.g., "eslint . --ext .ts")
    const parts = commandString.split(' ');
    return { command: parts[0], args: parts.slice(1) };
  }

  /**
   * Determine if lens execution was successful
   * Reference: QualityLensService.ts:263-295
   */
  private determineLensSuccess(lensResult: LensResult): boolean {
    // Check raw exit code first
    if (lensResult.raw?.exitCode !== undefined) {
      return lensResult.raw.exitCode === 0;
    }

    // Fall back to error field
    if (lensResult.error) {
      return false;
    }

    // For linters, check if there are error-level issues
    if (lensResult.issues && lensResult.issues.length > 0) {
      const hasErrors = lensResult.issues.some(
        (issue) => issue.severity === 'error'
      );
      return !hasErrors;
    }

    // Default to success field
    return lensResult.success;
  }

  /**
   * Determine exit code from lens result
   */
  private determineExitCode(lensResult: LensResult): number {
    if (lensResult.raw?.exitCode !== undefined) {
      return lensResult.raw.exitCode;
    }
    return lensResult.success ? 0 : 1;
  }
}
```

---

### 3. RepositoryScanner (Package Discovery)

**File**: `src/scanner/RepositoryScanner.ts`

**Purpose**: Discover packages in a repository using the composition package.

**Reference**: Based on `src/repository-monitoring-server/PackageProcessor.ts`

```typescript
import {
  PackageLayerModule,
  PackageLayer,
  FileTree,
} from '@principal-ai/codebase-composition-package';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Scans repositories to discover packages and quality metrics
 */
export class RepositoryScanner {
  private packageModule: PackageLayerModule;

  constructor() {
    this.packageModule = new PackageLayerModule();
  }

  /**
   * Scan a repository and discover all packages
   */
  async scanRepository(repoPath: string): Promise<PackageLayer[]> {
    console.log(`[RepositoryScanner] Scanning: ${repoPath}`);

    // Build file tree
    const fileTree = await this.buildFileTree(repoPath);

    // Create file reader
    const fileReader = async (filePath: string): Promise<string> => {
      const fullPath = path.join(repoPath, filePath);
      return await fs.readFile(fullPath, 'utf-8');
    };

    // Discover packages
    const packages = await this.packageModule.discoverPackages(
      fileTree,
      fileReader
    );

    console.log(
      `[RepositoryScanner] Found ${packages.length} package(s)`
    );

    // Log quality metrics
    packages.forEach((pkg) => {
      console.log(`  - ${pkg.packageData.name}`);
      console.log(
        `    Available lenses: ${pkg.qualityMetrics?.availableLenses?.join(', ') || 'none'}`
      );
      console.log(
        `    Missing lenses: ${pkg.qualityMetrics?.missingLenses?.join(', ') || 'none'}`
      );
    });

    return packages;
  }

  /**
   * Build a file tree from a directory
   */
  private async buildFileTree(
    dirPath: string,
    relativePath = ''
  ): Promise<FileTree> {
    const tree: FileTree = {
      name: path.basename(dirPath) || 'root',
      path: relativePath,
      type: 'directory',
      children: [],
    };

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip node_modules, .git, etc.
      if (this.shouldSkip(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const entryRelativePath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;

      if (entry.isDirectory()) {
        const subtree = await this.buildFileTree(
          fullPath,
          entryRelativePath
        );
        tree.children?.push(subtree);
      } else if (entry.isFile()) {
        tree.children?.push({
          name: entry.name,
          path: entryRelativePath,
          type: 'file',
        });
      }
    }

    return tree;
  }

  /**
   * Determine if a file/directory should be skipped
   */
  private shouldSkip(name: string): boolean {
    const skipPatterns = [
      'node_modules',
      '.git',
      '.next',
      '.nuxt',
      'dist',
      'build',
      'coverage',
      '.turbo',
      '.cache',
    ];
    return skipPatterns.includes(name) || name.startsWith('.');
  }
}
```

---

### 4. CLI Entry Point

**File**: `src/cli.ts`

**Purpose**: Main CLI interface with argument parsing and command execution.

```typescript
#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { RepositoryScanner } from './scanner/RepositoryScanner';
import { QualityLensService } from './service/QualityLensService';
import { JsonFormatter } from './output/JsonFormatter';
import { ConsoleReporter } from './output/ConsoleReporter';
import { PackageCommand } from '@principal-ai/codebase-composition-package';
import * as fs from 'fs/promises';
import * as path from 'path';

interface RunCommandArgs {
  path: string;
  output?: string;
  lenses?: string;
  format: 'json' | 'console';
  save?: boolean;
  dbUrl?: string;
}

async function runCommand(argv: RunCommandArgs) {
  const scanner = new RepositoryScanner();
  const lensService = new QualityLensService();
  const jsonFormatter = new JsonFormatter();
  const consoleReporter = new ConsoleReporter();

  try {
    // Scan repository
    console.log(`Scanning repository: ${argv.path}`);
    const packages = await scanner.scanRepository(argv.path);

    if (packages.length === 0) {
      console.warn('No packages found in repository');
      process.exit(1);
    }

    // Filter lenses if specified
    const lensFilter = argv.lenses
      ? argv.lenses.split(',').map((l) => l.trim())
      : null;

    // Execute lenses for each package
    const allResults = [];

    for (const pkg of packages) {
      const lensCommands = pkg.packageData.availableCommands?.filter(
        (cmd: PackageCommand) => {
          if (!cmd.isLensCommand) return false;
          if (lensFilter && !lensFilter.includes(cmd.lensId || '')) {
            return false;
          }
          return true;
        }
      );

      if (!lensCommands || lensCommands.length === 0) {
        console.log(
          `Skipping ${pkg.packageData.name} (no lens commands)`
        );
        continue;
      }

      console.log(
        `\nRunning lenses for ${pkg.packageData.name}...`
      );

      for (const command of lensCommands) {
        console.log(`  - ${command.lensId}: ${command.name}`);

        try {
          const result = await lensService.executeTool({
            repoPath: argv.path,
            packageLayer: pkg,
            packageCommand: command,
          });

          allResults.push({
            package: pkg.packageData.name,
            packagePath: pkg.packageData.path,
            lens: command.lensId,
            command: command.name,
            result: result,
            timestamp: Date.now(),
          });

          console.log(
            `    ${result.success ? '✓' : '✗'} ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`
          );
        } catch (error: any) {
          console.error(`    ✗ Error: ${error.message}`);
          allResults.push({
            package: pkg.packageData.name,
            packagePath: pkg.packageData.path,
            lens: command.lensId,
            command: command.name,
            error: error.message,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Output results
    if (argv.format === 'json') {
      const json = jsonFormatter.format(allResults);

      if (argv.output) {
        await fs.writeFile(argv.output, json, 'utf-8');
        console.log(`\nResults written to: ${argv.output}`);
      } else {
        console.log('\n' + json);
      }
    } else {
      consoleReporter.report(allResults);
    }

    // Save to database if requested
    if (argv.save && argv.dbUrl) {
      const { DatabaseClient } = await import('./database/DatabaseClient');
      const dbClient = new DatabaseClient(argv.dbUrl);
      await dbClient.saveResults(allResults);
      console.log('Results saved to database');
    }

    // Exit with error code if any lenses failed
    const hasFailures = allResults.some(
      (r) => r.error || !r.result?.success
    );
    process.exit(hasFailures ? 1 : 0);
  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

yargs(hideBin(process.argv))
  .command(
    'run [path]',
    'Run quality lenses on repository',
    (yargs) => {
      return yargs
        .positional('path', {
          describe: 'Repository path',
          type: 'string',
          default: process.cwd(),
        })
        .option('output', {
          alias: 'o',
          describe: 'Output file for results',
          type: 'string',
        })
        .option('lenses', {
          describe: 'Specific lenses to run (comma-separated)',
          type: 'string',
          example: 'eslint,jest,typescript',
        })
        .option('format', {
          describe: 'Output format',
          choices: ['json', 'console'] as const,
          default: 'json' as const,
        })
        .option('save', {
          describe: 'Save results to database',
          type: 'boolean',
          default: false,
        })
        .option('db-url', {
          describe: 'Database connection URL',
          type: 'string',
        });
    },
    (argv) => runCommand(argv as RunCommandArgs)
  )
  .command(
    'list [path]',
    'List available lenses in repository',
    (yargs) => {
      return yargs.positional('path', {
        describe: 'Repository path',
        type: 'string',
        default: process.cwd(),
      });
    },
    async (argv) => {
      const scanner = new RepositoryScanner();
      const packages = await scanner.scanRepository(argv.path as string);

      packages.forEach((pkg) => {
        console.log(`\n${pkg.packageData.name}:`);
        console.log(
          `  Available: ${pkg.qualityMetrics?.availableLenses?.join(', ') || 'none'}`
        );
        console.log(
          `  Missing: ${pkg.qualityMetrics?.missingLenses?.join(', ') || 'none'}`
        );
      });
    }
  )
  .demandCommand()
  .help()
  .argv;
```

---

### 5. Output Formatters

**File**: `src/output/JsonFormatter.ts`

```typescript
/**
 * Formats lens results as JSON for database storage
 */
export class JsonFormatter {
  format(results: any[]): string {
    const formatted = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        totalPackages: new Set(results.map((r) => r.package)).size,
        totalLenses: results.length,
      },
      results: results.map((r) => ({
        package: {
          name: r.package,
          path: r.packagePath,
        },
        lens: {
          id: r.lens,
          command: r.command,
        },
        execution: {
          success: r.result?.success ?? false,
          exitCode: r.result?.exitCode,
          duration: r.result?.duration,
          timestamp: r.timestamp,
        },
        issues: r.result?.lensResult?.issues || [],
        metrics: r.result?.lensResult?.metrics || {},
        qualityContext: r.result?.qualityContext || {},
        error: r.error,
      })),
    };

    return JSON.stringify(formatted, null, 2);
  }
}
```

**File**: `src/output/ConsoleReporter.ts`

```typescript
import chalk from 'chalk';

/**
 * Formats lens results for console output
 */
export class ConsoleReporter {
  report(results: any[]): void {
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('Quality Lens Results'));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    const byPackage = this.groupByPackage(results);

    Object.entries(byPackage).forEach(([pkg, pkgResults]) => {
      console.log(chalk.bold.blue(`📦 ${pkg}`));

      pkgResults.forEach((r: any) => {
        const icon = r.result?.success ? '✓' : '✗';
        const color = r.result?.success ? chalk.green : chalk.red;
        const duration = r.result?.duration
          ? `(${r.result.duration}ms)`
          : '';

        console.log(
          `  ${color(icon)} ${r.lens}: ${r.command} ${chalk.gray(duration)}`
        );

        if (r.result?.lensResult?.issues?.length > 0) {
          const errorCount = r.result.lensResult.issues.filter(
            (i: any) => i.severity === 'error'
          ).length;
          const warningCount = r.result.lensResult.issues.filter(
            (i: any) => i.severity === 'warning'
          ).length;

          if (errorCount > 0) {
            console.log(
              `    ${chalk.red(`${errorCount} error(s)`)}`
            );
          }
          if (warningCount > 0) {
            console.log(
              `    ${chalk.yellow(`${warningCount} warning(s)`)}`
            );
          }
        }

        if (r.error) {
          console.log(`    ${chalk.red('Error:')} ${r.error}`);
        }
      });

      console.log('');
    });

    // Summary
    const total = results.length;
    const passed = results.filter((r) => r.result?.success).length;
    const failed = total - passed;

    console.log(chalk.bold('Summary:'));
    console.log(`  Total: ${total}`);
    console.log(`  ${chalk.green('Passed:')} ${passed}`);
    console.log(`  ${chalk.red('Failed:')} ${failed}`);
    console.log('');
  }

  private groupByPackage(results: any[]): Record<string, any[]> {
    return results.reduce((acc, r) => {
      if (!acc[r.package]) {
        acc[r.package] = [];
      }
      acc[r.package].push(r);
      return acc;
    }, {});
  }
}
```

---

### 6. Database Client (Optional)

**File**: `src/database/DatabaseClient.ts`

```typescript
import { Pool } from 'pg';

/**
 * Client for saving lens results to PostgreSQL
 */
export class DatabaseClient {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
    });
  }

  /**
   * Save lens results to database
   */
  async saveResults(results: any[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create run record
      const runResult = await client.query(
        `INSERT INTO quality_lens_runs
         (repository, commit_sha, branch, run_timestamp, metadata)
         VALUES ($1, $2, $3, NOW(), $4)
         RETURNING id`,
        [
          process.env.GITHUB_REPOSITORY || 'unknown',
          process.env.GITHUB_SHA || 'unknown',
          process.env.GITHUB_REF_NAME || 'unknown',
          JSON.stringify({
            workflow: process.env.GITHUB_WORKFLOW,
            run_id: process.env.GITHUB_RUN_ID,
          }),
        ]
      );

      const runId = runResult.rows[0].id;

      // Insert results
      for (const result of results) {
        await client.query(
          `INSERT INTO quality_lens_results
           (run_id, package_name, lens_name, success, issues, metrics, analyzed_files, raw_output)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            runId,
            result.package,
            result.lens,
            result.result?.success ?? false,
            JSON.stringify(result.result?.lensResult?.issues || []),
            JSON.stringify(result.result?.lensResult?.metrics || {}),
            JSON.stringify(
              result.result?.lensResult?.analyzedFiles || []
            ),
            JSON.stringify({
              stdout: result.result?.stdout,
              stderr: result.result?.stderr,
              exitCode: result.result?.exitCode,
            }),
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
```

---

## GitHub Actions Integration

### Basic Workflow

**File**: `.github/workflows/quality-lens.yml`

```yaml
name: Quality Lens Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  analyze:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for git analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install quality-lens-cli
        run: npm install -g @principal-ai/quality-lens-cli

      - name: Run quality lenses
        id: lenses
        run: |
          quality-lens run . \
            --output results.json \
            --format json \
            --lenses eslint,jest,typescript

      - name: Upload results artifact
        uses: actions/upload-artifact@v4
        with:
          name: quality-lens-results
          path: results.json
          retention-days: 90

      - name: Save to database
        if: github.event_name == 'push'
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          quality-lens run . \
            --output results.json \
            --save \
            --db-url "$DATABASE_URL"

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('results.json', 'utf8'));

            const summary = results.results
              .map(r => {
                const status = r.execution.success ? '✅' : '❌';
                const issues = r.issues.length;
                return `${status} **${r.package.name}** - ${r.lens.id}: ${issues} issue(s)`;
              })
              .join('\n');

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Quality Lens Analysis\n\n${summary}`
            });
```

### Advanced Workflow with Matrix

```yaml
name: Quality Lens Analysis (Matrix)

on:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        lens: [eslint, jest, typescript, knip]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Run ${{ matrix.lens }}
        run: |
          npx @principal-ai/quality-lens-cli run . \
            --lenses ${{ matrix.lens }} \
            --output ${{ matrix.lens }}-results.json

      - name: Upload ${{ matrix.lens }} results
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.lens }}-results
          path: ${{ matrix.lens }}-results.json

  combine:
    needs: analyze
    runs-on: ubuntu-latest

    steps:
      - uses: actions/download-artifact@v4

      - name: Combine results
        run: |
          # Merge all JSON files and save to database
          node scripts/merge-and-save.js
```

---

## Database Schema

### PostgreSQL Schema

```sql
-- Table for tracking analysis runs
CREATE TABLE quality_lens_runs (
  id SERIAL PRIMARY KEY,
  repository VARCHAR(255) NOT NULL,
  commit_sha VARCHAR(40) NOT NULL,
  branch VARCHAR(255),
  run_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,

  INDEX idx_commit_sha (commit_sha),
  INDEX idx_branch (branch),
  INDEX idx_timestamp (run_timestamp)
);

-- Table for storing lens results
CREATE TABLE quality_lens_results (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES quality_lens_runs(id) ON DELETE CASCADE,
  package_name VARCHAR(255) NOT NULL,
  lens_name VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  issues JSONB,
  metrics JSONB,
  analyzed_files JSONB,
  raw_output JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_run_id (run_id),
  INDEX idx_package_name (package_name),
  INDEX idx_lens_name (lens_name),
  INDEX idx_success (success)
);

-- View for latest results per package/lens
CREATE VIEW latest_quality_results AS
SELECT DISTINCT ON (r.repository, rl.package_name, rl.lens_name)
  r.repository,
  r.commit_sha,
  r.branch,
  r.run_timestamp,
  rl.package_name,
  rl.lens_name,
  rl.success,
  rl.issues,
  rl.metrics
FROM quality_lens_results rl
JOIN quality_lens_runs r ON rl.run_id = r.id
ORDER BY r.repository, rl.package_name, rl.lens_name, r.run_timestamp DESC;

-- View for quality trends over time
CREATE VIEW quality_trends AS
SELECT
  r.repository,
  r.branch,
  rl.package_name,
  rl.lens_name,
  DATE_TRUNC('day', r.run_timestamp) AS day,
  COUNT(*) AS runs,
  SUM(CASE WHEN rl.success THEN 1 ELSE 0 END) AS successes,
  AVG((rl.issues->>'length')::int) AS avg_issues
FROM quality_lens_results rl
JOIN quality_lens_runs r ON rl.run_id = r.id
GROUP BY r.repository, r.branch, rl.package_name, rl.lens_name, day
ORDER BY day DESC;
```

---

## Implementation Roadmap

### Phase 1: Core CLI Package (Week 1-2)

**Tasks**:
1. Create new npm package structure
2. Extract and adapt `NodeExecutor` from `ElectronCLIBridgeExecutor`
3. Extract `QualityLensService` from electron-app
   - Copy from `src/main/quality-lenses/QualityLensService.ts:1-334`
   - Remove Electron dependencies
   - Update imports to use NodeExecutor
4. Implement `RepositoryScanner` for package discovery
5. Create basic CLI with yargs
6. Add output formatters (JSON, console)

**Files to Create**:
- `src/executor/NodeExecutor.ts`
- `src/service/QualityLensService.ts`
- `src/scanner/RepositoryScanner.ts`
- `src/cli.ts`
- `src/output/JsonFormatter.ts`
- `src/output/ConsoleReporter.ts`

**Testing**:
```bash
# Test locally on electron-app repo
npm run build
./bin/quality-lens.js run /path/to/electron-app --format console
./bin/quality-lens.js run /path/to/electron-app --output results.json
```

### Phase 2: GitHub Actions Integration (Week 3)

**Tasks**:
1. Publish package to npm as `@principal-ai/quality-lens-cli`
2. Create basic GitHub Action workflow
3. Test on electron-app repository
4. Add PR commenting functionality
5. Document usage in README

**Files to Create**:
- `.github/workflows/quality-lens.yml` (in electron-app)
- `README.md` (in CLI package)
- `USAGE.md` (in CLI package)

**Testing**:
```bash
# Create test PR
# Verify workflow runs
# Check PR comments
# Verify artifacts uploaded
```

### Phase 3: Database Integration (Week 4)

**Tasks**:
1. Implement `DatabaseClient` for PostgreSQL
2. Create database schema
3. Add `--save` flag to CLI
4. Update GitHub Action to save results
5. Create example queries for analyzing trends

**Files to Create**:
- `src/database/DatabaseClient.ts`
- `schema.sql`
- `docs/DATABASE.md`

**Testing**:
```bash
# Set up test database
export DATABASE_URL="postgresql://..."
quality-lens run . --save --db-url "$DATABASE_URL"

# Query results
psql $DATABASE_URL -c "SELECT * FROM latest_quality_results;"
```

### Phase 4: Advanced Features (Week 5-6)

**Tasks**:
1. Add support for custom lens configurations
2. Implement lens result caching
3. Add comparison between runs
4. Create dashboard for visualizing trends
5. Add support for other databases (MongoDB, etc.)

**Optional Enhancements**:
- Custom GitHub Action (`principal-ai/quality-lens-action@v1`)
- Web dashboard for viewing results
- Slack/Discord notifications
- Trend analysis and alerts

---

## Migration Path

### For Electron App

The electron-app will continue to use its existing quality lens infrastructure. The CLI package extracts reusable components but doesn't replace the electron-app's functionality.

**No Breaking Changes**:
- `src/main/quality-lenses/QualityLensService.ts` stays as-is
- `src/main/quality-lenses/ElectronCLIBridgeExecutor.ts` stays as-is
- All IPC handlers remain unchanged

**Optional Future Refactor**:
Consider extracting shared code into a common package that both electron-app and CLI use:
```
@principal-ai/quality-lens-core
  ├── QualityLensServiceBase (shared logic)
  └── interfaces

@principal-ai/quality-lens-cli
  ├── extends QualityLensServiceBase
  └── uses NodeExecutor

electron-app
  ├── extends QualityLensServiceBase
  └── uses ElectronCLIBridgeExecutor
```

---

## Testing Strategy

### Unit Tests

```typescript
// test/executor/NodeExecutor.test.ts
describe('NodeExecutor', () => {
  it('should execute commands successfully', async () => {
    const executor = new NodeExecutor();
    const result = await executor.execute('echo', ['hello'], '/tmp');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('should detect available commands', async () => {
    const executor = new NodeExecutor();
    expect(await executor.isAvailable('node')).toBe(true);
    expect(await executor.isAvailable('nonexistent')).toBe(false);
  });
});

// test/service/QualityLensService.test.ts
describe('QualityLensService', () => {
  it('should execute ESLint lens', async () => {
    const service = new QualityLensService();
    const result = await service.executeTool({
      repoPath: '/path/to/repo',
      packageLayer: mockPackageLayer,
      packageCommand: mockESLintCommand,
    });
    expect(result.lensResult).toBeDefined();
  });
});
```

### Integration Tests

```bash
# test/integration/cli.test.sh
#!/bin/bash

# Test CLI on real repository
quality-lens run ./fixtures/sample-repo --output /tmp/results.json

# Verify output
if [ ! -f /tmp/results.json ]; then
  echo "ERROR: Output file not created"
  exit 1
fi

# Verify JSON structure
jq '.metadata.totalPackages' /tmp/results.json > /dev/null
if [ $? -ne 0 ]; then
  echo "ERROR: Invalid JSON output"
  exit 1
fi

echo "✓ CLI integration test passed"
```

---

## File Reference Summary

### Electron App Files (Source Material)

| File | Lines | Purpose | Reusable? |
|------|-------|---------|-----------|
| `src/main/quality-lenses/QualityLensService.ts` | 1-334 | Core service orchestration | ✅ Extract |
| `src/main/quality-lenses/ElectronCLIBridgeExecutor.ts` | 1-145 | Command executor | ❌ Replace with NodeExecutor |
| `src/main/electron-cli-bridge/CLIBridge.ts` | 1-410 | Process management | ❌ Not needed |
| `src/main/quality-lenses/GitLensAdapter.ts` | 1-204 | Git operations | ❌ Replace with git CLI |
| `src/main/repository-monitoring/ipcHandlers.ts` | 366-393 | IPC handlers | ❌ Not needed |
| `src/repository-monitoring-server/PackageProcessor.ts` | - | Package discovery | ✅ Reference |

### CLI Package Files (New)

| File | Purpose | Based On |
|------|---------|----------|
| `src/executor/NodeExecutor.ts` | Node.js command executor | ElectronCLIBridgeExecutor.ts |
| `src/service/QualityLensService.ts` | Lens orchestration | QualityLensService.ts |
| `src/scanner/RepositoryScanner.ts` | Package discovery | PackageProcessor.ts |
| `src/git/GitAdapter.ts` | Git CLI wrapper | GitLensAdapter.ts |
| `src/cli.ts` | CLI entry point | New |
| `src/output/JsonFormatter.ts` | JSON output | New |
| `src/output/ConsoleReporter.ts` | Console output | New |
| `src/database/DatabaseClient.ts` | Database integration | New |

---

## Success Criteria

### Functional Requirements

- ✅ CLI can scan repositories and discover packages
- ✅ CLI can execute ESLint, Jest, TypeScript, and Knip lenses
- ✅ CLI outputs structured JSON with lens results
- ✅ GitHub Action runs on push/PR and saves results
- ✅ Results can be saved to PostgreSQL database
- ✅ PR comments show quality analysis summary

### Performance Requirements

- Scan repository in < 30 seconds for typical monorepo
- Execute all lenses in < 5 minutes for medium-sized project
- GitHub Action completes in < 10 minutes total

### Quality Requirements

- 80%+ test coverage for core modules
- TypeScript strict mode enabled
- All lenses produce valid LensResult objects
- Database schema supports efficient querying

---

## Questions for Implementation

1. **NPM Package Scope**: Publish as `@principal-ai/quality-lens-cli` or different scope?
2. **Database**: PostgreSQL only or support multiple databases?
3. **GitHub Action**: Create custom action or just workflow example?
4. **Lens Selection**: Run all lenses by default or require explicit selection?
5. **Error Handling**: Fail fast or collect all errors and report at end?
6. **Caching**: Cache lens results between runs?

---

## References

### Electron App Architecture
- `docs/QUALITY_LENS_ARCHITECTURE.md` - Current lens architecture
- `docs/QUALITY_LENS_INTEGRATION_REFACTOR.md` - Recent refactoring
- `docs/CODEBASE_COMPOSITION_USAGE.md` - Composition package usage

### External Packages
- `@principal-ai/codebase-quality-lenses` - Lens implementations
- `@principal-ai/codebase-composition-package` - Package discovery

### Related Tools
- GitHub Actions: https://docs.github.com/en/actions
- yargs: https://yargs.js.org/
- PostgreSQL: https://www.postgresql.org/

---

## Next Steps

1. **Review this design doc** with team
2. **Answer open questions** about scope and requirements
3. **Create CLI package scaffold** with basic structure
4. **Extract NodeExecutor** and test independently
5. **Extract QualityLensService** and test with NodeExecutor
6. **Implement CLI commands** and test locally
7. **Publish to npm** as alpha version
8. **Create GitHub Action workflow** and test on electron-app
9. **Implement database integration** if approved
10. **Document usage** and create examples

---

## Implementation Status

### ✅ Phase 1: Core CLI Package - COMPLETED (2025-10-17)

**Package Published**: `@principal-ai/quality-lens-cli@0.1.0`
- **NPM Registry**: https://www.npmjs.com/package/@principal-ai/quality-lens-cli
- **Repository**: `/Users/griever/Developer/codebase-quality-lens-cli`
- **Git Tag**: v0.1.0

**Completed Tasks**:
1. ✅ Created npm package structure with TypeScript strict mode
2. ✅ Copied and adapted NodeExecutor from electron-app's repository-monitoring-server
3. ✅ Extracted and adapted QualityLensService from electron-app
4. ✅ Implemented RepositoryScanner using PathsFileTreeBuilder
5. ✅ Created CLI with yargs (run and list commands)
6. ✅ Implemented output formatters (JSON and Console)
7. ✅ Added ESLint configuration for linting
8. ✅ Created comprehensive README documentation
9. ✅ Set up GitHub Actions CI workflow
10. ✅ Published to npm registry

**Package Details**:
- Version: 0.1.0
- Package size: 14.2 kB
- Unpacked size: 61.4 kB
- Dependencies: 6 (@principal-ai/codebase-composition, @principal-ai/codebase-quality-lenses, @principal-ai/repository-abstraction, chalk, tslib, yargs)

**Files Created**:
```
codebase-quality-lens-cli/
├── src/
│   ├── cli.ts (258 lines)
│   ├── executor/NodeExecutor.ts (184 lines - copied from electron-app)
│   ├── service/QualityLensService.ts (333 lines - adapted from electron-app)
│   ├── scanner/RepositoryScanner.ts (143 lines - adapted from PackageProcessor)
│   ├── output/
│   │   ├── JsonFormatter.ts (79 lines)
│   │   └── ConsoleReporter.ts (78 lines)
├── bin/quality-lens.js
├── .github/workflows/ci.yml
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .gitignore
└── README.md
```

**Testing Results**:
```bash
# Successfully tested locally
$ ./bin/quality-lens.js list .
Scanning repository: /Users/griever/Developer/codebase-quality-lens-cli
[RepositoryScanner] Found 1 packages
@principal-ai/quality-lens-cli:
  Available: eslint, typescript, test
  Missing: prettier, knip, typedoc
```

**Key Adaptations Made**:
1. **NodeExecutor**: Used existing implementation from `repository-monitoring-server/NodeExecutor.ts` (already designed for non-Electron environments)
2. **QualityLensService**:
   - Removed singleton pattern (not needed for CLI)
   - Removed ElectronCLIBridgeExecutor dependency, replaced with NodeExecutor
   - Removed IPC-specific code
   - Updated package imports from `@principal-ai/codebase-composition-package` to `@principal-ai/codebase-composition`
3. **RepositoryScanner**:
   - Adapted from PackageProcessor
   - Removed QualityScoreEnrichment (not needed for initial version)
   - Used PathsFileTreeBuilder from `@principal-ai/repository-abstraction`
4. **CLI**:
   - Implemented with yargs for argument parsing
   - Two commands: `run` and `list`
   - Support for filtering lenses, output formats, and JSON export

**Commands Available**:
```bash
# List available lenses in a repository
quality-lens list [path]

# Run quality lenses
quality-lens run [path] [options]
  --output, -o     Output file for JSON results
  --lenses         Comma-separated list of lenses to run
  --format         Output format: json or console (default: console)
```

---

### 🔲 Phase 2: GitHub Actions Integration - READY

**Next Steps**:
1. Test package installation: `npm install -g @principal-ai/quality-lens-cli`
2. Create GitHub Actions workflow in electron-app
3. Test on real repository with multiple packages
4. Add PR commenting functionality

**Example Workflow** (ready to use):
```yaml
- name: Install quality-lens-cli
  run: npm install -g @principal-ai/quality-lens-cli

- name: Run quality lenses
  run: quality-lens run . --lenses eslint,typescript --format json --output results.json
```

---

### 🔲 Phase 3: Database Integration - NOT STARTED

Database client implementation is documented but not yet implemented. The `DatabaseClient.ts` file structure is defined in the design but was not included in v0.1.0 release.

---

### 🔲 Phase 4: Advanced Features - NOT STARTED

Future enhancements documented but not yet prioritized.

---

## Lessons Learned

1. **Reuse Over Rebuild**: The electron-app already had a NodeExecutor implementation in the repository-monitoring-server, which was perfect for CLI use without modification.

2. **Package Name Corrections**: During implementation, discovered the actual package names:
   - Design doc referenced: `@principal-ai/codebase-composition-package`
   - Actual package name: `@principal-ai/codebase-composition`

3. **FileTree Structure**: The `@principal-ai/repository-abstraction` package uses a more complex FileTree structure than initially documented. Used `PathsFileTreeBuilder` to properly construct FileTree objects.

4. **TypeScript Strict Mode**: Enabled strict mode which caught several type issues:
   - Array index access requiring non-null assertions
   - Environment variable access requiring bracket notation
   - Optional chaining for package paths

5. **Successful First Deployment**: Package was successfully published to npm on first attempt with proper build pipeline, documentation, and CI setup.

---

**Document Version**: 1.1
**Created**: 2025-10-15
**Updated**: 2025-10-17
**Author**: Design based on electron-app quality lens system
**Status**: Phase 1 Complete - v0.1.0 Published to NPM
