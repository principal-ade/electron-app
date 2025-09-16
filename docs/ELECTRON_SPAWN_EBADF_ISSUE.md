# Electron Spawn EBADF Issue - Investigation Report

## Problem Statement

We need a general solution for spawning child processes in Electron's main process to run various CLI tools (ESLint, git, npm, etc.). Currently experiencing `spawn EBADF` errors that prevent execution of external commands.

## Environment

- **Electron Version**: 38.1.0 (also occurred in 37.2.4)
- **Node Version**: v22.19.0 (in Electron)
- **Platform**: macOS (darwin)
- **Error**: `Error: spawn EBADF` (errno: -9, syscall: 'spawn')

## What We Know For Certain

### 1. The Error Occurs With All Standard Spawn Methods

Testing confirmed ALL of these fail with EBADF in Electron main process:
- `spawn()` with `stdio: ['pipe', 'pipe', 'pipe']`
- `spawn()` with `stdio: ['ignore', 'pipe', 'pipe']`
- `spawn()` with `stdio: 'inherit'`
- `fork()` (internally uses spawn)
- Custom `safeSpawn` utility with various stdio configurations

### 2. What Works vs What Doesn't

**WORKS:**
- TypeScript validation - uses the TypeScript API directly **in-process**, no spawning
- Git commands via `simple-git` library (with `maxConcurrentProcesses: 1` in Electron)

**DOESN'T WORK:**
- ESLint via any spawn method
- Git commands via direct spawn
- General command execution via spawn/fork

**UNCERTAIN:**
- `execSync()` - Used as fallback in GitClientFactory but not fully tested
- `spawn()` with `shell: true` - Used in TestCoverageService but not verified if actually working

### 3. The Issue is Systemic

The diagnostics show this isn't limited to one command:
```
[GitWatcher] Branch command failed: Error: spawn EBADF
[GitWatcher] Status command failed: Error: spawn EBADF
[ESLint] Process execution error: Error: spawn EBADF
```

## What We Need

### Primary Requirement
A reliable, general-purpose method to execute ANY external command/CLI tool from Electron's main process without EBADF errors.

### Use Cases That Must Work
1. **ESLint** - Running linting via Node.js script
2. **Git** - Various git commands for version control
3. **NPM/Yarn/PNPM** - Package manager commands
4. **Jest** - Running tests with coverage
5. **Custom CLI tools** - Any user-installed command-line tools

### Constraints
- Must work in Electron main process
- Must capture stdout/stderr for parsing results
- Must support environment variable configuration
- Must handle timeouts and process cleanup
- Should work across platforms (macOS, Windows, Linux)

## Attempted Solutions

1. **Standard spawn with various stdio configs** - Failed with EBADF
2. **Fork for Node.js scripts** - Failed with EBADF (uses spawn internally)
3. **Custom safeSpawn utility** - Failed with EBADF
4. **execSync as fallback** - Not fully tested, may have same issue

## Code Locations

- **Working TypeScript implementation**: `src/main/services/ViolationCollectionService.ts` lines 223-303
- **Failing ESLint implementation**: `src/main/services/ViolationCollectionService.ts` lines 308-502
- **Spawn test diagnostics**: `src/main/utils/testSpawnInElectron.ts`
- **SafeSpawn utility**: `src/main/utils/safeSpawn.ts`

## Questions for Investigation

1. Why do ALL spawn methods fail with EBADF in Electron 38.1.0?
2. Is this a known Electron issue with file descriptor handling?
3. Are there Electron-specific APIs we should use instead (e.g., utilityProcess)?
4. Would downgrading to a stable Electron version (e.g., 33.x) help?
5. Is there a way to properly initialize file descriptors in Electron main process?

## Test Case

The simplest test that fails:
```javascript
const { spawn } = require('child_process');
const child = spawn(process.execPath, ['-e', 'console.log("test")'], {
  stdio: ['pipe', 'pipe', 'pipe']
});
// Results in: Error: spawn EBADF
```

## Desired Solution

A documented, tested approach that:
1. Works reliably in Electron main process
2. Can execute any CLI command
3. Captures output for processing
4. Handles errors gracefully
5. Works across different Electron versions

## Additional Context

- This was reportedly working at some point (based on user comment)
- The issue persists across Electron versions (37.2.4 to 38.1.0)
- Native modules have been properly rebuilt for the Electron version
- The issue appears specific to Electron's process model and file descriptor handling