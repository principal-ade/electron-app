# GitClientFactory to GitLens Migration Audit

## Overview
This document audits all uses of GitClientFactory in the electron-app codebase to plan migration to GitLens from codebase-quality-lenses package.

**Generated:** 2025-09-19
**Updated:** 2025-09-19
**Purpose:** Avoid technical debt and identify gaps for the lens team

## Migration Status
- ✅ **Completed:** 4 methods migrated to GitLens (40%)
- ⏳ **Pending:** 6 methods awaiting GitLens support (60%)

## GitClientFactory Method Usage Audit

### 1. `findGitRoot(directory: string): Promise<string | null>`
**Purpose:** Find the root directory of a git repository
**GitLens Support:** ❌ Not Available
**Files Using This Method:**
- `src/main/version-control-providers/GitService.ts` (line 29)
  - Used to validate and find repository root before getting git info
- `src/main/version-control-providers/gitBranchService.ts` (line 72)
  - Used in private getGitRoot() method for branch operations
- `src/main/file-system/gitRepositoryService.ts` (line 130)
  - Used in findGitRoot() method to locate repository root

**Migration Strategy:** Keep using electron-cli-bridge
**Request for Lens Team:** Add repository root discovery

---

### 2. `isGitRepository(directory: string): Promise<boolean>`
**Purpose:** Check if a directory is a git repository
**GitLens Support:** ❌ Not Available
**Files Using This Method:**
- `src/main/file-system/gitRepositoryService.ts` (line 433)
  - Used to validate if directory is a git repository

**Migration Strategy:** Keep using electron-cli-bridge
**Request for Lens Team:** Add repository validation check

---

### 3. `getCurrentBranch(directory: string): Promise<string | null>`
**Purpose:** Get the current active branch name
**GitLens Support:** ✅ Available via `result.data.branch`
**Files Using This Method:**
- `src/main/version-control-providers/gitBranchService.ts` (line 80)
  - Used to get current branch with fallback logic

**Migration Status:** ✅ **COMPLETED**
**Implementation:** GitLensAdapter.getCurrentBranch()
```typescript
// Now using GitLens in GitClientFactory:
return await gitLensAdapter.getCurrentBranch(directory);
```

---

### 4. `getCurrentCommit(directory: string): Promise<string | null>`
**Purpose:** Get the current HEAD commit SHA
**GitLens Support:** ✅ Available via `result.data.commit`
**Files Using This Method:**
- `src/main/version-control-providers/gitBranchService.ts` (line 270)
  - Used in getCurrentCommit() method
- `src/main/file-system/gitRepositoryService.ts` (line 488)
  - Used as fallback when commit result doesn't contain hash

**Migration Status:** ✅ **COMPLETED**
**Implementation:** GitLensAdapter.getCurrentCommit()
```typescript
// Now using GitLens in GitClientFactory:
return await gitLensAdapter.getCurrentCommit(directory);
```

**Additional Method Added:**
### 4a. `getLastCommitInfo(directory: string): Promise<CommitInfo | null>`
**Purpose:** Get detailed last commit information including date for sorting
**GitLens Support:** ✅ Available with `includeCommitDetails: true`
**Migration Status:** ✅ **COMPLETED**
**Implementation:** GitLensAdapter.getLastCommitInfo()
```typescript
// New method added for landing page repository sorting:
return await gitLensAdapter.getLastCommitInfo(directory);
```

---

### 5. `getGitStatus(directory: string): Promise<{staged, unstaged, untracked}>`
**Purpose:** Get file status (staged, unstaged, untracked files)
**GitLens Support:** ✅ Available via `result.data.{staged, modified, untracked}`
**Files Using This Method:**
- `src/main/file-system/gitRepositoryService.ts` (line 448)
  - Used in getGitStatus() method to return status info
- `src/main/file-system/gitRepositoryService.ts` (line 533)
  - Used in getUncommittedChanges() to get all modified files

**Migration Status:** ✅ **COMPLETED**
**Implementation:** GitLensAdapter.getGitStatus()
```typescript
// Now using GitLens in GitClientFactory:
return await gitLensAdapter.getGitStatus(directory);
// Maps: GitLens.modified → unstaged, GitLens.staged → staged
```

---

### 6. `getRemotes(directory: string): Promise<Array<{name, url, owner?, repo?}>>`
**Purpose:** Get list of git remotes with details
**GitLens Support:** ❌ Not Available
**Files Using This Method:**
- `src/main/version-control-providers/gitBranchService.ts` (line 245)
  - Used in getRemotes() to extract remote names
- `src/main/file-system/gitRepositoryService.ts` (line 177)
  - Used in getRepositoryInfo() to populate remote details

**Migration Strategy:** Keep using electron-cli-bridge
**Request for Lens Team:** Add remote repository information

---

### 7. `getLocalBranches(directory: string): Promise<string[]>`
**Purpose:** Get list of all local branches
**GitLens Support:** ❌ Not Available
**Files Using This Method:**
- `src/main/version-control-providers/gitBranchService.ts` (line 217)
  - Used in getAvailableBranches() to populate branch list

**Migration Strategy:** Keep using electron-cli-bridge
**Request for Lens Team:** Add branch listing capability

---

### 8. `getRemoteBranches(directory: string): Promise<string[]>`
**Purpose:** Get list of all remote branches
**GitLens Support:** ❌ Not Available
**Files Using This Method:**
- `src/main/version-control-providers/gitBranchService.ts` (line 225)
  - Used in getAvailableBranches() for remote branches

**Migration Strategy:** Keep using electron-cli-bridge
**Request for Lens Team:** Add remote branch listing

---

### 9. `getConfig(directory: string, key: string): Promise<string | null>`
**Purpose:** Get git configuration values
**GitLens Support:** ❌ Not Available
**Files Using This Method:**
- `src/main/version-control-providers/GitService.ts` (lines 49-52)
  - Used to get 'remote.origin.url' for repository info
- `src/main/version-control-providers/gitBranchService.ts` (line 258)
  - Used to get 'remote.origin.url' in getRemoteUrl()

**Migration Strategy:** Keep using electron-cli-bridge
**Request for Lens Team:** Add config reading capability

---

### 10. `getClient(baseDir: string): Promise<GitCompatibilityObject>`
**Purpose:** Get git client for complex operations (add, commit, raw commands)
**GitLens Support:** ❌ Not Available (write operations)
**Files Using This Method:**
- `src/main/version-control-providers/GitService.ts` (line 72)
  - Used for `revparse(['HEAD'])` to get HEAD commit
- `src/main/file-system/GitRepositoryWatcher.ts` (line 253)
  - Used for multiple raw commands (status, rev-list, symbolic-ref)
- `src/main/file-system/gitRepositoryService.ts` (lines 457, 471, 550)
  - Used for `add()`, `commit()`, and raw commands
- `src/main/file-system/gitHandlers.ts` (lines 18, 200, 219, 353)
  - Used for `ls-remote`, `clone()`, raw commands, and status checks

**Sub-operations from getClient():**
- `git.revparse(args)` - Parse git references
- `git.status()` - Get status (can be replaced by GitLens)
- `git.add(files)` - Stage files (write operation)
- `git.commit(message)` - Create commits (write operation)
- `git.raw(args)` - Execute arbitrary git commands
- `git.clone(url, path)` - Clone repositories

**Migration Strategy:** Keep for write operations, use GitLens for read operations
**Request for Lens Team:** Consider adding write operations support

---

## Summary Statistics

**Total Methods:** 11 (10 original + 1 new)
**GitLens Supported & Migrated:** 5 (45%)
**GitLens Not Supported:** 6 (55%)

**Completed Migrations:**
1. ✅ `getCurrentCommit()` - Full commit hash
2. ✅ `getLastCommitInfo()` - NEW: Detailed commit info with date
3. ✅ `getCurrentBranch()` - Current branch name
4. ✅ `getGitStatus()` - Staged, unstaged, untracked files

**Files Affected:** 5
1. `src/main/version-control-providers/GitService.ts`
2. `src/main/version-control-providers/gitBranchService.ts`
3. `src/main/file-system/GitRepositoryWatcher.ts`
4. `src/main/file-system/gitRepositoryService.ts`
5. `src/main/file-system/gitHandlers.ts`

## Requests for Lens Team

### High Priority (Core Operations)
1. **Repository Discovery**
   - `findGitRoot(path)` - Find repository root from any path
   - `isGitRepository(path)` - Check if path is in a git repo

2. **Branch Operations**
   - `getLocalBranches()` - List all local branches
   - `getRemoteBranches()` - List all remote branches
   - `getDefaultBranch()` - Identify default/main branch

3. **Remote Information**
   - `getRemotes()` - List remotes with URLs
   - Parse GitHub owner/repo from remote URLs

### Medium Priority (Configuration)
4. **Configuration Access**
   - `getConfig(key)` - Read git config values
   - Specifically need `remote.origin.url`

### Nice to Have (Advanced)
5. **Write Operations** (if in scope)
   - `stageFiles(files)` - Stage files for commit
   - `createCommit(message)` - Create commits
   - `push()`, `pull()` - Sync operations

6. **Raw Command Support**
   - `executeCommand(args)` - Run arbitrary git commands
   - Useful for edge cases and advanced operations

## Migration Plan

### Phase 1: Create Adapter (Week 1)
- Create GitLensAdapter class
- Implement GitLens for supported operations (30%)
- Keep electron-cli-bridge for unsupported operations (70%)
- Maintain 100% backward compatibility

### Phase 2: Test Integration (Week 2)
- Replace imports in one file at a time
- Start with least critical: `GitService.ts`
- Run existing tests for each file
- Document any behavioral differences

### Phase 3: Incremental Migration (Week 3-4)
- Migrate remaining files one by one
- Update tests to use GitLens format where applicable
- Create performance benchmarks

### Phase 4: Optimization (Future)
- As lens team adds features, replace electron-cli-bridge calls
- Optimize caching strategy
- Consider removing electron-cli-bridge dependency

## Performance Considerations

**Current Implementation:**
- Individual git commands executed sequentially
- No caching of results
- Direct CLI execution

**GitLens Implementation:**
- Runs multiple git commands in parallel
- Returns structured, parsed results
- Potential for result caching

**Performance Impact:**
- Status operations: Likely faster (parallel execution)
- Branch operations: Similar performance
- Write operations: No change (still using CLI)

## Risk Assessment

**Low Risk:**
- Read-only operations (status, branch info)
- Operations with GitLens support
- Non-critical paths

**Medium Risk:**
- Write operations (commits, staging)
- Operations requiring electron-cli-bridge fallback
- Critical user-facing features

**High Risk:**
- Raw git command execution
- Complex git workflows
- Repository initialization/cloning

## Next Steps

1. Review this audit with the team
2. Submit feature requests to lens team
3. Create GitLensAdapter prototype
4. Set up test environment
5. Begin phased migration

## Appendix: GitLens Current Capabilities

From GitLens source code analysis:
- ✅ Current branch name
- ✅ Current commit SHA
- ✅ File status (modified, staged, untracked, deleted)
- ✅ Renamed file tracking
- ✅ Commit details (with includeCommitDetails flag)
- ❌ Repository root discovery
- ❌ Remote information
- ❌ Branch listing
- ❌ Configuration reading
- ❌ Write operations