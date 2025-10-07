# Local Workflow Runner - Design Document

## Overview

A lightweight TypeScript library for parsing and executing GitHub Actions workflows locally on the host machine (initially macOS, extensible to other platforms). This library enables running CI/CD workflows outside of GitHub's infrastructure while maintaining compatibility with standard workflow syntax.

## Goals

1. **Parse** GitHub Actions workflow YAML files
2. **Execute** workflow steps in isolated temporary directories
3. **Inject** secrets and environment variables from external sources
4. **Stream** real-time output and progress events
5. **Handle** platform-specific requirements (macOS code signing, etc.)
6. **Gracefully degrade** for unsupported actions

## Non-Goals

1. Docker/container support (use host machine directly)
2. Cross-platform emulation (run what the host supports)
3. Full GitHub Actions compatibility (only core features)
4. Action marketplace support (only built-in actions)

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────┐
│                 Local Workflow Runner                │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Workflow   │  │   Workflow   │  │ Execution │ │
│  │    Parser    │─▶│  Validator   │─▶│  Engine   │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         │                  │                 │       │
│         ▼                  ▼                 ▼       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │    Action    │  │   Platform   │  │  Output   │ │
│  │   Handler    │  │   Detector   │  │  Stream   │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## Data Models

### WorkflowFile
```typescript
interface WorkflowFile {
  name: string;
  on: WorkflowTriggers;
  jobs: Record<string, Job>;
  env?: Record<string, string>;
}

interface WorkflowTriggers {
  push?: PushTrigger;
  pull_request?: PullRequestTrigger;
  workflow_dispatch?: WorkflowDispatchTrigger;
  [key: string]: any;
}

interface Job {
  name?: string;
  'runs-on': string | string[];
  steps: Step[];
  env?: Record<string, string>;
  if?: string;
  needs?: string | string[];
}

interface Step {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
  if?: string;
  'continue-on-error'?: boolean;
  'working-directory'?: string;
}
```

### ExecutionContext
```typescript
interface ExecutionContext {
  // Repository information
  repoPath: string;
  repoName: string;
  repoOwner?: string;

  // Execution environment
  workingDirectory: string;  // Temporary directory for execution
  runnerTemp: string;        // RUNNER_TEMP equivalent
  platform: Platform;

  // Secrets and environment
  secrets: Record<string, string>;
  env: Record<string, string>;

  // GitHub context simulation
  github: {
    ref: string;
    sha: string;
    event_name: string;
    event?: Record<string, any>;
  };

  // Options
  dryRun?: boolean;
  publish?: boolean;
}

type Platform = 'macos' | 'linux' | 'windows';
```

### ExecutionResult
```typescript
interface ExecutionResult {
  success: boolean;
  jobResults: JobResult[];
  duration: number;
  artifacts?: Artifact[];
  error?: string;
}

interface JobResult {
  jobId: string;
  jobName: string;
  success: boolean;
  skipped: boolean;
  skipReason?: string;
  stepResults: StepResult[];
  duration: number;
}

interface StepResult {
  stepName: string;
  success: boolean;
  skipped: boolean;
  skipReason?: string;
  output: string[];
  exitCode?: number;
  duration: number;
}

interface Artifact {
  name: string;
  files: string[];
  localPath: string;
}
```

### Event Stream
```typescript
type WorkflowEvent =
  | { type: 'workflow-start'; workflow: string }
  | { type: 'job-start'; jobId: string; jobName: string }
  | { type: 'job-skip'; jobId: string; reason: string }
  | { type: 'job-complete'; jobId: string; success: boolean; duration: number }
  | { type: 'step-start'; jobId: string; stepName: string }
  | { type: 'step-skip'; jobId: string; stepName: string; reason: string }
  | { type: 'step-output'; jobId: string; stepName: string; line: string }
  | { type: 'step-complete'; jobId: string; stepName: string; success: boolean; duration: number }
  | { type: 'workflow-complete'; success: boolean; duration: number }
  | { type: 'error'; message: string; context?: any };

type EventListener = (event: WorkflowEvent) => void;
```

---

## Public API

### WorkflowRunner (Main Class)

```typescript
class WorkflowRunner {
  constructor(options?: RunnerOptions);

  /**
   * Parse a workflow file from disk
   */
  parseWorkflow(workflowPath: string): Promise<WorkflowFile>;

  /**
   * Validate that a workflow can run on the current platform
   */
  validateWorkflow(workflow: WorkflowFile, platform: Platform): ValidationResult;

  /**
   * Execute a workflow with the given context
   */
  executeWorkflow(
    workflow: WorkflowFile,
    context: ExecutionContext,
    listener?: EventListener
  ): Promise<ExecutionResult>;

  /**
   * Register an event listener for workflow execution
   */
  on(listener: EventListener): () => void;

  /**
   * Get list of required secrets for a workflow
   */
  getRequiredSecrets(workflow: WorkflowFile): string[];

  /**
   * Cleanup temporary files and resources
   */
  cleanup(): Promise<void>;
}

interface RunnerOptions {
  /**
   * Keep temporary directories after execution (for debugging)
   */
  keepTempDirs?: boolean;

  /**
   * Maximum execution time in milliseconds
   */
  timeout?: number;

  /**
   * Custom action handlers
   */
  actionHandlers?: Record<string, ActionHandler>;

  /**
   * Shell to use for executing commands
   */
  shell?: 'bash' | 'sh' | 'zsh';
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  runnableJobs: string[];
  skippedJobs: Array<{ jobId: string; reason: string }>;
}

type ActionHandler = (
  step: Step,
  context: ExecutionContext
) => Promise<ActionResult>;

interface ActionResult {
  success: boolean;
  output?: string[];
  error?: string;
}
```

---

## Built-in Action Handlers

The library will include handlers for common GitHub Actions:

### `actions/checkout@v*`
```typescript
// When copying to temp directory, we've already "checked out"
// Just validate git status and report
handler: async (step, context) => {
  // Verify git repository
  // Optionally checkout specific ref if specified in 'with'
  return { success: true, output: ['Repository already checked out'] };
}
```

### `actions/setup-node@v*`
```typescript
// Verify Node.js version matches
handler: async (step, context) => {
  const requiredVersion = step.with?.['node-version'];
  const currentVersion = process.version;
  // Validate and report
  return { success: true, output: [`Using Node.js ${currentVersion}`] };
}
```

### `actions/upload-artifact@v*`
```typescript
// Copy files to local artifacts directory
handler: async (step, context) => {
  const name = step.with?.name;
  const path = step.with?.path;
  // Copy files and track as artifacts
  return { success: true, output: [`Artifacts saved to: ${localPath}`] };
}
```

### Custom Handler Registration
```typescript
const runner = new WorkflowRunner({
  actionHandlers: {
    'custom/action@v1': async (step, context) => {
      // Custom implementation
      return { success: true };
    }
  }
});
```

---

## Workflow Execution Flow

```
1. Parse Workflow YAML
   ↓
2. Validate Platform Compatibility
   ↓
3. Create Temporary Working Directory
   ↓
4. Copy Repository Files (excluding node_modules, .git, etc.)
   ↓
5. For Each Job:
   a. Check 'runs-on' matches current platform
   b. Resolve dependencies ('needs')
   c. Evaluate 'if' conditions
   d. For Each Step:
      i.   Evaluate 'if' conditions
      ii.  Handle 'uses' actions or 'run' commands
      iii. Inject environment variables and secrets
      iv.  Execute and capture output
      v.   Handle errors (fail-fast or continue)
   e. Collect artifacts
   ↓
6. Copy Artifacts Back to Original Repository
   ↓
7. Cleanup Temporary Resources
   ↓
8. Return Execution Result
```

---

## Integration with Electron App

### Service Layer

```typescript
// src/main-process-api/LocalWorkflowService.ts

class LocalWorkflowService {
  private runner: WorkflowRunner;
  private secretsService: SecretsService;

  async runWorkflow(params: {
    repoPath: string;
    workflowPath: string;
    repoId: string;
    inputs?: Record<string, any>;
  }): Promise<ExecutionResult> {
    // 1. Parse workflow
    const workflow = await this.runner.parseWorkflow(params.workflowPath);

    // 2. Get secrets from SecretsService
    const secrets = await this.secretsService.get(params.repoId);

    // 3. Build execution context
    const context: ExecutionContext = {
      repoPath: params.repoPath,
      repoName: path.basename(params.repoPath),
      workingDirectory: await this.createTempDir(),
      runnerTemp: path.join(await this.createTempDir(), 'runner'),
      platform: this.detectPlatform(),
      secrets,
      env: process.env,
      github: {
        ref: await this.getCurrentRef(params.repoPath),
        sha: await this.getCurrentSha(params.repoPath),
        event_name: 'workflow_dispatch',
        event: { inputs: params.inputs }
      }
    };

    // 4. Execute with event streaming
    return this.runner.executeWorkflow(
      workflow,
      context,
      this.handleWorkflowEvent.bind(this)
    );
  }

  private handleWorkflowEvent(event: WorkflowEvent) {
    // Forward to renderer process via IPC
    this.sendEventToRenderer(event);
  }
}
```

### IPC Interface

```typescript
// Preload API
interface LocalWorkflowAPI {
  runWorkflow(params: {
    repoPath: string;
    workflowPath: string;
    repoId: string;
    inputs?: Record<string, any>;
  }): Promise<ExecutionResult>;

  onWorkflowEvent(callback: (event: WorkflowEvent) => void): () => void;

  validateWorkflow(
    repoPath: string,
    workflowPath: string
  ): Promise<ValidationResult>;

  getRequiredSecrets(
    repoPath: string,
    workflowPath: string
  ): Promise<string[]>;
}
```

### UI Integration

```typescript
// In RepositoryActionsPanel.tsx
const handleRunLocalWorkflow = async (action: ActWorkflowAction) => {
  // Validate secrets
  const requiredSecrets = await window.mainProcess.localWorkflow.getRequiredSecrets(
    repositoryPath,
    action.workflowPath
  );

  const validation = await window.mainProcess.localWorkflow.validateWorkflow(
    repositoryPath,
    action.workflowPath
  );

  if (!validation.valid) {
    alert(`Cannot run workflow: ${validation.errors.join(', ')}`);
    return;
  }

  // Listen for events
  const unsubscribe = window.mainProcess.localWorkflow.onWorkflowEvent((event) => {
    switch (event.type) {
      case 'step-output':
        appendOutput(event.line);
        break;
      case 'step-complete':
        updateStepStatus(event.stepName, event.success);
        break;
      // ... handle other events
    }
  });

  // Execute
  try {
    const result = await window.mainProcess.localWorkflow.runWorkflow({
      repoPath: repositoryPath,
      workflowPath: action.workflowPath,
      repoId: repositoryId,
    });

    if (result.success) {
      alert('Workflow completed successfully!');
    } else {
      alert(`Workflow failed: ${result.error}`);
    }
  } finally {
    unsubscribe();
  }
};
```

---

## Library Structure

```
local-workflow-runner/
├── src/
│   ├── index.ts                 # Main export
│   ├── runner.ts                # WorkflowRunner class
│   ├── parser.ts                # YAML parsing
│   ├── validator.ts             # Platform validation
│   ├── executor.ts              # Execution engine
│   ├── actions/                 # Built-in action handlers
│   │   ├── checkout.ts
│   │   ├── setup-node.ts
│   │   └── upload-artifact.ts
│   ├── platform.ts              # Platform detection
│   ├── context.ts               # Context building
│   ├── events.ts                # Event emitter
│   └── utils/
│       ├── shell.ts             # Shell command execution
│       ├── filesystem.ts        # File operations
│       └── git.ts               # Git operations
├── test/
│   ├── fixtures/                # Sample workflow files
│   └── *.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Dependencies

```json
{
  "dependencies": {
    "yaml": "^2.3.4",           // Parse YAML workflow files
    "execa": "^8.0.1",          // Execute shell commands
    "fs-extra": "^11.2.0",      // File system operations
    "glob": "^10.3.10",         // Pattern matching for artifacts
    "micromatch": "^4.0.5"      // Pattern matching for if conditions
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/fs-extra": "^11.0.4",
    "vitest": "^1.0.0",
    "typescript": "^5.3.3"
  }
}
```

---

## Security Considerations

1. **Secret Handling**
   - Secrets never logged or stored in output
   - Redacted in error messages
   - Cleared from memory after use

2. **Command Injection**
   - All shell commands sanitized
   - Environment variables properly escaped
   - No eval() or dynamic code execution

3. **File System Access**
   - Temporary directories isolated
   - Cleanup guaranteed (try/finally)
   - Respect .gitignore patterns

4. **Resource Limits**
   - Configurable timeouts
   - Memory limits for output capture
   - Maximum file size for artifacts

---

## Future Enhancements

1. **Matrix Builds**
   - Support for strategy.matrix
   - Parallel execution of matrix jobs

2. **Caching**
   - Cache node_modules between runs
   - Respect actions/cache patterns

3. **Conditional Execution**
   - Full expression evaluation for 'if' conditions
   - Context variable expansion

4. **Action Marketplace**
   - Download and execute third-party actions
   - Local action caching

5. **Multi-Platform**
   - Linux support
   - Windows support (with different shell handling)

6. **Advanced Features**
   - Composite actions
   - Reusable workflows
   - Service containers (if Docker available)

---

## Success Metrics

1. **Functionality**
   - ✅ Parse standard workflow syntax
   - ✅ Execute 90%+ of common workflow patterns
   - ✅ Handle macOS-specific code signing

2. **Performance**
   - < 1s parsing overhead
   - Minimal memory footprint
   - Efficient file copying (rsync-style)

3. **Developer Experience**
   - Clear error messages
   - Real-time progress feedback
   - Easy integration with existing apps

4. **Reliability**
   - Guaranteed cleanup
   - Graceful error handling
   - No resource leaks

---

## Example Usage

```typescript
import { WorkflowRunner } from 'local-workflow-runner';

const runner = new WorkflowRunner({
  timeout: 600000, // 10 minutes
  keepTempDirs: false
});

// Parse workflow
const workflow = await runner.parseWorkflow('.github/workflows/publish-mac.yml');

// Validate
const validation = runner.validateWorkflow(workflow, 'macos');
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  process.exit(1);
}

// Execute
const result = await runner.executeWorkflow(
  workflow,
  {
    repoPath: '/path/to/repo',
    repoName: 'my-app',
    workingDirectory: '/tmp/workflow-12345',
    runnerTemp: '/tmp/workflow-12345/runner',
    platform: 'macos',
    secrets: {
      APPLE_CERTIFICATE: '...',
      APPLE_CERTIFICATE_PASSWORD: '...'
    },
    env: process.env,
    github: {
      ref: 'refs/heads/main',
      sha: 'abc123',
      event_name: 'workflow_dispatch'
    }
  },
  (event) => {
    console.log('Event:', event);
  }
);

console.log('Success:', result.success);
console.log('Duration:', result.duration);
console.log('Artifacts:', result.artifacts);

await runner.cleanup();
```

---

## License

MIT (or match your app's license)

---

## Questions for Review

1. Should we support composite actions initially or defer to v2?
2. Do we need Windows support in v1, or macOS-only is acceptable?
3. Should secret redaction be configurable or always-on?
4. Do we want to support remote action downloads (e.g., `actions/checkout@v4` from GitHub)?
5. Should the library be framework-agnostic or optimized for Electron?

---

## Alternatives Considered

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| Fork `act` | Battle-tested, full-featured | Go language, Docker dependency, overcomplex | ❌ Rejected |
| Shell scripts | Simple, no dependencies | Hard to maintain, no programmatic control | ❌ Rejected |
| GitHub API | Official, reliable | Requires GitHub, costs runner minutes | ❌ Rejected |
| Custom library | Full control, native integration, maintainable | Initial development effort | ✅ **Selected** |
