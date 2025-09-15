# Event Normalization Separation Design

## Overview

This document outlines the separation of agent-specific normalization from path normalization in the event processing pipeline. The goal is to create a cleaner architecture where:

1. **Agent-monitoring package** handles agent-specific event normalization
2. **Path normalization adapter** handles file system and repository context
3. **Intermediate partially normalized events** bridge the two concerns

## Current Architecture Problems

### Current Flow
```
Raw Agent Event → AgentEventProcessor.normalize() → NormalizedAgentSessionEvent → PathNormalizer → Enriched Event
```

### Issues
1. **Mixed Concerns**: Agent processors handle both agent-specific logic AND path extraction
2. **Tight Coupling**: Path normalization logic is embedded in agent processors
3. **Infrastructure Dependencies**: Agent processors need to know about file system operations
4. **Hard to Test**: Can't test agent normalization without file system access

## Proposed Architecture

### New Flow
```
Raw Agent Event → AgentEventProcessor.normalize() → UniversalAgentSessionEvent → PathNormalizationAdapter → RepoNormalizedUniversalAgentSessionEvent
```

### Separation of Concerns

#### 1. Agent-Specific Normalization (agent-monitoring package)
- **Input**: Raw agent event data
- **Output**: UniversalAgentSessionEvent with extracted paths as strings
- **Responsibilities**:
  - Event type classification
  - Tool name extraction
  - Tool input/output parsing
  - Raw path extraction (as strings)
  - Agent-specific data normalization

#### 2. Repository Path Normalization (centralized with adapter-provided tools)
- **Input**: UniversalAgentSessionEvent with raw path strings
- **Output**: RepoNormalizedUniversalAgentSessionEvent with structured path information
- **Responsibilities**:
  - Path resolution and validation (using adapter-provided tools)
  - Repository detection (using adapter-provided repository service)
  - Path classification (repo, system, temp, etc.)
  - Display path formatting
  - Repository context enrichment

## Interface Definitions

### UniversalAgentSessionEvent

```typescript
/**
 * Universal event structure after agent-specific normalization
 * Contains raw path strings that need repository-specific processing
 */
export interface UniversalAgentSessionEvent {
  // Event classification (from agent processor)
  eventType: NormalizedEventType;
  
  // Session context
  sessionId: string;
  workingDirectory: string;
  transcriptPath?: string;
  
  // Timing
  timestamp: number;
  
  // Tool information (from agent processor)
  toolName?: CommonToolName;
  toolInput?: unknown;
  toolOutput?: unknown;
  
  // Raw file paths (extracted by agent processor, not yet normalized)
  rawFilePaths?: string[];
  
  // Operation type (determined by agent processor)
  operation?: FileOperation;
  
  // Event-specific data (from agent processor)
  data?: {
    prompt?: string;
    message?: string;
    stopHookActive?: boolean;
    trigger?: 'manual' | 'auto';
    customInstructions?: string;
    source?: 'startup' | 'resume' | 'clear';
    [key: string]: unknown;
  };
  
  // Original raw event data
  raw: unknown;
  
  // Which agent produced this event
  provider: SupportedAgent;
}
```

### PathNormalizationAdapter Interface

```typescript
/**
 * Interface for path normalization adapters
 * Provides only environment-specific tools that must be implemented differently per platform
 * Implementations can be swapped based on environment (Node.js, browser, etc.)
 */
export interface PathNormalizationAdapter {
  /**
   * Get raw repository information for a given path (no caching)
   * @param absolutePath Absolute file system path
   * @returns Repository information if path is in a git repository, null otherwise
   */
  getRawRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null>;
  
  /**
   * Get system information (home directory, path separator, etc.)
   * @returns System-specific information needed for path processing
   */
  getSystemInfo(): SystemInfo;
  
  /**
   * Resolve a relative path to absolute path
   * @param relativePath Relative path to resolve
   * @param workingDirectory Working directory to resolve against
   * @returns Absolute path
   */
  resolvePath(relativePath: string, workingDirectory: string): string;
  
  /**
   * Check if a path is absolute
   * @param path Path to check
   * @returns true if path is absolute
   */
  isAbsolutePath(path: string): boolean;
  
  /**
   * Get relative path from one path to another
   * @param fromPath Source path
   * @param toPath Target path
   * @returns Relative path from source to target
   */
  getRelativePath(fromPath: string, toPath: string): string;
  
  /**
   * Check if the adapter is available in the current environment
   * @returns true if path normalization is supported
   */
  isAvailable(): boolean;
}

/**
 * System information needed for path normalization
 */
export interface SystemInfo {
  homeDir: string;
  pathSeparator: string;
  platform: 'win32' | 'darwin' | 'linux' | string;
}
```

### Centralized Path Normalization Service

```typescript
/**
 * Centralized service for normalizing paths in universal agent session events
 * Uses a PathNormalizationAdapter to access environment-specific tools
 * Handles caching and all business logic for path normalization
 */
export class PathNormalizationService {
  private repositoryCache = new Map<string, RepositoryInfo>();
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes
  private cacheTimestamps = new Map<string, number>();
  
  constructor(private adapter: PathNormalizationAdapter) {}
  
  /**
   * Normalize a universal agent session event by processing its raw file paths
   * @param event Universal agent session event with raw path strings
   * @returns Repository-normalized event with structured path information
   */
  async normalizePaths(event: UniversalAgentSessionEvent): Promise<RepoNormalizedUniversalAgentSessionEvent> {
    const normalizedPaths: NormalizedPathInfo[] = [];
    
    if (event.rawFilePaths) {
      for (const rawPath of event.rawFilePaths) {
        const normalized = await this.normalizePath(rawPath, event.workingDirectory);
        normalizedPaths.push(normalized);
      }
    }
    
    return {
      ...event,
      files: normalizedPaths,
      // Remove rawFilePaths as it's no longer needed
    } as RepoNormalizedUniversalAgentSessionEvent;
  }
  
  /**
   * Normalize a single file path with full context
   * @param filePath Raw file path from the event
   * @param workingDirectory Working directory context
   * @returns Normalized path information
   */
  private async normalizePath(filePath: string, workingDirectory: string): Promise<NormalizedPathInfo> {
    // 1. Resolve to absolute path using adapter
    const absolutePath = this.adapter.isAbsolutePath(filePath) 
      ? filePath 
      : this.adapter.resolvePath(filePath, workingDirectory);
    
    // 2. Check if in a git repository using cached adapter call
    const repoInfo = await this.getRepositoryInfo(absolutePath);
    
    if (repoInfo) {
      // File is in a repository
      const relativePath = this.adapter.getRelativePath(repoInfo.root, absolutePath);
      
      return {
        originalPath: filePath,
        context: this.classifyPathInRepo(relativePath),
        repository: {
          gitRoot: repoInfo.root,
          relativePath,
          remoteUrl: repoInfo.remoteUrl,
          owner: repoInfo.owner,
          repo: repoInfo.repo
        },
        absolutePath,
        displayPath: relativePath
      };
    }
    
    // 3. File is not in a repository - classify as external
    const context = this.classifyPath(absolutePath);
    const systemInfo = this.adapter.getSystemInfo();
    
    return {
      originalPath: filePath,
      context,
      system: this.getSystemInfo(absolutePath, systemInfo),
      absolutePath,
      displayPath: this.formatDisplayPath(absolutePath, context, systemInfo)
    };
  }
  
  /**
   * Get repository information with caching
   * @param absolutePath Absolute file system path
   * @returns Repository information if path is in a git repository, null otherwise
   */
  private async getRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
    const now = Date.now();
    
    // Check cache first
    if (this.repositoryCache.has(absolutePath)) {
      const timestamp = this.cacheTimestamps.get(absolutePath) || 0;
      if (now - timestamp < this.cacheTimeout) {
        return this.repositoryCache.get(absolutePath) || null;
      }
    }
    
    // Cache miss or expired - get fresh data from adapter
    const repoInfo = await this.adapter.getRawRepositoryInfo(absolutePath);
    
    // Cache the result
    if (repoInfo) {
      this.repositoryCache.set(absolutePath, repoInfo);
      this.cacheTimestamps.set(absolutePath, now);
    }
    
    return repoInfo;
  }
  
  /**
   * Normalize working directory to repository root
   * @param workingDirectory Raw working directory path
   * @returns Repository root if in a git repo, otherwise original path
   */
  async normalizeWorkingDirectory(workingDirectory: string): Promise<string> {
    const repoInfo = await this.getRepositoryInfo(workingDirectory);
    return repoInfo?.root || workingDirectory;
  }
  
  /**
   * Clear the repository cache (useful for testing or when repositories change)
   */
  clearCache(): void {
    this.repositoryCache.clear();
    this.cacheTimestamps.clear();
  }
  
  // Helper methods for path classification and formatting...
  private classifyPathInRepo(relativePath: string): PathContext { /* ... */ }
  private classifyPath(absolutePath: string): PathContext { /* ... */ }
  private getSystemInfo(absolutePath: string, systemInfo: SystemInfo): any { /* ... */ }
  private formatDisplayPath(absolutePath: string, context: PathContext, systemInfo: SystemInfo): string { /* ... */ }
}
```

### Updated AgentEventProcessor Interface

```typescript
/**
 * Updated interface for agent-specific event processors
 * Now returns universal agent session events instead of fully normalized ones
 */
export interface AgentEventProcessor<RawEventType = unknown> {
  /**
   * Normalize raw hook data into a universal agent session event structure
   * @param rawData The raw event data from the agent's hook
   * @returns Universal agent session event with raw path strings
   */
  normalize(rawData: RawEventType): UniversalAgentSessionEvent;
}
```

## Existing Implementation Reference

To avoid recreating the wheel, here are the absolute paths to existing enrichment logic that can be referenced and adapted:

### **Current Path Normalization Logic**
- **Main Path Normalizer**: `electron-react/src/main/agent-session-events/PathNormalizer.ts`
  - Contains the complete path normalization algorithm
  - Repository detection and classification logic
  - Display path formatting
  - System path classification

### **Current Event Enrichment Logic**
- **Event Processor**: `electron-react/src/main/agent-session-events/AgentSessionEventProcessor.ts`
  - Lines 396-460: `enrichEventWithGitRoot()` method
  - Lines 414-420: Path normalization call
  - Lines 462-504: Repository tracking logic

### **Current Repository Detection**
- **Repository Cache**: `electron-react/src/main/stores/RepositoryCache.ts`
  - Repository detection and caching logic
  - Git service integration
  - Cache management

### **Current Path Classification**
- **Path Types**: `core/src/agents/hooks/types/PathNormalization.ts`
  - Path context enums and types
  - File operation classification
  - Path extraction utilities

### **Current Agent Processors**
- **Claude Processor**: `core/src/agents/hooks/event-processors/claude/ClaudeEventProcessor.ts`
  - Lines 120-125: Path extraction from tool input
  - Lines 166-175: Operation determination and path handling
- **Gemini Processor**: `core/src/agents/hooks/event-processors/gemini/GeminiEventProcessor.ts`
  - Lines 165-175: Similar path extraction logic
- **OpenCode Processor**: `core/src/agents/hooks/event-processors/opencode/OpenCodeEventProcessor.ts`
  - Lines 138-147: Path extraction and operation handling

### **Key Methods to Reference**

1. **PathNormalizer.normalizePath()** - Complete path normalization algorithm
2. **PathNormalizer.classifyPathInRepo()** - Repository file classification
3. **PathNormalizer.getSystemInfo()** - System path information
4. **PathNormalizer.formatDisplayPath()** - Display path formatting
5. **extractFilePathsFromToolInput()** - Tool input path extraction
6. **getFileOperation()** - File operation classification

### **Migration Strategy for Existing Code**

The existing `PathNormalizer` class can be largely reused by:
1. **Extracting the core algorithms** into the `PathNormalizationService`
2. **Moving environment-specific calls** to the adapter
3. **Keeping the business logic** in the centralized service

### **Code Migration Mapping**

| **Existing Code** | **New Location** | **Action** |
|------------------|------------------|------------|
| `PathNormalizer.normalizePath()` | `PathNormalizationService.normalizePath()` | Move algorithm, replace Node.js calls with adapter calls |
| `PathNormalizer.classifyPathInRepo()` | `PathNormalizationService.classifyPathInRepo()` | Move as-is (pure logic) |
| `PathNormalizer.getSystemInfo()` | `NodePathNormalizationAdapter.getSystemInfo()` | Move to adapter (environment-specific) |
| `PathNormalizer.formatDisplayPath()` | `PathNormalizationService.formatDisplayPath()` | Move algorithm, use adapter for system info |
| `PathNormalizer.shouldTrackInDetail()` | `PathNormalizationService.shouldTrackInDetail()` | Move as-is (pure logic) |
| `extractFilePathsFromToolInput()` | `AgentEventProcessor.normalize()` | Move to agent processors (already there) |
| `getFileOperation()` | `AgentEventProcessor.normalize()` | Move to agent processors (already there) |
| `RepositoryCache.getRepositoryForPath()` | `NodePathNormalizationAdapter.getRawRepositoryInfo()` | Wrap in adapter, remove caching |
| `AgentSessionEventProcessor.enrichEventWithGitRoot()` | `PathNormalizationService.normalizePaths()` | Move logic, use adapter for repository detection |

### **Specific Line References for Migration**

**From `PathNormalizer.ts`:**
- Lines 42-119: `normalizePath()` → `PathNormalizationService.normalizePath()`
- Lines 136-154: `classifyPathInRepo()` → `PathNormalizationService.classifyPathInRepo()`
- Lines 159-207: `getSystemInfo()` → `NodePathNormalizationAdapter.getSystemInfo()`
- Lines 212-251: `formatDisplayPath()` → `PathNormalizationService.formatDisplayPath()`
- Lines 257-284: `shouldTrackInDetail()` → `PathNormalizationService.shouldTrackInDetail()`

**From `AgentSessionEventProcessor.ts`:**
- Lines 396-460: `enrichEventWithGitRoot()` → `PathNormalizationService.normalizePaths()`
- Lines 414-420: Path normalization call → Use service instead of direct PathNormalizer

**From `RepositoryCache.ts`:**
- Lines 42-100: Repository detection logic → `NodePathNormalizationAdapter.getRawRepositoryInfo()`
- Remove caching logic (moved to service)

## Implementation Plan

### Phase 1: Create UniversalAgentSessionEvent Type

1. **Add to agent-monitoring package**:
   ```typescript
   // core/src/agents/hooks/types/UniversalAgentSessionEvent.ts
   export interface UniversalAgentSessionEvent {
     // ... (as defined above)
   }
   ```

2. **Update agent processors** to return `UniversalAgentSessionEvent`:
   ```typescript
   // ClaudeEventProcessor.normalize() returns UniversalAgentSessionEvent
   // GeminiEventProcessor.normalize() returns UniversalAgentSessionEvent
   // OpenCodeEventProcessor.normalize() returns UniversalAgentSessionEvent
   ```

### Phase 2: Create PathNormalizationAdapter Interface and Service

1. **Add to agent-monitoring package**:
   ```typescript
   // core/src/agents/adapters/PathNormalizationAdapter.ts
   export interface PathNormalizationAdapter {
     // ... (as defined above)
   }
   
   // core/src/agents/services/PathNormalizationService.ts
   export class PathNormalizationService {
     // ... (as defined above)
   }
   ```

2. **Create Node.js adapter implementation** in electron-react:
   ```typescript
   // electron-react/src/main/agent-session-events/NodePathNormalizationAdapter.ts
   export class NodePathNormalizationAdapter implements PathNormalizationAdapter {
     constructor(
       private gitService: GitService // Direct git service, no caching
     ) {}
     
     async getRawRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
       // Direct git detection without caching (caching handled by service)
       const gitInfo = await this.gitService.getRepositoryInfo(absolutePath);
       if (gitInfo?.root) {
         return {
           root: gitInfo.root,
           remoteUrl: gitInfo.remoteUrl,
           owner: gitInfo.owner,
           repo: gitInfo.repo,
           branch: gitInfo.branch
         };
       }
       return null;
     }
     
     getSystemInfo(): SystemInfo {
       return {
         homeDir: os.homedir(),
         pathSeparator: path.sep,
         platform: process.platform
       };
     }
     
     resolvePath(relativePath: string, workingDirectory: string): string {
       return path.resolve(workingDirectory, relativePath);
     }
     
     isAbsolutePath(path: string): boolean {
       return path.isAbsolute(path);
     }
     
     getRelativePath(fromPath: string, toPath: string): string {
       return path.relative(fromPath, toPath);
     }
     
     isAvailable(): boolean {
       return true; // Node.js environment
     }
   }
   ```

### Phase 3: Update AgentSessionEventProcessor

```typescript
export class AgentSessionEventProcessor extends EventEmitter {
  private pathNormalizationService: PathNormalizationService;
  
  constructor(pathAdapter: PathNormalizationAdapter) {
    super();
    this.pathNormalizationService = new PathNormalizationService(pathAdapter);
    // ... rest of initialization
  }
  
  async processRawEvent(provider: SupportedAgent, rawData: AgentHookInput): Promise<RepoNormalizedUniversalAgentSessionEvent> {
    // 1. Agent-specific normalization
    const adapter = this.adapters.get(provider);
    const universalEvent = adapter.normalize(rawData);
    
    // 2. Repository path normalization (centralized logic)
    const repoNormalizedEvent = await this.pathNormalizationService.normalizePaths(universalEvent);
    
    // 3. Working directory normalization
    repoNormalizedEvent.normalizedWorkingDirectory = await this.pathNormalizationService.normalizeWorkingDirectory(
      repoNormalizedEvent.workingDirectory
    );
    
    // 4. Continue with existing logic...
    return repoNormalizedEvent;
  }
}
```

## Benefits

### 1. **Clean Separation of Concerns**
- Agent processors focus only on agent-specific logic
- Path normalization logic is centralized in the service
- Adapters provide only the tools needed for path processing
- Each component has a single responsibility

### 2. **Improved Testability**
- Agent processors can be tested without file system access
- Path normalization can be tested with mock adapters
- Unit tests become more focused and reliable

### 3. **Better Reusability**
- Agent-monitoring package becomes environment-agnostic
- Path normalization logic is centralized and reusable
- Adapters can be swapped for different environments
- Core logic is separated from infrastructure concerns

### 4. **Easier Maintenance**
- Changes to path normalization don't affect agent processors
- Agent-specific logic is isolated and easier to modify
- Clear interfaces make the system more maintainable

## Migration Strategy

### Step 1: Add New Types (Non-Breaking)
- Add `UniversalAgentSessionEvent` interface
- Add `PathNormalizationAdapter` interface
- Keep existing `NormalizedAgentSessionEvent` unchanged (will become `RepoNormalizedUniversalAgentSessionEvent`)

### Step 2: Update Agent Processors (Breaking)
- Change return type from `NormalizedAgentSessionEvent` to `UniversalAgentSessionEvent`
- Remove path normalization logic from processors
- Keep only path extraction (as raw strings)

### Step 3: Create Path Adapter (New)
- Implement `NodePathNormalizationAdapter` in electron-react
- Move existing path normalization logic to the adapter
- Update `AgentSessionEventProcessor` to use the adapter

### Step 4: Clean Up (Final)
- Remove unused path normalization code from agent processors
- Update tests to use new interfaces
- Update documentation

## Example Usage

### Agent Processor (agent-monitoring package)
```typescript
export class ClaudeEventProcessor implements AgentEventProcessor<ClaudeHookInput> {
  normalize(rawData: ClaudeHookInput): UniversalAgentSessionEvent {
    // Extract agent-specific information
    const eventType = this.determineEventType(rawData);
    const toolName = this.extractToolName(rawData);
    const toolInput = this.extractToolInput(rawData);
    
    // Extract raw file paths (as strings)
    const rawFilePaths = this.extractRawFilePaths(toolName, toolInput);
    
    return {
      eventType,
      sessionId: rawData.session_id,
      workingDirectory: rawData.working_directory,
      timestamp: Date.now(),
      toolName,
      toolInput,
      rawFilePaths, // Raw strings, not normalized
      operation: this.determineOperation(toolName),
      raw: rawData,
      provider: SupportedAgent.CLAUDE
    };
  }
}
```

### Path Adapter (electron-react)
```typescript
export class NodePathNormalizationAdapter implements PathNormalizationAdapter {
  constructor(private gitService: GitService) {}
  
  async getRawRepositoryInfo(absolutePath: string): Promise<RepositoryInfo | null> {
    // Direct git detection - no caching (handled by service)
    const gitInfo = await this.gitService.getRepositoryInfo(absolutePath);
    if (gitInfo?.root) {
      return {
        root: gitInfo.root,
        remoteUrl: gitInfo.remoteUrl,
        owner: gitInfo.owner,
        repo: gitInfo.repo,
        branch: gitInfo.branch
      };
    }
    return null;
  }
  
  getSystemInfo(): SystemInfo {
    return {
      homeDir: os.homedir(),
      pathSeparator: path.sep,
      platform: process.platform
    };
  }
  
  resolvePath(relativePath: string, workingDirectory: string): string {
    return path.resolve(workingDirectory, relativePath);
  }
  
  isAbsolutePath(path: string): boolean {
    return path.isAbsolute(path);
  }
  
  getRelativePath(fromPath: string, toPath: string): string {
    return path.relative(fromPath, toPath);
  }
  
  isAvailable(): boolean {
    return true; // Node.js environment
  }
}
```

## Conclusion

This design provides a clean separation between agent-specific normalization and repository path normalization, making the system more modular, testable, and maintainable. The intermediate `UniversalAgentSessionEvent` serves as a clear contract between the two concerns, while the centralized `PathNormalizationService` handles all path processing logic using environment-specific adapters that provide only the necessary tools and information.
