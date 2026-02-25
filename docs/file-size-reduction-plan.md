# File Size Reduction Plan

## Overview

We are working toward a **1000 lines per file** limit across the codebase. Currently, the `max-lines` ESLint rule is set to **3000 lines** as a temporary measure while we migrate to TIPC. Linting is enforced as a **commit blocker**.

This allows us to:
1. Prevent new large files from being introduced
2. Gradually refactor existing large files through TIPC migration
3. Remove unused code during the migration process
4. Maintain code quality standards without blocking current development

## Current Status

- **ESLint errors**: 0 (after bumping to 3000)
- **TypeScript errors**: 0
- **ESLint warnings**: 0

### Files Requiring Attention

| File | Lines | Strategy |
|------|-------|----------|
| `src/main/version-control-providers/githubHandlers.ts` | 2950 | TIPC Migration |

## TIPC Migration Strategy

Instead of simply splitting `githubHandlers.ts`, we will migrate it to TIPC (type-safe IPC) following the pattern established by the terminal module. This achieves multiple goals:

1. **Type Safety** - End-to-end type safety between main and renderer
2. **Code Reduction** - TIPC routers are more concise than `ipcMain.handle`
3. **Dead Code Removal** - Verify each handler is used before migrating
4. **Better Architecture** - Cleaner separation of concerns

### Reference: Terminal TIPC Pattern

```
src/shared/tipc/terminalRouterTypes.ts   → Shared types (input/output)
src/main/terminal/tipc/terminalRouter.ts → Main process router
src/renderer/tipc/terminalClient.ts      → Renderer client
```

### Target: GitHub TIPC Structure

```
src/shared/tipc/githubRouterTypes.ts     → Shared types              ✅ CREATED
src/main/github/tipc/githubRouter.ts     → Main process router       ✅ CREATED
src/main/github/tipc/index.ts            → Exports                   ✅ CREATED
src/renderer/tipc/githubClient.ts        → Renderer client           ✅ CREATED
src/main/initialization.ts               → Router registration       ✅ UPDATED
```

The router is registered and ready. Next step is migrating renderer code to use `githubClient`.

## Migration Checklist

For **each** IPC handler in `githubHandlers.ts`, follow this process:

### 1. Verify Usage

Before migrating any handler, confirm it's actually used:

```bash
# Search for handler usage in renderer
grep -r "GitHubAPIEvent.HANDLER_NAME" src/renderer/
grep -r "GithubService.methodName" src/renderer/
```

**If not used → DELETE IT** (don't migrate dead code)

### 2. Handler Usage Audit (Completed 2026-02-25)

#### ❌ UNUSED - DELETE THESE (9 methods)

| Handler | Calls | Action |
|---------|-------|--------|
| `detectRepository` | 0 | DELETE |
| `fetchConfigFromGitHub` | 0 | DELETE |
| `fetchRemoteConfig` | 0 | DELETE |
| `getIssues` | 0 | DELETE |
| `getPullRequests` | 0 | DELETE |
| `createIssue` | 0 | DELETE |
| `checkAuthStatus` | 0 | DELETE |
| `getTokenScopes` | 0 | DELETE |
| `getRepositoryCommits` | 0 | DELETE |

#### ✅ USED - MIGRATE THESE (21 methods)

| Handler | Calls | TIPC Procedure | Renderer Migration |
|---------|-------|----------------|-------------------|
| `getUserOrganizations` | 4 | ✅ Created | Pending |
| `getCurrentUser` | 3 | ✅ Created | Pending |
| `installSkill` | 2 | ⚠️ TODO* | Pending |
| `createRepository` | 2 | ✅ Created | Pending |
| `getUserStarredRepositoriesForUser` | 1 | ✅ Created | Pending |
| `getUserStarredRepositories` | 1 | ✅ Created | Pending |
| `getUserSSHKeys` | 1 | ✅ Created | Pending |
| `getUserRepositories` | 1 | ✅ Created | Pending |
| `getUserOrganizationsForUser` | 1 | ✅ Created | Pending |
| `getUserFollowing` | 1 | ✅ Created | Pending |
| `getUserFollowers` | 1 | ✅ Created | Pending |
| `getUser` | 1 | ✅ Created | Pending |
| `getTree` | 1 | ✅ Created | Pending |
| `getTokenInfo` | 1 | ✅ Created | Pending |
| `getRepository` | 1 | ✅ Created | Pending |
| `getOrgRepositories` | 1 | ✅ Created | Pending |
| `getOrgMembers` | 1 | ✅ Created | Pending |
| `getLicenseTemplates` | 1 | ✅ Created | Pending |
| `getGitignoreTemplates` | 1 | ✅ Created | Pending |
| `getFileContent` | 1 | ✅ Created | Pending |
| `forkRepository` | 1 | ✅ Created | Pending |

*`installSkill` requires special handling - the logic is defined inline in `ipcMain.handle` rather than as a `GitHubAdapter` method. It needs to be extracted into a proper method before it can be migrated to TIPC.

### 3. Create TIPC Procedure

```typescript
// In githubRouter.ts
getUserRepositories: t.procedure
  .input<{ options?: RepositoryFetchOptions }>()
  .action(async ({ input }) => {
    return githubAdapter.getUserRepositories(input.options);
  }),
```

### 4. Update Renderer Client

```typescript
// In githubClient.ts
export const githubClient = createClient<GithubRouterType>(...)

// Usage
const repos = await githubClient.getUserRepositories({ options: { perPage: 100 } })
```

### 5. Remove Old Handler

Once the TIPC version is working, remove the `ipcMain.handle` version.

## Files Overview

### TIPC Infrastructure (New)

```
src/shared/tipc/githubRouterTypes.ts      → Shared input/output types
src/main/github/tipc/githubRouter.ts      → Main process router (calls GitHubAdapter)
src/main/github/tipc/index.ts             → Exports
src/renderer/tipc/githubClient.ts         → Renderer client (type-safe proxy)
```

### Business Logic (Existing)

```
src/main/version-control-providers/github/
├── types.ts      → Keep (useful for business logic types)
├── apiCore.ts    → Keep (core API functionality)
├── repository.ts → Keep (business logic, not IPC)
```

The business logic files are still useful - only the IPC layer changes with TIPC.

## Roadmap

| Phase | Target | max-lines | Notes |
|-------|--------|-----------|-------|
| Current | TIPC infrastructure | 3000 | ✅ Router + client created |
| Phase 1 | Migrate renderer | 3000 | Update GithubService to use TIPC client |
| Phase 2 | Remove legacy handlers | 2500 | Delete ipcMain.handle code |
| Phase 3 | No files > 2000 | 2000 | Continue other files |
| Phase 4 | No files > 1500 | 1500 | |
| Phase 5 | No files > 1000 | 1000 | Target |

## Enforcement

Linting is enforced as a **commit blocker** via the pre-commit hook:

```bash
# .husky/pre-commit
npm run typecheck
npm run lint
```

This ensures:
- No new TypeScript errors can be committed
- No new ESLint violations can be committed
- File size limits are enforced

## Dead Code Removal Opportunities

During TIPC migration, actively look for:

1. **Unused IPC handlers** - Handlers with no renderer callers
2. **Duplicate functionality** - Similar methods that can be consolidated
3. **Legacy fallbacks** - Old CLI fallbacks that may no longer be needed
4. **Unused types** - Types defined but never imported
5. **Console.log statements** - Debug logging that should be removed

Use `knip` to find unused exports:

```bash
npx knip
```
