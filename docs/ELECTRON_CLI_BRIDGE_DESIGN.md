# Electron CLI Bridge - Design Document

## Executive Summary

This document outlines the design for `electron-cli-bridge`, a library to solve the persistent EBADF (Bad File Descriptor) errors when spawning child processes in Electron's main process. The library provides a standardized, reliable interface for executing CLI commands using Electron's `utilityProcess` API.

## Problem Statement

### Current Issues
1. **EBADF Errors**: All standard Node.js spawn methods (`spawn`, `fork`, `execSync`) fail with EBADF errors in Electron 38.1.0
2. **Inconsistent Workarounds**: Different parts of the codebase use different workarounds (execSync fallbacks, shell:true, etc.)
3. **No Standardization**: Each service implements its own spawn logic leading to code duplication
4. **Reliability Issues**: Sporadic failures depending on Electron version and system state

### Impact
- ESLint integration broken
- Git operations unreliable without special configuration
- General CLI tool execution fails
- Development velocity impacted by spawn-related bugs

## Proposed Solution

### Core Concept
Create a centralized library that uses Electron's `utilityProcess` API to spawn worker processes that handle all CLI command execution. This bypasses Node's problematic `child_process` module in Electron's main process.

### Key Architecture Decisions

1. **utilityProcess Over child_process**: Use Electron's native API designed for this use case
2. **Worker Pool Pattern**: Maintain persistent workers to avoid spawn overhead
3. **Universal + Specialized Workers**: One universal worker for general commands, specialized workers for frequently used tools
4. **Message-Based Communication**: Async message passing between main process and workers
5. **TypeScript First**: Full type safety for better developer experience

## Technical Design

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │            ElectronCLI (High-Level API)          │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              CLIBridge (Orchestrator)            │   │
│  │  - Worker lifecycle management                   │   │
│  │  - Message routing                               │   │
│  │  - Call tracking                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│         ┌───────────────┼───────────────┐              │
│         │               │               │              │
└─────────┼───────────────┼───────────────┼──────────────┘
          │               │               │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
    │ Universal │   │    Git    │   │    NPM    │
    │  Worker   │   │  Worker   │   │  Worker   │
    └───────────┘   └───────────┘   └───────────┘
    (utilityProcess) (utilityProcess) (utilityProcess)
```

### Module Structure

```
electron-cli-bridge/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── ElectronCLI.ts              # High-level convenience API
│   ├── CLIBridge.ts                # Core orchestrator
│   ├── workers/
│   │   ├── universal-worker.js     # Handles all general CLI commands
│   │   ├── git-worker.js           # Optimized git operations
│   │   ├── npm-worker.js           # NPM/Yarn/PNPM operations
│   │   └── base-worker.js          # Shared worker utilities
│   ├── executors/
│   │   ├── BaseExecutor.ts         # Abstract base class
│   │   ├── GitExecutor.ts          # Git-specific conveniences
│   │   ├── NpmExecutor.ts          # Package manager conveniences
│   │   └── LintExecutor.ts         # ESLint/Prettier conveniences
│   ├── types/
│   │   ├── index.ts                # Public type definitions
│   │   ├── commands.ts             # Command-specific types
│   │   └── workers.ts              # Worker message types
│   └── utils/
│       ├── commandParser.ts        # Parse and validate commands
│       └── processManager.ts       # Process lifecycle utilities
├── tests/
│   ├── unit/                       # Unit tests
│   └── integration/                # Integration tests
├── package.json
├── tsconfig.json
└── README.md
```

### Core APIs

#### 1. Initialization
```typescript
interface CLIBridgeOptions {
  workers?: WorkerConfig[];
  maxWorkers?: number;
  workerTimeout?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

class ElectronCLI {
  constructor(options?: CLIBridgeOptions);
  async initialize(): Promise<void>;
  async shutdown(): Promise<void>;
}
```

#### 2. Command Execution
```typescript
interface ExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  maxBuffer?: number;
  encoding?: BufferEncoding;
  shell?: boolean;
}

interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

class ElectronCLI {
  // Generic execution
  async execute(command: string, args?: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
  
  // Streaming execution
  async stream(
    command: string, 
    args?: string[], 
    options?: ExecuteOptions & {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    }
  ): Promise<ExecuteResult>;
  
  // Convenience methods
  async git(args: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
  async npm(args: string[], options?: ExecuteOptions): Promise<ExecuteResult>;
  async eslint(patterns: string[], options?: ExecuteOptions): Promise<ESLintResult>;
}
```

#### 3. Worker Communication Protocol
```typescript
// Main -> Worker
interface WorkerCommand {
  id: string;
  type: 'execute' | 'stream' | 'kill';
  command: string;
  args: string[];
  options: ExecuteOptions;
}

// Worker -> Main
interface WorkerResponse {
  id: string;
  type: 'stdout' | 'stderr' | 'complete' | 'error';
  data?: string;
  exitCode?: number;
  error?: string;
}
```

### Implementation Details

#### Worker Lifecycle Management
1. Workers spawn on `initialize()` after app.ready
2. Automatic restart on crash with exponential backoff
3. Graceful shutdown on app quit
4. Health checks via periodic ping/pong

#### Error Handling Strategy
1. **Primary**: Try execSync in worker (most reliable)
2. **Fallback 1**: Try spawn with shell:true
3. **Fallback 2**: Restart worker and retry once
4. **Final**: Return detailed error with diagnostics

#### Performance Optimizations
1. Worker pooling to avoid spawn overhead
2. Command batching for multiple operations
3. Result caching for idempotent commands (git status, etc.)
4. Automatic buffer management to prevent memory issues

## Migration Plan

### Phase 1: Proof of Concept ✅ COMPLETED
- [x] Implement core CLIBridge with universal worker
- [x] Create ESLint executor
- [x] Test with ViolationCollectionService
- [x] Validate EBADF issue resolution
- [x] Fix CommonJS/ESM compatibility (.cjs extension)

### Phase 2: Full Implementation (Current)
- [x] Core implementation complete
- [x] Universal worker functioning
- [ ] Add specialized workers (git, npm) - optional optimization
- [x] Implement convenience methods (git, npm, eslint, etc.)
- [x] Add comprehensive error handling
- [ ] Write unit and integration tests

### Phase 3: Integration (Next Steps)
- [ ] Migrate ViolationCollectionService to use electron-cli-bridge
- [ ] Migrate GitClientFactory spawn calls
- [ ] Migrate PackageManagerService
- [ ] Update TestCoverageService
- [ ] Replace all direct spawn/fork usage

### Phase 4: Production Hardening
- [ ] Test in packaged application
- [ ] Add monitoring and metrics
- [ ] Performance benchmarking
- [ ] Complete documentation
- [ ] Team training

## Implementation Notes

### Critical Discoveries
1. **Worker files must use `.cjs` extension** when package.json has `"type": "module"`
2. **Path resolution** must handle both development (webpack) and production paths
3. **utilityProcess communication** uses `process.parentPort`, not `process.send`
4. **execSync in worker context** is most reliable for CLI execution

## Success Metrics

1. **Reliability**: Zero EBADF errors in production
2. **Performance**: < 50ms overhead vs direct spawn (when working)
3. **Adoption**: 100% of CLI operations using the library
4. **Maintainability**: Single source of truth for CLI execution

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| utilityProcess has unknown issues | High | Implement execSync fallback in workers |
| Performance overhead | Medium | Benchmark and optimize worker pooling |
| Complex debugging | Medium | Comprehensive logging and debugging tools |
| Migration complexity | Low | Gradual migration with compatibility layer |

## Example Usage

### Basic Command Execution
```typescript
const cli = new ElectronCLI();
await cli.initialize();

// Simple command
const { stdout } = await cli.execute('ls', ['-la']);

// With options
const result = await cli.execute('npm', ['install'], {
  cwd: '/path/to/project',
  timeout: 60000
});
```

### ESLint Integration
```typescript
// Before (broken with EBADF)
const child = spawn('npx', ['eslint', 'src/**/*.ts']);

// After (works reliably)
const results = await cli.eslint(['src/**/*.ts'], {
  fix: true,
  format: 'json'
});
```

### Git Operations
```typescript
// Get current branch
const { stdout: branch } = await cli.git(['branch', '--show-current']);

// Stage and commit
await cli.git(['add', '.']);
await cli.git(['commit', '-m', 'feat: add new feature']);
```

### Streaming Long Operations
```typescript
await cli.stream('npm', ['install'], {
  onStdout: (data) => console.log('Progress:', data),
  onStderr: (data) => console.error('Error:', data)
});
```

## Testing Strategy

### Unit Tests
- Mock utilityProcess API
- Test message routing
- Test error handling
- Test command parsing

### Integration Tests
- Real command execution
- Worker crash recovery
- Timeout handling
- Memory leak detection

### E2E Tests
- Full ESLint run
- Git operations sequence
- NPM install/build cycle
- Concurrent operations

## Documentation Requirements

1. **API Reference**: Full TypeDoc documentation
2. **Migration Guide**: Step-by-step for existing code
3. **Troubleshooting**: Common issues and solutions
4. **Examples**: Real-world usage patterns

## Open Questions

1. Should we support custom worker scripts for specific tools?
2. How should we handle worker crashes during critical operations?
3. Should we implement command queueing or reject when busy?
4. Do we need backwards compatibility with child_process API?

## Appendix A: Current EBADF Error Analysis

### Error Manifestation
```
Error: spawn EBADF
  errno: -9
  code: 'EBADF'
  syscall: 'spawn'
```

### Root Causes
1. File descriptor 0 (stdin) not properly initialized in Electron main
2. Conflict between Node's libuv and Electron's Chromium event loops
3. File descriptor exhaustion after extended operation

### Why utilityProcess Solves This
1. Uses Chromium's Services API instead of Node's fork
2. Proper file descriptor initialization in worker context
3. Isolation from main process file descriptor table
4. Designed specifically for Electron's architecture

## Appendix B: Alternative Approaches Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Fix spawn directly | No new abstraction | May not be possible | ❌ Rejected |
| Use execSync everywhere | Simple, works | No streaming, blocking | ❌ Rejected |
| Remote process via IPC | Complete isolation | Complex, network overhead | ❌ Rejected |
| utilityProcess wrapper | Designed for this, reliable | New abstraction | ✅ Selected |

## Conclusion

The electron-cli-bridge library provides a robust, permanent solution to the EBADF problem while establishing a clean, maintainable pattern for CLI integration in Electron applications. The investment in this architecture will pay dividends in reliability, developer experience, and maintainability.

## Next Steps

1. Review and approve this design
2. Implement Phase 1 proof of concept with ESLint
3. Validate solution resolves EBADF issues
4. Proceed with full implementation upon successful validation