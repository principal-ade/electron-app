# Quality Lens Integration Refactor

## 🎉 Progress Update (2025-10-12)

### ✅ Phase 1 Completed

**Status**: Quality metrics data is confirmed to be populated by the composition package!

**What We Accomplished:**

1. **Created QualityHexagonPanel Component** (`src/renderer/panels/components/QualityHexagonPanel.tsx`)
   - Renders quality hexagon visualization using `QualityHexagonDetailed`/`QualityHexagonCompact` from `@principal-ai/agent-monitoring-ui`
   - Displays available lenses (5) and missing lenses (1)
   - Shows package information (dependencies, scripts, etc.)
   - Properly themed and TypeScript type-safe

2. **Integrated into Panel System**
   - Registered in `src/renderer/panels/registry.tsx` as `packageInfo` panel
   - Added to Repository Explorer (`RepositoryDetailsPanel.tsx`)
   - Added to Repository Manager (`RepositoryWorkspace.tsx`)
   - Visible in PanelConfigurator modal for workspace configuration

3. **Verified Data Flow** ✅
   - Console logs confirm `PackageLayer.qualityMetrics` is populated:
     ```json
     {
       "hexagon": { "tests": 85, "linting": 90, ... },
       "availableLenses": ["eslint", "jest", "typescript", "prettier", "knip"],
       "missingLenses": ["deadcode"]
     }
     ```
   - `PackageCommand` objects include `isLensCommand`, `lensId`, and `lensOperation` fields
   - Config files are detected correctly

4. **UI Integration Complete**
   - Users can now see quality hexagon for all packages in a repository
   - Available/missing lenses displayed with color coding (green/warning)
   - Panel available in both Repository Explorer and Repository Manager workspaces

### 📝 Answers to Phase 1 Questions

1. ✅ **Does `PackageLayerModule.discoverPackages()` populate `qualityMetrics`?**
   - YES - Verified in console logs

2. ✅ **Are `PackageCommand` objects annotated with `isLensCommand` and `lensId`?**
   - YES - Composition package annotates commands correctly

3. ✅ **Do the detected lenses match what we expect?**
   - YES - eslint, jest, typescript, prettier, knip detected

4. ✅ **Are config files detected correctly?**
   - YES - eslint.config.mjs, tsconfig.json, package.json inlines, etc.

5. ✅ **Do the hexagon scores make sense?**
   - YES - Scores calculated based on config presence and command availability

### ✅ Phase 2 Completed (2025-10-12)

**Status**: QualityLensService refactored to use PackageLayer data!

**What We Accomplished:**

1. **Updated Interfaces** (`src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts`)
   - Added `packageLayer` and `packageCommand` fields to `ToolExecutionRequest`
   - Marked legacy fields (`toolName`, `command`, `args`) as deprecated
   - Added `QualityContext` interface for quality metrics in responses
   - Added `qualityContext` field to `ToolExecutionResponse`

2. **Refactored QualityLensService** (`src/main/quality-lenses/QualityLensService.ts`)
   - Created `executeWithPackageLayer()` - new execution path using composition data
   - Uses `packageCommand.lensId` to select lens (no parsing needed!)
   - Includes quality context in responses (`availableLenses`, `missingLenses`)
   - Kept `executeLegacy()` for backwards compatibility
   - Added helper methods:
     - `parseCommandString()` - simplified command parsing
     - `determineLensSuccess()` - extract success determination logic
     - `createErrorResponse()` - consistent error responses
     - `executeNonLensCommand()` - handle non-lens commands

3. **Updated ToolsPanel** (`src/renderer/panels/components/ToolsPanel.tsx`)
   - Now uses new `PackageLayer`-based execution path
   - Passes full `PackageCommand` object instead of strings
   - Logs quality context when available
   - Falls back to legacy execution if PackageLayer not found

4. **Marked Legacy Methods as Deprecated**
   - `findLensForTool()` - use `packageCommand.lensId` instead
   - `parseCommand()` - use `parseCommandString()` instead
   - `parseArgs()` - use `parseCommandString()` instead
   - `executeDirectly()` - use `executeNonLensCommand()` instead

**Benefits Achieved:**
- ✅ No more manual command parsing in the new path
- ✅ Lens selection by ID from composition package
- ✅ Quality metrics context included in responses
- ✅ Backwards compatibility maintained for existing callers
- ✅ ToolsPanel demonstrates the new execution path

**What's Different:**

Before (Legacy):
```typescript
const request: ToolExecutionRequest = {
  repoPath: '/path/to/repo',
  packagePath: '',
  toolName: 'eslint',
  command: 'npm run lint',
};
```

After (New):
```typescript
const request: ToolExecutionRequest = {
  repoPath: '/path/to/repo',
  packageLayer: packageLayer,      // Full package context
  packageCommand: packageCommand,   // Has lensId, operation, etc.
};
```

### 🎯 Next: Phase 3

Now that QualityLensService uses composition data, we can enhance the UI to show quality metrics and lens information.

---

## Executive Summary

The application currently has **duplicate and disconnected tool detection/execution systems**. The `@principal-ai/codebase-composition` package (v0.2.7) already provides quality metrics detection and lens command identification, but `QualityLensService` is manually parsing command strings instead of using this built-in functionality.

**Impact**: Manual parsing is fragile, error-prone, and duplicates work already done by the composition package.

**Solution**: Refactor to use the composition package's built-in quality metrics and lens detection capabilities.

---

## Problem Statement

### Current Architecture (Broken)

```
PackageProcessor
  ↓
PackageLayerModule.discoverPackages()
  ↓
PackageLayer (✅ contains qualityMetrics + lens metadata)
  ↓
❌ DATA IGNORED - thrown away
  ↓
QualityLensService receives raw command strings
  ↓
parseCommand("npm run lint") ← Manual brittle parsing!
  ↓
Quality Lenses execute
```

### What's Wrong

1. **`PackageLayer.qualityMetrics` is ignored** - The composition package detects lenses, but we don't use the data
2. **`PackageCommand.isLensCommand` is ignored** - Commands are already annotated with lens metadata
3. **Manual command parsing** - `QualityLensService.parseCommand()` reinvents the wheel
4. **`PackageLayerToToolConfigBridge` is obsolete** - Attempted to bridge a gap that doesn't exist
5. **No automatic lens discovery** - We don't know what tools are available without executing them

### Files Involved

**Currently NOT using composition data:**
- `src/main/quality-lenses/QualityLensService.ts:402-435` - Manual parsing
- `src/main/quality-lenses/PackageLayerToToolConfigBridge.ts` - Experimental/unused bridge

**Composition package integration:**
- `src/repository-monitoring-server/PackageProcessor.ts` - Gets PackageLayer data
- `src/repository-monitoring-server/RepositoryMonitoringServer.ts` - Caches package data

---

## What codebase-composition Already Provides

### 1. PackageLayer with Quality Metrics

```typescript
interface PackageLayer {
  packageData: {
    name: string;
    path: string;
    availableCommands?: PackageCommand[];  // Commands with lens metadata!
    // ... other fields
  };

  // ✅ BUILT-IN QUALITY DETECTION
  qualityMetrics?: {
    hexagon: Partial<QualityMetrics>;    // Computed scores (0-100)
    availableLenses: string[];           // ["eslint", "jest", "typescript", ...]
    missingLenses?: string[];            // ["knip", "prettier", ...]
  };

  // ✅ DETECTED CONFIG FILES
  configFiles?: {
    eslint?: ConfigFile;
    jest?: ConfigFile;
    typescript?: ConfigFile;
    prettier?: ConfigFile;
    knip?: ConfigFile;
    // ... many more
  };
}
```

### 2. PackageCommand with Lens Metadata

```typescript
interface PackageCommand {
  name: string;                    // "lint", "test", "typecheck"
  command: string;                 // "eslint . --ext .ts,.tsx"

  // ✅ LENS IDENTIFICATION
  isLensCommand?: boolean;         // true if this is a quality lens
  lensId?: string;                 // "eslint", "jest", "typescript"
  lensOperation?: LensOperation;   // "check" | "fix" | "coverage" | "watch"

  description?: string;
  type?: 'script' | 'standard';
  workingDirectory?: string;
}
```

### 3. QualityMetricsCalculator

```typescript
class QualityMetricsCalculator {
  // Detect which scripts are lens commands
  static detectLensCommands(commands: PackageCommand[]): Map<string, DetectedLens>

  // Calculate hexagon metrics from detected lenses
  static calculateMetrics(detectedLenses: Map<...>): Partial<QualityMetrics>

  // Get available/missing lenses
  static getAvailableLenses(detectedLenses: Map<...>): string[]
  static getMissingLenses(detectedLenses: Map<...>): string[]

  // All-in-one convenience method
  static calculateQualityProfile(commands: PackageCommand[]): {
    hexagon: Partial<QualityMetrics>;
    availableLenses: string[];
    missingLenses: string[];
  }
}
```

### 4. Helper Functions

```typescript
// Extract quality metrics from PackageLayer
toQualityMetrics(packageLayer: PackageLayer): QualityMetrics | null

// Check if package has metrics
hasQualityMetrics(packageLayer: PackageLayer): boolean

// Get available/missing lenses
getAvailableLenses(packageLayer: PackageLayer): string[]
getMissingLenses(packageLayer: PackageLayer): string[]

// Calculate overall score
getOverallQualityScore(packageLayer: PackageLayer): number

// Generate recommendations
generateLensRecommendations(packageLayer: PackageLayer): string[]
```

---

## Proposed Architecture (Fixed)

```
PackageProcessor
  ↓
PackageLayerModule.discoverPackages()
  ↓
PackageLayer (with qualityMetrics populated)
  ↓
✅ Use packageLayer.qualityMetrics.availableLenses
  ↓
FOR EACH command WHERE isLensCommand === true:
  ↓
QualityLensService.executeCommand({
  packageLayer,              // Full context
  command: PackageCommand,   // Has lensId, operation metadata
})
  ↓
Lens selected based on command.lensId
  ↓
Quality Lenses execute with proper configuration
```

### Key Changes

1. **Pass `PackageLayer` to `QualityLensService`** - Instead of raw command strings
2. **Use `command.lensId` to select lens** - Instead of parsing command strings
3. **Use `command.command` as-is** - The composition package already validated it
4. **Expose quality metrics in UI** - Show `availableLenses` and `missingLenses`

---

## Implementation Plan

### Phase 1: Verify PackageLayer Population (Week 1)

**Goal**: Confirm that `PackageLayerModule` is populating quality metrics fields

#### Tasks

1. **Add logging to PackageProcessor**
   ```typescript
   // src/repository-monitoring-server/PackageProcessor.ts
   async extractPackages(fileTree: FileTree, repoPath: string): Promise<PackageLayer[]> {
     const packages = await this.packageModule.discoverPackages(fileTree, fileReader);

     // ADD THIS LOGGING
     packages.forEach(pkg => {
       console.log('Package:', pkg.packageData.name);
       console.log('Quality Metrics:', pkg.qualityMetrics);
       console.log('Commands:', pkg.packageData.availableCommands?.map(cmd => ({
         name: cmd.name,
         isLensCommand: cmd.isLensCommand,
         lensId: cmd.lensId,
         lensOperation: cmd.lensOperation
       })));
       console.log('Config Files:', Object.keys(pkg.configFiles || {}));
     });

     return packages;
   }
   ```

2. **Run on test repository**
   - Use Repository Manager to trigger package analysis
   - Check console output for quality metrics data
   - Document what fields are populated vs empty

3. **Verify composition package version**
   - Ensure `@principal-ai/codebase-composition` is at least v0.2.7
   - Check if module needs initialization options

**Expected Output:**
```json
{
  "qualityMetrics": {
    "hexagon": {
      "linting": 85,
      "tests": 70,
      "types": 90,
      "formatting": 80,
      "deadCode": 60,
      "documentation": 40
    },
    "availableLenses": ["eslint", "jest", "typescript", "prettier"],
    "missingLenses": ["knip"]
  }
}
```

**Decision Point**:
- ✅ If fields are populated → Proceed to Phase 2
- ❌ If fields are empty → Investigate composition package configuration

---

### Phase 2: Refactor QualityLensService (Week 2)

**Goal**: Make QualityLensService use PackageLayer data instead of manual parsing

#### 2.1 Update ToolExecutionRequest Interface

```typescript
// src/shared/main-process-api-interfaces/RepositoryMonitoringAPI.ts

export interface ToolExecutionRequest {
  repoPath: string;
  packagePath?: string;

  // NEW: Pass full package context
  packageLayer: PackageLayer;

  // NEW: Pass command with metadata
  packageCommand: PackageCommand;

  // DEPRECATED: Remove manual string fields (keep for backwards compat initially)
  toolName?: string;        // deprecated
  command?: string;         // deprecated
  args?: string[];          // deprecated
}
```

#### 2.2 Update QualityLensService.executeTool()

```typescript
// src/main/quality-lenses/QualityLensService.ts

export class QualityLensService {
  /**
   * Execute a quality tool using PackageCommand metadata
   */
  public async executeTool(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResponse> {
    const { packageLayer, packageCommand, repoPath } = request;
    const startTime = Date.now();

    // Validate that this is a lens command
    if (!packageCommand.isLensCommand || !packageCommand.lensId) {
      return this.executeNonLensCommand(request, startTime);
    }

    // Determine working directory
    const cwd = path.join(repoPath, packageLayer.packageData.path);

    // Find lens by ID (no parsing needed!)
    const lens = this.lenses.get(packageCommand.lensId);

    if (!lens) {
      console.warn(
        `[QualityLensService] No lens registered for: ${packageCommand.lensId}`
      );
      return this.executeDirectly(request, cwd, startTime);
    }

    console.log(
      `[QualityLensService] Using ${lens.name} for command: ${packageCommand.name}`
    );

    try {
      // Parse command string (now we know it's valid from composition package)
      const { command, args } = this.parseCommandString(packageCommand.command);

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

        // NEW: Include quality metrics context
        qualityContext: {
          lensId: packageCommand.lensId,
          operation: packageCommand.lensOperation,
          availableLenses: packageLayer.qualityMetrics?.availableLenses,
        },
      };
    } catch (error: any) {
      console.error(`[QualityLensService] Error:`, error);
      return this.createErrorResponse(request, error, startTime);
    }
  }

  /**
   * Parse command string into command + args
   * Simplified since composition package already validated it
   */
  private parseCommandString(commandString: string): { command: string; args: string[] } {
    // Handle npm/yarn/pnpm run scripts
    if (commandString.startsWith('npm run ')) {
      return { command: 'npm', args: ['run', ...commandString.split(' ').slice(2)] };
    }
    if (commandString.startsWith('yarn ')) {
      return { command: 'yarn', args: commandString.split(' ').slice(1) };
    }
    if (commandString.startsWith('pnpm ')) {
      return { command: 'pnpm', args: commandString.split(' ').slice(1) };
    }

    // Direct command
    const parts = commandString.split(' ');
    return { command: parts[0], args: parts.slice(1) };
  }

  /**
   * Remove old parsing methods (mark as deprecated)
   */
  // @deprecated - Use parseCommandString instead
  // private parseCommand() { ... }

  // @deprecated - Use parseCommandString instead
  // private parseArgs() { ... }
}
```

#### 2.3 Update Callers

```typescript
// src/main/repository-monitoring/ipcHandlers.ts

ipcMain.handle(
  RepositoryMonitoringAPIEvent.EXECUTE_TOOL,
  async (event, request: ToolExecutionRequest) => {
    // OLD WAY (deprecated):
    // return qualityLensService.executeTool({
    //   repoPath,
    //   toolName: 'eslint',
    //   command: 'npm run lint'
    // });

    // NEW WAY:
    const packages = await repositoryMonitoringServer.getPackages(request.repoPath);
    const packageLayer = findPackageByPath(packages, request.packagePath);
    const command = findCommandByName(packageLayer, request.commandName);

    return qualityLensService.executeTool({
      repoPath: request.repoPath,
      packageLayer,
      packageCommand: command
    });
  }
);
```

---

### Phase 3: Expose Quality Metrics in UI (Week 3)

**Goal**: Show users what lenses are available/missing

#### 3.1 Add Quality Metrics to Tools Panel

```typescript
// src/renderer/panels/components/ToolsPanel.tsx

export function ToolsPanel({ directory }: { directory: string }) {
  const [packages, setPackages] = useState<PackageLayer[]>([]);

  useEffect(() => {
    RepositoryMonitoringService.getPackages(directory).then(result => {
      if (result) setPackages(result.packages);
    });
  }, [directory]);

  return (
    <div>
      {packages.map(pkg => (
        <PackageQualitySection key={pkg.id} packageLayer={pkg} />
      ))}
    </div>
  );
}

function PackageQualitySection({ packageLayer }: { packageLayer: PackageLayer }) {
  const metrics = packageLayer.qualityMetrics;

  if (!metrics) {
    return <div>No quality metrics available</div>;
  }

  return (
    <section>
      <h3>{packageLayer.packageData.name}</h3>

      {/* Show available lenses */}
      <div>
        <h4>Available Lenses ({metrics.availableLenses.length})</h4>
        <div className="lens-badges">
          {metrics.availableLenses.map(lens => (
            <Badge key={lens} variant="success">
              {lens}
            </Badge>
          ))}
        </div>
      </div>

      {/* Show missing lenses */}
      {metrics.missingLenses && metrics.missingLenses.length > 0 && (
        <div>
          <h4>Missing Lenses</h4>
          <div className="lens-badges">
            {metrics.missingLenses.map(lens => (
              <Badge key={lens} variant="warning">
                {lens} (add to improve quality)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Show quality hexagon */}
      {metrics.hexagon && (
        <QualityHexagon metrics={metrics.hexagon} size="sm" />
      )}

      {/* Show lens commands */}
      <div>
        <h4>Quality Commands</h4>
        {packageLayer.packageData.availableCommands
          ?.filter(cmd => cmd.isLensCommand)
          .map(cmd => (
            <CommandButton
              key={cmd.name}
              command={cmd}
              packageLayer={packageLayer}
            />
          ))}
      </div>
    </section>
  );
}
```

#### 3.2 Add Quality Status to Repository Manager Header

```typescript
// src/renderer/repo-manager/RepositoryManagerHeader.tsx

export function RepositoryManagerHeader({ directory }: Props) {
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  useEffect(() => {
    RepositoryMonitoringService.getPackages(directory).then(result => {
      if (result?.packages.length > 0) {
        const rootPkg = result.packages[0];
        if (rootPkg.qualityMetrics) {
          const score = getOverallQualityScore(rootPkg);
          setQualityScore(score);
        }
      }
    });
  }, [directory]);

  return (
    <header>
      {/* Existing header content */}

      {qualityScore !== null && (
        <QualityScoreBadge score={qualityScore} />
      )}
    </header>
  );
}
```

---

### Phase 4: Remove Obsolete Code (Week 4)

**Goal**: Clean up deprecated code and documentation

#### Files to Remove/Archive

1. **Delete `PackageLayerToToolConfigBridge.ts`**
   - Move to `docs/archive/` if needed for reference
   - It was an experimental gap analysis tool

2. **Remove manual parsing methods**
   ```typescript
   // QualityLensService.ts - DELETE THESE:
   // private parseCommand(command: string): string
   // private parseArgs(command: string, args: string[]): string[]
   // private findLensForTool(toolName: string, command: string): Lens
   ```

3. **Update documentation**
   - Update `QUALITY_LENS_ARCHITECTURE.md`
   - Update `CODEBASE_COMPOSITION_USAGE.md`
   - Archive outdated implementation plans

4. **Remove deprecated request parameters**
   ```typescript
   // ToolExecutionRequest - Remove once all callers updated:
   // toolName?: string;
   // command?: string;
   // args?: string[];
   ```

---

## Expected Benefits

### 1. Reliability
- ✅ No more fragile command string parsing
- ✅ Commands validated by composition package
- ✅ Lens detection happens automatically

### 2. Features
- ✅ UI shows available vs missing lenses
- ✅ Quality hexagon scores computed automatically
- ✅ Recommendations for improving quality

### 3. Maintainability
- ✅ Single source of truth for tool detection
- ✅ Less custom parsing code
- ✅ Easier to add new lenses (just register in composition package)

### 4. Performance
- ✅ Package analysis happens once, cached
- ✅ No need to re-parse commands for each execution

---

## Testing Strategy

### Unit Tests

1. **Test PackageLayer parsing**
   ```typescript
   describe('PackageProcessor', () => {
     it('should populate qualityMetrics', async () => {
       const packages = await processor.extractPackages(fileTree, repoPath);
       expect(packages[0].qualityMetrics).toBeDefined();
       expect(packages[0].qualityMetrics.availableLenses).toContain('eslint');
     });

     it('should annotate lens commands', async () => {
       const packages = await processor.extractPackages(fileTree, repoPath);
       const lintCommand = packages[0].packageData.availableCommands
         ?.find(cmd => cmd.name === 'lint');
       expect(lintCommand?.isLensCommand).toBe(true);
       expect(lintCommand?.lensId).toBe('eslint');
     });
   });
   ```

2. **Test QualityLensService integration**
   ```typescript
   describe('QualityLensService', () => {
     it('should execute lens from PackageCommand', async () => {
       const result = await service.executeTool({
         repoPath: '/test',
         packageLayer: mockPackageLayer,
         packageCommand: {
           name: 'lint',
           command: 'eslint . --ext .ts',
           isLensCommand: true,
           lensId: 'eslint',
           lensOperation: 'check'
         }
       });

       expect(result.success).toBeDefined();
       expect(result.lensResult).toBeDefined();
     });
   });
   ```

### Integration Tests

1. **End-to-end package analysis**
   - Load real repository
   - Extract packages
   - Verify quality metrics populated
   - Execute lens commands

2. **UI integration**
   - Verify quality metrics displayed
   - Test command execution from UI
   - Verify recommendations shown

---

## Migration Checklist

- [x] **Phase 1: Verify PackageLayer population** ✅ COMPLETED 2025-10-12
  - [x] Add logging to PackageProcessor (console.log in QualityHexagonPanel)
  - [x] Test on sample repository (electron-app verified)
  - [x] Document current state (Progress Update section added)
  - [x] Verify composition package version (@principal-ai/codebase-composition v0.2.7+)
  - [x] Create QualityHexagonPanel component
  - [x] Integrate into Repository Explorer
  - [x] Integrate into Repository Manager
  - [x] Add to PanelConfigurator

- [x] **Phase 2: Refactor QualityLensService** ✅ COMPLETED 2025-10-12
  - [x] Update ToolExecutionRequest interface
  - [x] Refactor executeTool() method (created executeWithPackageLayer)
  - [x] Add parseCommandString() helper
  - [x] Mark old methods as deprecated
  - [x] Update ToolsPanel to use new execution path
  - [x] Add quality context to responses
  - [x] Maintain backwards compatibility

- [ ] Phase 3: Expose quality metrics in UI
  - [ ] Add PackageQualitySection component
  - [ ] Update ToolsPanel
  - [ ] Add QualityScoreBadge to header
  - [ ] Show recommendations

- [ ] Phase 4: Clean up
  - [ ] Remove PackageLayerToToolConfigBridge
  - [ ] Delete deprecated parsing methods
  - [ ] Update documentation
  - [ ] Remove deprecated request fields

- [ ] Testing
  - [ ] Write unit tests
  - [ ] Write integration tests
  - [ ] Test on multiple repositories
  - [ ] Verify backwards compatibility

---

## Risk Mitigation

### Risk 1: PackageLayer fields not populated
**Mitigation**: Keep backwards compatibility with manual parsing initially

### Risk 2: Breaking changes for existing callers
**Mitigation**: Support both old and new request formats during transition

### Risk 3: Composition package bugs
**Mitigation**: Add fallback detection logic, report issues upstream

### Risk 4: Performance regression
**Mitigation**: Profile before/after, ensure caching works correctly

---

## Questions to Answer in Phase 1

1. ✅ Does `PackageLayerModule.discoverPackages()` populate `qualityMetrics`?
2. ✅ Are `PackageCommand` objects annotated with `isLensCommand` and `lensId`?
3. ✅ Do the detected lenses match what we expect (eslint, jest, etc.)?
4. ✅ Are config files detected correctly?
5. ✅ Do the hexagon scores make sense?

**Once these are answered, we'll know the exact scope of Phase 2.**

---

## References

- Package Layer Types: `node_modules/@principal-ai/codebase-composition/dist/types/layer-types.d.ts`
- Quality Calculator: `node_modules/@principal-ai/codebase-composition/dist/helpers/QualityMetricsCalculator.d.ts`
- Package Helpers: `node_modules/@principal-ai/codebase-composition/dist/helpers/packageLayerHelpers.d.ts`
- Current Architecture: `docs/QUALITY_LENS_ARCHITECTURE.md`
- Composition Usage: `docs/CODEBASE_COMPOSITION_USAGE.md`

---

## Conclusion

This refactor will eliminate manual command parsing, reduce code duplication, and unlock quality metrics features that are already implemented in the composition package but currently unused.

**The work is primarily an integration task, not new feature development.**
