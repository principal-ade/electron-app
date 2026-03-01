# Quality Panel Interaction System

## Overview

The Quality Panel displays code quality metrics (linting, tests, type checking, dead code) for repositories. It uses a hexagon visualization to show health scores across multiple quality dimensions and allows users to run quality tools and view detailed results.

## Problem Statement

Displaying code quality information involves several challenges:

1. **Data Sources**: Quality data can come from local tool execution OR GitHub Actions artifacts
2. **Tool Execution**: Running ESLint/Jest/TSC/Knip requires bridging from UI → Main → Worker → CLI tools
3. **State Management**: Quality data must flow through React context to multiple panels
4. **Color Modes**: Quality metrics can be visualized in File City using different color modes

## System Architecture

### Components

#### 1. Quality Panel UI (`@principal-ade/code-quality-panels`)
- **Purpose**: Renders the quality hexagon and metrics list
- **Component**: `QualityHexagonPanel` (ID: `principal-ade.quality-hexagon-panel`)
- **Events Emitted**: `quality:colorMode:select` when user clicks a hexagon facet
- **Props**: Receives `context`, `actions`, `events` from workspace framework

#### 2. Panel Icon Sidebar
- **Location**: `src/renderer/components/Sidebar/PanelIconSidebar.tsx`
- **Icon**: `CheckCircle` with label "Quality"
- **Panel ID**: `codeQuality`
- **Behavior**: Clicking toggles panel visibility or switches to quality panel

#### 3. DevWorkspace Panel Framework
- **Location**: `src/renderer/dev-workspace/DevWorkspacePanelFramework.tsx`
- **Role**: Mounts `CodeQualityPanelComponent` when `codeQuality` panel is active
- **Integration**: Passes context/actions/events to quality panel

#### 4. Repository Panel Context
- **Location**: `src/renderer/contexts/RepositoryPanelContext.tsx`
- **Quality Slice**: `DataSlice<QualitySliceData | null>` for quality metrics
- **State**: Tracks `qualityData`, `qualityLoading`, color mode selection
- **Events**: Listens for `quality:colorMode:select` to update File City visualization

#### 5. Quality Lens Service (Main Process)
- **Location**: `src/main/quality-lenses/QualityLensService.ts`
- **Purpose**: Executes quality tools through lens abstraction
- **Lenses**: ESLintLens, JestLens, TypeScriptLens, KnipLens, GitLens
- **Entry**: `executeTool(request: ToolExecutionRequest)`

#### 6. Electron CLI Bridge Executor
- **Location**: `src/main/quality-lenses/ElectronCLIBridgeExecutor.ts`
- **Purpose**: Bridges quality lenses with electron-cli-bridge infrastructure
- **Flow**: Lens → Executor → ElectronCLI → CLIBridge → child_process → External Tools

#### 7. IPC Handlers
- **Location**: `src/main/repository-monitoring/ipcHandlers.ts`
- **Channels**: `repository-monitoring:execute-tool`, `repository-monitoring:run-quality-enrichment`
- **Service**: Uses `QualityLensService.getInstance()` for tool execution

### Data Flow

```
User Clicks "Quality" Icon
    ↓
PanelIconSidebar.handlePanelClick('codeQuality')
    ↓
onPanelChange('codeQuality') callback
    ↓
DevWorkspacePanelFramework switches active panel
    ↓
CodeQualityPanelComponent renders
    ↓
Panel reads quality data from context
    ├→ Local: qualitySlice.data (from GitHub Actions artifacts)
    └→ On-demand: User runs tool via actions.executeTool()

Tool Execution Flow:
    ↓
actions.executeTool(request)
    ↓
IPC invoke: 'repository-monitoring:execute-tool'
    ↓
Main Process: QualityLensService.executeTool()
    ↓
Find appropriate Lens (ESLint/Jest/TSC/Knip/Git)
    ↓
Lens.configure() + Lens.run()
    ↓
ElectronCLIBridgeExecutor.execute()
    ↓
child_process spawns npm/eslint/jest/tsc
    ↓
Parse output → LensResult
    ↓
Return ToolExecutionResponse to renderer
    ↓
UI updates with results
```

## Key Interactions

### 1. Panel Navigation
User clicks Quality icon → Panel switches → Quality hexagon displays

### 2. Running Quality Tools
User clicks "Run Lint" → IPC to main → QualityLensService → ESLint executes → Results displayed

### 3. Color Mode Selection
User clicks hexagon facet → `quality:colorMode:select` event → RepositoryPanelContext updates → File City re-renders with new color mode

### 4. Fetching Quality Artifacts
Repository loads → Context fetches GitHub Actions artifacts → Quality metrics populate → Hexagon displays scores

## Quality Data Types

### QualitySliceData
```typescript
interface QualitySliceData {
  packages: Array<{
    path: string;
    metrics: QualityMetrics;
  }>;
  lastUpdated: number;
}
```

### ToolExecutionRequest
```typescript
interface ToolExecutionRequest {
  repoPath: string;
  packageLayer: PackageLayer;
  packageCommand: PackageCommand;
}
```

### ToolExecutionResponse
```typescript
interface ToolExecutionResponse {
  success: boolean;
  toolName: string;
  command: string;
  exitCode: number;
  duration: number;
  stdout: string;
  stderr: string;
  lensResult?: LensResult;
  qualityContext?: { lensId, operation, availableLenses, missingLenses };
}
```

## Lens Pipeline

Each quality lens follows a standard pipeline:

1. **Configure**: Set cwd, tool options, args
2. **Execute**: Run the CLI tool via ElectronCLIBridgeExecutor
3. **Parse**: Transform raw output to standardized issues/metrics
4. **Format**: Create LensResult with success, issues, metrics

### Available Lenses

| Lens | Tool | Aliases | Output |
|------|------|---------|--------|
| ESLintLens | eslint | lint | JSON issues |
| JestLens | jest | test | JSON test results |
| TypeScriptLens | tsc | typescript, typecheck | Text errors |
| KnipLens | knip | deadcode | JSON unused exports |
| GitLens | git | - | Text status |

## Error Handling

### Tool Not Available
- Lens checks `isAvailable()` before execution
- Falls back to non-lens execution if no lens found
- Returns error response with helpful message

### Execution Failure
- Captures stdout/stderr for debugging
- Sets `success: false` and appropriate `exitCode`
- UI displays error state with retry option

### Configuration Issues
- ts-node/ESLint config conflicts handled
- npm script vs direct execution differences managed
- Environment variables properly forwarded

## Performance

### Artifact Fetching
- Fetches from GitHub Actions on repository load
- Caches results in context state
- `lastUpdated` timestamp for staleness tracking

### Tool Execution
- Debounced for rapid interactions
- Progress indicators during long-running tools
- Results cached until next execution

## Telemetry Events

- `quality.panel.opened` - Panel becomes visible
- `quality.tool.executed` - Tool execution started
- `quality.tool.completed` - Tool execution finished
- `quality.colorMode.selected` - User selected color mode
- `quality.artifact.fetched` - GitHub artifacts loaded

## References

- **Architecture Doc**: `docs/quality-lens-architecture.md`
- **Implementation Doc**: `docs/quality-metrics-implementation.md`
- **Processing Doc**: `docs/quality-metrics-processing-architecture.md`
- **Panel Package**: `@principal-ade/code-quality-panels`
- **Lens Library**: `@principal-ai/codebase-quality-lenses`
