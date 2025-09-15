# Git Command Migration Plan - COMPLETED ✅

## ⚠️ NOTE: This migration has been completed with a different approach
**See [GIT_MIGRATION_COMPLETE.md](./GIT_MIGRATION_COMPLETE.md) for details**

Instead of migrating to simple-git as originally planned, we migrated to electron-cli-bridge to solve EBADF issues in Electron.

---

## Original Plan (For Historical Reference)
Migrating from raw `exec` commands to `simple-git` library to improve:
- Better error handling and Git detection
- Cleaner API with promises
- Automatic PATH resolution
- Better cross-platform support

## Files to Migrate

### Core Git Utilities (Priority 1)
1. **`src/main/utils/gitExecUtils.ts`**
   - Currently: Raw exec with manual PATH setup
   - Migration: Create singleton simple-git instance with proper configuration
   - Used by: Most Git operations

2. **`src/main/file-system/gitRepositoryService.ts`**
   - Currently: Wrapper around execGitCommand
   - Migration: Direct simple-git method calls
   - Methods to update:
     - `findGitRoot()` → `git.revparse(['--show-toplevel'])`
     - `getRepositoryInfo()` → `git.getRemotes(true)`
     - `execGitCommand()` → Remove, use simple-git directly
     - `isGitRepository()` → `git.checkIsRepo()`
     - `getGitStatus()` → `git.status()`
     - `stageFiles()` → `git.add(files)`
     - `createCommit()` → `git.commit(message)`
     - `getDetailedChanges()` → `git.diff(['--stat'])` + `git.diffSummary()`

### Git Handlers (Priority 2)
3. **`src/main/file-system/gitHandlers.ts`**
   - Currently: IPC handlers using GitRepositoryService
   - Migration: Update to use refactored GitRepositoryService
   - No direct changes needed if GitRepositoryService is properly refactored

### Version Control Providers (Priority 3)
4. **`src/main/version-control-providers/GitService.ts`**
   - Direct Git command execution
   - Needs full refactor to use simple-git

5. **`src/main/version-control-providers/gitBranchService.ts`**
   - Branch management operations
   - Refactor to use simple-git branch methods

### Other Files (Priority 4)
6. **`src/main/file-system/GitRepositoryWatcher.ts`**
7. **`src/main/initialization.ts`**
8. **`src/main/services/validation/LayerValidationService.ts`**
9. **`src/main/services/validation/DirectoryContextManager.ts`**

## Migration Strategy

### Phase 1: Core Infrastructure
1. Create new `GitClientFactory` to manage simple-git instances
2. Update `gitExecUtils.ts` to export simple-git instances
3. Add error handling wrapper for better error messages

### Phase 2: Service Layer
1. Refactor `GitRepositoryService` methods one by one
2. Maintain backward compatibility during transition
3. Add comprehensive error handling

### Phase 3: Handlers and Providers
1. Update all IPC handlers
2. Refactor version control providers
3. Update branch service

### Phase 4: Testing & Cleanup
1. Test all Git operations
2. Remove old exec-based code
3. Update documentation

## Simple-Git API Mapping

| Current Command | Simple-Git Method |
|-----------------|-------------------|
| `git status` | `git.status()` |
| `git add .` | `git.add('.')` |
| `git commit -m` | `git.commit(message)` |
| `git diff --stat` | `git.diffSummary()` |
| `git remote -v` | `git.getRemotes(true)` |
| `git rev-parse --show-toplevel` | `git.revparse(['--show-toplevel'])` |
| `git branch` | `git.branch()` |
| `git checkout` | `git.checkout()` |
| `git clone` | `git.clone()` |
| `git push` | `git.push()` |
| `git pull` | `git.pull()` |

## Error Handling Improvements

### Current Issues
- Generic "Git not found" errors
- PATH issues in packaged Electron apps
- Poor error context

### With simple-git
- Automatic Git detection
- Better error messages
- Retry logic built-in
- Cross-platform PATH handling

## Testing Checklist
- [ ] Git status detection
- [ ] File staging
- [ ] Commit creation
- [ ] Diff generation
- [ ] Remote operations
- [ ] Branch operations
- [ ] Repository detection
- [ ] Clone operations
- [ ] Error scenarios (no Git, no repo, etc.)