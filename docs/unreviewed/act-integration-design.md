# GitHub Actions Local Runner Integration Design
## Integration of nektos/act with UnifiedSecureStorage

### Executive Summary

This document outlines the design for integrating [nektos/act](https://github.com/nektos/act) with our Electron application's UnifiedSecureStorage system. This integration will allow users to run GitHub Actions workflows locally with automatic, secure injection of repository secrets from our encrypted storage.

### Key Benefits

1. **Secure Secret Management**: Secrets never leave the encrypted storage except temporarily during workflow execution
2. **Local Development**: Test GitHub Actions workflows locally without pushing to GitHub
3. **Cost Savings**: Reduce GitHub Actions minutes usage
4. **Faster Iteration**: Immediate feedback on workflow changes
5. **Offline Capability**: Run workflows without internet connectivity

---

## Architecture Overview

```mermaid
graph TB
    subgraph "Electron App"
        UI[UI Components]
        IPC[IPC Handler Layer]

        subgraph "Main Process"
            ARS[ActRunnerService]
            USS[UnifiedSecureStorage]
            SM[Secrets Manager]
            TF[Temp File Manager]
        end

        subgraph "Renderer Process"
            WE[Workflow Explorer]
            WM[Workflow Monitor]
            RE[Results Explorer]
        end
    end

    subgraph "External"
        ACT[nektos/act Binary]
        Docker[Docker/Podman]
        FS[File System]
    end

    UI --> IPC
    IPC --> ARS
    ARS --> USS
    ARS --> SM
    SM --> TF
    ARS --> ACT
    ACT --> Docker
    TF --> FS

    WE --> IPC
    WM --> IPC
    RE --> IPC

    style USS fill:#f9f,stroke:#333,stroke-width:4px
    style ARS fill:#bbf,stroke:#333,stroke-width:4px
```

---

## UI Integration Plan (Phase 1)

The first UI milestone focuses on surfacing workflow actions inside the Repository Explorer without wiring them to the main-process runner yet. The key goals are to make the UI contract explicit and to verify that repositories have the required secrets before a run attempt.

### Data Retrieval Strategy

1. **Source of truth** – Workflow definitions (and their action entries) will be read through a forthcoming `ActWorkflowService`. In this phase, the UI expects an `actions` collection supplied by the parent `RepositoryDetailsPanel`.
2. **Repository context** – Each action is scoped by the repository that owns the workflow. The UI only needs the `repoId` (Alexandria ID) to evaluate prerequisites such as secret availability.
3. **Secrets status** – The renderer calls `SecretsService.exists(repoId)` via a dedicated hook (`useRepositorySecretsStatus`) to decide whether the "Configure" or "Run" affordance should be displayed. This keeps secret verification centralized and testable.
4. **Future wiring** – When the execution service is ready, the panel will request data through a `RepositoryActionsProvider` context that combines workflow metadata, execution status, and telemetry.

### RepositoryActionsPanel Responsibilities

- Display the list of available repository actions (name, description, and optional metadata such as estimated duration).
- Show a call-to-action:
  - "Configure" when secrets are missing. Clicking it opens the existing `SecretsModal` for the repository.
  - "Run" when secrets are configured. For now this opens a confirmation dialog; later it will dispatch an IPC request to `ActRunnerService`.
- Surface loading and error states for the secrets check.
- Provide a refresh affordance so users can re-check the secrets status after closing the modal.

### File Layout for UI Panel

```
src/
└── renderer/
    └── principal-window/
        └── views/
            └── RepositoryExplorer/
                ├── components/
                │   ├── RepositoryActionsPanel.tsx  # New UI panel (Phase 1)
                │   └── RepositoryDetailsPanel.tsx  # Imports panel in Phase 2
                └── hooks/
                    └── useRepositorySecretsStatus.ts  # Secrets verification hook
```

The panel remains self-contained until the execution plumbing is available. Once the runner APIs land, only the `onRun` handler wiring in `RepositoryDetailsPanel` needs to change.

---

## Component Design

### 1. ActRunnerService (Main Process)

The core service managing act execution and secret injection.

```mermaid
classDiagram
    class ActRunnerService {
        -storage: UnifiedSecureStorage
        -runningProcesses: Map~string, ChildProcess~
        -tempSecretFiles: Map~string, string~
        -actBinaryPath: string
        +runWorkflow(repoPath, repoId, options): Promise~Result~
        +stopWorkflow(executionId): Promise~void~
        +listWorkflows(repoPath): Promise~string[]~
        +validateInstallation(): Promise~boolean~
        -createSecretsFile(repoId): Promise~string~
        -cleanupSecretsFile(repoId): Promise~void~
        -buildActArgs(options, secretsFile): string[]
    }

    class UnifiedSecureStorage {
        +getSecrets(repoId): Promise~Record~
        +storeSecrets(repoId, path, secrets): Promise~Result~
        +deleteSecrets(repoId): Promise~void~
    }

    class TempFileManager {
        +createSecureFile(content): Promise~string~
        +cleanupFile(path): Promise~void~
        +setPermissions(path, mode): Promise~void~
    }

    ActRunnerService --> UnifiedSecureStorage
    ActRunnerService --> TempFileManager
```

### 2. IPC Communication Layer

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant IPC as IPC Handler
    participant ARS as ActRunnerService
    participant USS as UnifiedSecureStorage
    participant ACT as act Binary

    UI->>IPC: runWorkflow(repoId, options)
    IPC->>ARS: execute workflow
    ARS->>USS: getSecrets(repoId)
    USS-->>ARS: encrypted secrets
    ARS->>ARS: createTempSecretsFile()
    ARS->>ACT: spawn with --secret-file
    ACT-->>ARS: output stream
    ARS-->>IPC: progress events
    IPC-->>UI: update UI
    ACT-->>ARS: completion
    ARS->>ARS: cleanupTempFiles()
    ARS-->>IPC: result
    IPC-->>UI: final result
```

---

## Security Model

### Secret Handling Flow

```mermaid
graph LR
    subgraph Encrypted["Encrypted Storage"]
        ES[UnifiedSecureStorage]
    end

    subgraph Memory["Memory"]
        DEC[Decrypted Secrets]
    end

    subgraph TempFile["Temp File"]
        TF["act-secrets-*.env"]
    end

    subgraph ActProc["act Process"]
        ENV[Environment Variables]
    end

    ES -->|Decrypt in Memory| DEC
    DEC -->|Write with 0600| TF
    TF -->|Read by act| ENV
    ENV -->|Inject to Container| Container[Workflow Container]

    TF -.->|Auto-cleanup| X[Deleted]

    style ES fill:#0f0,stroke:#333,stroke-width:2px
    style TF fill:#ff0,stroke:#333,stroke-width:2px
    style X fill:#f00,stroke:#333,stroke-width:2px
```

### Security Measures

1. **Temporary File Security**
   - Files created with mode `0600` (owner read/write only)
   - Stored in OS temp directory with restricted access
   - Unique filenames with timestamp and random suffix
   - Automatic cleanup after workflow completion

2. **Process Isolation**
   - Secrets only available to act process
   - No secrets logged to console (unless `--insecure-secrets` flag)
   - Process environment isolation

3. **Memory Protection**
   - Secrets decrypted only when needed
   - Cleared from memory after use
   - No persistent caching of decrypted values

---

## Data Flow Diagrams

### Workflow Execution Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Validating: User triggers workflow
    Validating --> LoadingSecrets: Workflow valid
    Validating --> Error: Invalid workflow
    LoadingSecrets --> CreatingTempFile: Secrets retrieved
    LoadingSecrets --> RunningWithoutSecrets: No secrets found
    CreatingTempFile --> RunningWithSecrets: Temp file created
    RunningWithSecrets --> Monitoring: act process started
    RunningWithoutSecrets --> Monitoring: act process started
    Monitoring --> Monitoring: Streaming output
    Monitoring --> Cleanup: Workflow complete
    Cleanup --> Complete: Files cleaned
    Complete --> [*]
    Error --> [*]
```

### Event Streaming

```mermaid
graph TD
    subgraph "act Process"
        STDOUT[stdout stream]
        STDERR[stderr stream]
    end

    subgraph "ActRunnerService"
        OP[Output Parser]
        EE[Event Emitter]
    end

    subgraph "IPC Events"
        START[workflow:start]
        PROG[workflow:progress]
        STEP[workflow:step]
        ERR[workflow:error]
        DONE[workflow:complete]
    end

    subgraph "UI Updates"
        LOG[Log Display]
        STEPS[Step Status]
        RESULTS[Results Panel]
    end

    STDOUT --> OP
    STDERR --> OP
    OP --> EE
    EE --> START
    EE --> PROG
    EE --> STEP
    EE --> ERR
    EE --> DONE

    START --> LOG
    PROG --> LOG
    STEP --> STEPS
    ERR --> LOG
    DONE --> RESULTS
```

---

## API Design

### Main Process API

```typescript
interface ActRunnerAPI {
  // Core Operations
  runWorkflow(request: WorkflowRequest): Promise<WorkflowResult>;
  stopWorkflow(executionId: string): Promise<void>;
  listWorkflows(repoPath: string): Promise<WorkflowInfo[]>;

  // Secret Management
  validateSecrets(repoId: string): Promise<SecretValidation>;

  // Installation
  checkActInstallation(): Promise<InstallationStatus>;
  installAct(options?: InstallOptions): Promise<void>;
}

interface WorkflowRequest {
  repoId: string;
  repoPath: string;
  workflowFile?: string;
  options?: ActRunOptions;
  streamOutput?: boolean;
}

interface WorkflowResult {
  executionId: string;
  success: boolean;
  exitCode: number;
  duration: number;
  output?: string;
  artifacts?: ArtifactInfo[];
  steps?: StepResult[];
}
```

### IPC Events

```typescript
enum ActRunnerEvents {
  // Commands
  RUN_WORKFLOW = 'act:run-workflow',
  STOP_WORKFLOW = 'act:stop-workflow',
  LIST_WORKFLOWS = 'act:list-workflows',

  // Events
  WORKFLOW_START = 'act:workflow-start',
  WORKFLOW_OUTPUT = 'act:workflow-output',
  WORKFLOW_STEP = 'act:workflow-step',
  WORKFLOW_ERROR = 'act:workflow-error',
  WORKFLOW_COMPLETE = 'act:workflow-complete',
}
```

---

## UI Components Design

### Workflow Runner Interface

```mermaid
graph TD
    subgraph "Workflow Runner Panel"
        subgraph "Header"
            WS[Workflow Selector]
            RB[Run Button]
            SB[Stop Button]
            OPT[Options Toggle]
        end

        subgraph "Options Panel"
            ENV[Environment Selector]
            PLAT[Platform Selector]
            FLAGS[Execution Flags]
            MATRIX[Matrix Configuration]
        end

        subgraph "Execution View"
            subgraph "Split View"
                STEPS[Step Progress]
                LOGS[Log Output]
            end

            subgraph "Footer"
                STATUS[Status Bar]
                TIMER[Execution Timer]
                ARTIFACTS[Artifacts Link]
            end
        end
    end

    WS --> RB
    RB --> STEPS
    RB --> LOGS
    STEPS --> STATUS
    LOGS --> STATUS
```

---

## Implementation Phases

### Phase 1: Core Integration (Week 1-2)

```mermaid
gantt
    title Phase 1: Core Integration
    dateFormat  YYYY-MM-DD
    section Backend
    ActRunnerService implementation     :a1, 2024-01-15, 3d
    Secret injection mechanism          :a2, after a1, 2d
    IPC handlers                       :a3, after a2, 2d
    section Testing
    Unit tests                         :t1, after a2, 2d
    Integration tests                  :t2, after a3, 1d
```

**Deliverables:**
- ✅ ActRunnerService class
- ✅ Secure secret file creation/cleanup
- ✅ IPC communication layer
- ✅ Basic workflow execution

### Phase 2: UI Components (Week 2-3)

```mermaid
gantt
    title Phase 2: UI Components
    dateFormat  YYYY-MM-DD
    section Frontend
    Workflow selector component         :b1, 2024-01-22, 2d
    Execution monitor component        :b2, after b1, 3d
    Results viewer                     :b3, after b2, 2d
    section Integration
    Connect to IPC                     :i1, after b1, 2d
    Real-time updates                  :i2, after i1, 1d
```

**Deliverables:**
- ✅ Workflow runner UI
- ✅ Real-time log streaming
- ✅ Step progress visualization
- ✅ Results and artifacts display

### Phase 3: Advanced Features (Week 3-4)

```mermaid
gantt
    title Phase 3: Advanced Features
    dateFormat  YYYY-MM-DD
    section Features
    Matrix job support                 :c1, 2024-01-29, 2d
    Artifact management                :c2, after c1, 2d
    Workflow debugging                 :c3, after c2, 2d
    section Polish
    Error handling                     :p1, after c1, 2d
    Performance optimization           :p2, after p1, 1d
```

**Deliverables:**
- ✅ Matrix strategy support
- ✅ Artifact collection and viewing
- ✅ Debug mode with verbose output
- ✅ Comprehensive error handling

---

## Technical Considerations

### 1. Act Binary Management

```mermaid
graph TD
    START[Check act installation]
    START --> CHECK{act found?}
    CHECK -->|Yes| VERSION[Check version]
    CHECK -->|No| PROMPT[Prompt user to install]
    VERSION --> COMPAT{Compatible?}
    COMPAT -->|Yes| READY[Ready to use]
    COMPAT -->|No| UPDATE[Suggest update]
    PROMPT --> INSTALL[Download and install]
    INSTALL --> READY
    UPDATE --> READY
```

### 2. Docker/Podman Detection

```typescript
async function detectContainerRuntime(): Promise<ContainerRuntime> {
  // Check Docker
  if (await commandExists('docker')) {
    const dockerInfo = await getDockerInfo();
    if (dockerInfo.running) {
      return { type: 'docker', socket: dockerInfo.socket };
    }
  }

  // Check Podman
  if (await commandExists('podman')) {
    return { type: 'podman', socket: 'podman' };
  }

  throw new Error('No container runtime found');
}
```

### 3. Repository Detection

```typescript
interface RepoContext {
  id: string;
  path: string;
  hasWorkflows: boolean;
  workflowCount: number;
  hasSecrets: boolean;
  secretCount: number;
  defaultBranch: string;
}

async function getRepoContext(path: string): Promise<RepoContext> {
  // Implementation details
}
```

---

## Error Handling Strategy

```mermaid
graph TD
    subgraph "Error Types"
        E1[Installation Errors]
        E2[Secret Access Errors]
        E3[Workflow Errors]
        E4[Container Errors]
        E5[Permission Errors]
    end

    subgraph "Handlers"
        H1[Check & Install act]
        H2[Fallback to empty secrets]
        H3[Parse & display act errors]
        H4[Suggest Docker/Podman fix]
        H5[Request elevation/fix perms]
    end

    subgraph "User Feedback"
        UI1[Installation wizard]
        UI2[Secret status indicator]
        UI3[Error log panel]
        UI4[Setup guide link]
        UI5[Permission dialog]
    end

    E1 --> H1 --> UI1
    E2 --> H2 --> UI2
    E3 --> H3 --> UI3
    E4 --> H4 --> UI4
    E5 --> H5 --> UI5
```

---

## Performance Considerations

1. **Secret File Creation**: < 50ms for typical secret sets
2. **Workflow Startup**: Dependent on act and Docker (typically 2-5s)
3. **Log Streaming**: Real-time with < 100ms latency
4. **Memory Usage**: Minimal overhead (~10MB for service)
5. **Cleanup**: Automatic within 100ms of completion

---

## Security Audit Points

| Component | Security Measure | Risk Level | Mitigation |
|-----------|-----------------|------------|------------|
| Secret Files | Mode 0600, temp directory | Medium | Auto-cleanup, unique names |
| Process Spawn | Controlled arguments | Low | Input validation, escaping |
| IPC Communication | Renderer validation | Medium | Source verification |
| Log Output | Secret masking | High | Never log with insecure flag |
| File Cleanup | Guaranteed deletion | Medium | Finally blocks, process hooks |

---

## Testing Strategy

### Unit Tests

```mermaid
graph LR
    subgraph "Test Coverage"
        T1[Secret file creation]
        T2[Argument building]
        T3[Output parsing]
        T4[Event emission]
        T5[Cleanup logic]
    end

    subgraph "Mock Dependencies"
        M1[UnifiedSecureStorage]
        M2[Child Process]
        M3[File System]
        M4[IPC]
    end

    T1 --> M1
    T1 --> M3
    T2 --> M1
    T3 --> M2
    T4 --> M4
    T5 --> M3
```

### Integration Tests

1. **End-to-end workflow execution**
2. **Secret injection verification**
3. **Error recovery scenarios**
4. **Concurrent execution handling**
5. **Resource cleanup validation**

---

## Rollout Plan

1. **Alpha Testing** (Internal team)
   - Basic workflow execution
   - Secret injection verification
   - Error handling validation

2. **Beta Testing** (Selected users)
   - Complex workflows
   - Matrix jobs
   - Performance testing

3. **General Availability**
   - Full feature set
   - Documentation
   - Support materials

---

## Success Metrics

- **Functionality**: 100% of GitHub Actions features supported by act
- **Security**: Zero secret leaks, 100% cleanup rate
- **Performance**: < 5% overhead vs direct act usage
- **Reliability**: > 99% success rate for valid workflows
- **User Experience**: < 3 clicks to run any workflow

---

## Appendix: Configuration Examples

### Sample Workflow Request

```typescript
const request: WorkflowRequest = {
  repoId: 'repo-123',
  repoPath: '/Users/dev/my-project',
  workflowFile: '.github/workflows/test.yml',
  options: {
    platform: 'ubuntu-latest=node:16',
    eventName: 'push',
    defaultBranch: 'main',
    verbose: true,
    reuse: true
  },
  streamOutput: true
};
```

### Secret File Format (Temporary)

```env
# Generated: 2024-01-15T10:30:00Z
# Repository: repo-123
# Auto-cleanup: true

GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
NPM_TOKEN="npm_xxxxxxxxxxxx"
AWS_ACCESS_KEY_ID="AKIAXXXXXXXXXXXX"
AWS_SECRET_ACCESS_KEY="xxxxxxxxxxxx"
DATABASE_URL="postgresql://user:pass@host/db"
```

---

## References

- [nektos/act GitHub Repository](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Electron Security Best Practices](https://www.electronjs.org/docs/tutorial/security)
- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html)