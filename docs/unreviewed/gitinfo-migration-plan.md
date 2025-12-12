# GitInfo Type Migration Plan

## Overview
We need to migrate from multiple conflicting `GitInfo` definitions to a clean, unified type system that separates local git repository information from remote repository information.

## New Type Definitions (in `src/shared/types/repository.types.ts`)

```typescript
// Local git repository information
export interface LocalGitRepositoryInfo {
  root: string;          // Git repository root path
  branch: string;        // Current branch
  availableBranches?: string[]; // Available branches (when fetched)
}

// Remote repository information (all fields required)
export interface RemoteRepositoryInfo {
  url: string;           // Remote URL
  defaultBranch: string; // Default branch as configured on the remote
  owner: string;         // Repository owner
  repo: string;          // Repository name
}

// Complete repository git information
export interface RepositoryGitInfo {
  root: string;          // Git repository root path
  branch: string;        // Current branch
  availableBranches?: string[]; // Available branches (when fetched)
  remote?: RemoteRepositoryInfo; // Remote information (if properly configured and parseable)
}
```

## Files Requiring Migration

### High Priority - Core Services

1. **`src/main/version-control-providers/GitService.ts`**
   - Current: Defines its own `GitInfo` interface
   - Required Changes: 
     - Update to return `RepositoryGitInfo`
     - Ensure `branch` is always provided (handle edge cases as errors)
     - Only include `remote` when ALL fields (url, defaultBranch, owner, repo) are available

2. **`src/main/principal-mcp/repositoryNoteHandler.ts`**
   - Current: Uses `GitInfo` from GitService
   - Required Changes:
     - Import `RepositoryGitInfo` from shared types
     - Update `convertToRepositoryNote` to use new structure
     - Access remote URL via `gitInfo.remote?.url` instead of `gitInfo.remoteUrl`

3. **`src/shared/main-process-api-interfaces/RepositoryNotesAPI.ts`**
   - Current: Has been updated to import type from shared
   - Required Changes: Already updated ✓

### Medium Priority - Session Management

4. **`src/main/agent-sessions/agentSessionService.ts`**
   - Current: Uses `basicGitInfo` with custom structure
   - Required Changes:
     - Update `getBasicGitInfo` to return `LocalGitRepositoryInfo`
     - Update `checkAndSaveGitInfoIfMissing` to use new types
     - Update all references to `basicGitInfo.gitRoot` to `basicGitInfo.root`

5. **`src/shared/sessionTypes.ts`**
   - Current: May have its own git info structure
   - Required Changes: Import and use shared types

### Low Priority - UI Services

6. **`src/renderer/main-process-api/GitService.ts`**
   - Current: Defines a DIFFERENT `GitInfo` interface (for renderer process)
   - Required Changes:
     - Rename to `RendererGitInfo` to avoid confusion
     - Consider if it should use the shared types instead

7. **`src/main/stores/RepositoryCache.ts`**
   - Current: Uses GitInfo
   - Required Changes: Update to use `RepositoryGitInfo`

## Migration Strategy

### Phase 1: Type Definition (COMPLETE)
- ✅ Create new type definitions in shared folder
- ✅ Ensure types are properly exported

### Phase 2: Core Services Migration
1. Update `GitService.ts` to use new types
2. Update `repositoryNoteHandler.ts` to consume new structure
3. Run tests to ensure notes functionality works

### Phase 3: Session Management Migration
1. Update `agentSessionService.ts` 
2. Update session types in `sessionTypes.ts`
3. Test agent session functionality

### Phase 4: Cleanup
1. Remove old `GitInfo` definitions
2. Rename renderer's `GitInfo` to avoid confusion
3. Update any remaining references

## Key Changes for Developers

### Before:
```typescript
gitInfo.remoteUrl // might be undefined
gitInfo.branch    // might be undefined
gitInfo.owner     // might be undefined
```

### After:
```typescript
gitInfo.branch           // always present
gitInfo.remote?.url      // remote might not exist
gitInfo.remote?.owner    // if remote exists, owner is guaranteed
gitInfo.remote?.repo     // if remote exists, repo is guaranteed
```

## Testing Checklist

- [ ] Local repositories without remotes still work
- [ ] Remote repositories have all fields populated
- [ ] Repository notes can be created and retrieved
- [ ] Agent sessions track git information correctly
- [ ] No TypeScript errors after migration

## Storage Considerations

### Complete Storage Architecture

The application has **THREE separate systems** storing git-related information:

#### 1. Repository Cards System (`StaticNamespaces.REPOSITORIES`)
- **Type**: `Repository` with `LocalClone[]`
- **Purpose**: Powers the repository cards in the landing page UI
- **Location**: `src/shared/types/repository.types.ts`
- **Structure**:
  ```typescript
  interface Repository {
    // Remote repository identification
    remoteUrl: string;
    vcsType: VCSType;
    owner: string;
    name: string;
    
    // Local clones of this repository
    localClones: LocalClone[];  // Array of all local paths
    
    // Metadata
    metadata?: {
      stars?: number;
      language?: string;
      defaultBranch?: string;
      isFork?: boolean;
      parentRepo?: {...};
    };
  }
  
  interface LocalClone {
    path: string;
    currentBranch?: string;
    lastCommit?: string;
  }
  ```
- **Note**: This system is INDEPENDENT of GitInfo and already has good separation of concerns
- **Used by**: `RepositoryCard.tsx`, `ProjectsView.tsx`, `RepositoryApiEventHandler.ts`

#### 2. Agent Sessions (`StaticNamespaces.AGENT_SESSIONS`)
- **Type**: `AgentSessionRecord` with `basicGitInfo`
- **Purpose**: Track which repository each agent session belongs to for grouping
- **Location**: `src/shared/sessionTypes.ts`
- **Current structure**:
  ```typescript
  basicGitInfo?: {
    gitRoot: string;
    relativePath: string;
    githubOwner?: string;
    githubRepo?: string;
  }
  ```
- **Used by**: `agentSessionService.ts` for session management

#### 3. Repository Cache (In-memory + persistent)
- **Type**: `CacheEntry` with `GitInfo`
- **Purpose**: Cache git information for performance
- **Location**: `src/main/stores/RepositoryCache.ts`
- **Structure**:
  ```typescript
  interface CacheEntry {
    localPath: string;
    remoteUrl: string;
    gitInfo: GitInfo;  // Old structure from GitService
    timestamp: number;
  }
  ```
- **Note**: Uses the old `GitInfo` type from GitService

### Migration Impact Analysis

#### What Needs Migration:
1. **AgentSessionRecord** (`basicGitInfo` field):
   - Need to update structure to use new types
   - Rename `gitRoot` → `root` for consistency
   - Requires data migration for existing stored sessions

2. **RepositoryCache** (`CacheEntry.gitInfo` field):
   - Update to use `RepositoryGitInfo` type
   - Can invalidate cache and regenerate (it's just a cache)

3. **GitService API**:
   - Update return types to use `RepositoryGitInfo`
   - Handle edge cases (no branch, no remote) as errors

#### What Doesn't Need Migration:
1. **Repository Cards System**:
   - Already has good separation between local clones and remote info
   - `Repository` and `LocalClone` types are well-designed
   - No changes needed for this system

### Data Relationships

```
Repository (for UI cards)
    ├── remoteUrl (required)
    ├── owner (required)
    ├── name (required)
    └── localClones[]
        ├── path
        ├── currentBranch
        └── lastCommit

AgentSessionRecord (for sessions)
    └── basicGitInfo
        ├── gitRoot → should use LocalGitRepositoryInfo
        └── githubOwner/Repo → should use RemoteRepositoryInfo

RepositoryCache (for performance)
    └── gitInfo → should use RepositoryGitInfo
```

### Recommended Migration Strategy

#### Phase 1: Type Updates
```typescript
// Update AgentSessionRecord
interface AgentSessionRecord {
  // ... other fields ...
  gitInfo?: LocalGitRepositoryInfo;
  remoteInfo?: RemoteRepositoryInfo;  // Optional
}

// Update CacheEntry
interface CacheEntry {
  localPath: string;
  gitInfo: RepositoryGitInfo;
  timestamp: number;
}
```

#### Phase 2: Data Migration
1. **For AgentSessionRecord**: Add version field, migrate on read
2. **For RepositoryCache**: Clear and regenerate (it's temporary data)
3. **For Repository**: No changes needed

## Notes for Migration Team

1. **Branch is now required**: Any code that handles cases where branch is undefined needs to be updated to treat this as an error condition
2. **Remote is all-or-nothing**: If we can't get ALL remote fields, we don't include the remote property at all
3. **Path changes**: `gitInfo.remoteUrl` becomes `gitInfo.remote?.url`
4. **Root field naming**: Some places use `gitRoot`, others use `root` - standardize on `root`
5. **Storage migration**: Existing stored sessions and cache entries will need migration or invalidation
6. **Consider versioning**: Add version fields to stored structures for easier future migrations