# electron-cli-bridge Migration Guide

## Overview

This guide provides step-by-step instructions for migrating existing `child_process` spawn/fork calls to use the new `electron-cli-bridge` library, which solves the EBADF error issues in Electron's main process.

## Quick Start

### 1. Import the Library

```typescript
import { electronCLI } from './electron-cli-bridge';
```

### 2. Initialize (Once per App)

```typescript
// In your initialization code (after app.ready)
await electronCLI.initialize();
```

### 3. Replace spawn/fork Calls

## Migration Patterns

### Pattern 1: Simple Command Execution

**Before:**
```typescript
import { spawn, execSync } from 'child_process';

// Old way - fails with EBADF
const child = spawn('git', ['status']);
child.stdout.on('data', (data) => console.log(data));

// Or using execSync
const output = execSync('git status', { encoding: 'utf8' });
```

**After:**
```typescript
import { electronCLI } from './electron-cli-bridge';

// New way - works reliably
const result = await electronCLI.git(['status']);
console.log(result.stdout);

// Or for any command
const result = await electronCLI.execute('git', ['status']);
```

### Pattern 2: ESLint Integration

**Before:**
```typescript
// Complex spawn setup that fails
const eslintScript = `...complex script...`;
const child = spawn(process.execPath, [tempScriptPath], {
  cwd: rootPath,
  stdio: 'pipe'
});
// ... handle stdout, stderr, exit
```

**After:**
```typescript
// Simple and reliable
const results = await electronCLI.eslint(['src/**/*.ts'], {
  cwd: rootPath,
  fix: true,
  format: 'json'
});
// results is already parsed JSON array of ESLintResult
```

### Pattern 3: NPM/Package Manager Commands

**Before:**
```typescript
const child = spawn('npm', ['install', packageName], {
  cwd: projectPath,
  stdio: 'pipe'
});
```

**After:**
```typescript
const result = await electronCLI.npm(['install', packageName], {
  cwd: projectPath
});
```

### Pattern 4: Streaming Output (Long-running processes)

**Before:**
```typescript
const child = spawn('npm', ['install']);
child.stdout.on('data', (chunk) => {
  console.log('Progress:', chunk.toString());
});
```

**After:**
```typescript
// Note: Current implementation doesn't support streaming yet
// Use regular execution and show spinner
const result = await electronCLI.npm(['install'], {
  timeout: 300000 // 5 minutes
});
```

### Pattern 5: Git Operations

**Before:**
```typescript
// Using simple-git or direct spawn
const git = simpleGit(repoPath);
const status = await git.status();

// Or
const output = execSync('git branch --show-current', {
  cwd: repoPath,
  encoding: 'utf8'
});
```

**After:**
```typescript
// Direct git commands
const result = await electronCLI.git(['branch', '--show-current'], {
  cwd: repoPath
});
const branch = result.stdout.trim();

// Status
const status = await electronCLI.git(['status', '--porcelain'], {
  cwd: repoPath
});
```

## Service-Specific Migration

### ViolationCollectionService

```typescript
// Before: Complex ESLint process spawning
private async runESLintProcess(rootPath: string, tempFilePath: string) {
  // ... complex script creation and spawn logic
}

// After: Simple ESLint execution
private async runESLintProcess(rootPath: string, files: string[]) {
  const results = await electronCLI.eslint(files, {
    cwd: rootPath,
    format: 'json'
  });
  return results;
}
```

### GitClientFactory

```typescript
// Before: Using simple-git with complex configuration
const git = simpleGit(baseDir, {
  maxConcurrentProcesses: 1,
  // ... complex config to avoid EBADF
});

// After: Can use electronCLI for direct git commands
const result = await electronCLI.git(['rev-parse', '--show-toplevel'], {
  cwd: baseDir
});
```

### PackageManagerService

```typescript
// Before: Direct spawn calls
spawn('npm', ['install'], { stdio: 'inherit' });

// After: electronCLI methods
await electronCLI.npm(['install']);
```

## API Reference

### Core Methods

```typescript
// Generic command execution
electronCLI.execute(command: string, args?: string[], options?: ExecuteOptions)

// Convenience methods
electronCLI.git(args: string[], options?: ExecuteOptions)
electronCLI.npm(args: string[], options?: ExecuteOptions)
electronCLI.yarn(args: string[], options?: ExecuteOptions)
electronCLI.pnpm(args: string[], options?: ExecuteOptions)

// Specialized methods with parsing
electronCLI.eslint(patterns: string[], options?: { fix?: boolean, format?: string })
electronCLI.prettier(patterns: string[], options?: { write?: boolean })
electronCLI.jest(args: string[], options?: { coverage?: boolean })
electronCLI.tsc(args: string[], options?: ExecuteOptions)
```

### Options

```typescript
interface ExecuteOptions {
  cwd?: string;              // Working directory
  env?: Record<string, string>; // Environment variables
  timeout?: number;          // Timeout in milliseconds
  maxBuffer?: number;        // Max buffer size (default 10MB)
  encoding?: BufferEncoding; // Output encoding (default 'utf8')
  shell?: boolean;           // Use shell execution
}
```

### Return Value

```typescript
interface ExecuteResult {
  success: boolean;  // true if exit code is 0
  stdout: string;    // Standard output
  stderr: string;    // Standard error
  exitCode: number;  // Process exit code
  duration: number;  // Execution time in ms
}
```

## Migration Checklist

### For Each Service/Module:

- [ ] Search for `import.*child_process`
- [ ] Search for `spawn(`, `fork(`, `exec(`, `execSync(`
- [ ] Import electronCLI
- [ ] Add initialization if not present
- [ ] Replace each spawn/fork call using patterns above
- [ ] Test the migrated code
- [ ] Remove old spawn utility functions

### Files to Migrate:

- [ ] `src/main/services/ViolationCollectionService.ts`
- [ ] `src/main/utils/gitClientFactory.ts` (optional, simple-git works)
- [ ] `src/main/services/PackageManagerService.ts`
- [ ] `src/main/services/TestCoverageService.ts`
- [ ] `src/main/terminal.ts`
- [ ] Any other files using child_process

## Testing

After migration, test:

1. **ESLint**: Run linting on a file
2. **Git**: Check git status, create commits
3. **NPM**: Install a package
4. **Build**: Run build commands

## Troubleshooting

### Issue: "CLIBridge not initialized"
**Solution:** Ensure `await electronCLI.initialize()` is called after app.ready

### Issue: Command not found
**Solution:** Check PATH is properly set in options.env

### Issue: Timeout errors
**Solution:** Increase timeout in options for long-running commands

### Issue: Worker exits unexpectedly
**Solution:** Check logs for stderr output, ensure .cjs extension for workers

## Benefits After Migration

1. ✅ No more EBADF errors
2. ✅ Cleaner, more maintainable code
3. ✅ Better error handling
4. ✅ Consistent API across all CLI operations
5. ✅ Type safety with TypeScript
6. ✅ Automatic retry and fallback mechanisms

## Support

If you encounter issues during migration:

1. Check the error logs for detailed messages
2. Verify the command works in terminal directly
3. Review the design document: `ELECTRON_CLI_BRIDGE_DESIGN.md`
4. Contact the platform team for assistance

## Conclusion

The migration to electron-cli-bridge eliminates the persistent EBADF errors and provides a more robust foundation for CLI operations in our Electron application. The migration process is straightforward - most changes involve replacing complex spawn logic with simple async method calls.