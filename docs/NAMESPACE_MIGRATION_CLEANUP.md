# Namespace Migration Cleanup Progress

This document tracks the cleanup of linting and TypeScript issues in files affected by the namespace migration from `@a24z` to `@principal-ai` and `@principal-ade`.

## Migration Summary

### Completed Migrations
- ✅ `@a24z/core-library` → `@principal-ai/alexandria-core-library` (v0.1.36)
- ✅ `@a24z/dynamic-file-tree` → `@principal-ade/dynamic-file-tree` (v0.1.27)
- ✅ `@a24z/panels` → `@principal-ade/panels` (v1.0.39)
- ✅ `@a24z/markdown-search` → `@principal-ai/markdown-search` (v2.0.7)

### Import Path Updates
- ✅ `NodeFileSystemAdapter` now imports from `@principal-ai/alexandria-core-library/node`
- ✅ Renderer imports use `/types` export for type-only imports where applicable

## Files Requiring Cleanup

### High Priority - Files with Import Changes

#### Main Process Files (6 files)
All these files had `NodeFileSystemAdapter` import updates and need to be lint/typecheck clean:

- [ ] `src/main/drawings/excalidrawHandlers.ts`
- [ ] `src/main/stores/a24zHandler.ts`
- [ ] `src/main/palace-tasks/palaceTasksHandlers.ts`
- [ ] `src/main/principal-mcp/repositoryNoteHandler.ts`
- [ ] `src/main/principal-mcp/PrincipalMCPBridge.ts`
- [ ] `src/main/stores/AlexandriaRegistryService.ts`

#### Renderer Process Files - alexandria-core-library (27 files)
Files using `@principal-ai/alexandria-core-library/types`:

- [ ] `src/renderer/contexts/PanelContext.tsx`
- [ ] `src/renderer/contexts/WorkspaceFilterContext.tsx`
- [ ] `src/renderer/main-process-api/WorkspaceService.ts`
- [ ] `src/renderer/principal-window/views/FeedView/FeedView.tsx`
- [ ] `src/renderer/main-process-api/AlexandriaService.ts`
- [ ] `src/renderer/main-process-api/AlexandriaDocsService.ts`
- [ ] `src/renderer/main-process-api/WindowService.ts`
- [ ] `src/renderer/repo-manager/shared/AlexandriaDocsPanel.tsx`
- [ ] `src/renderer/repo-manager/shared/MarkdownSearchPanel.tsx`
- [ ] `src/renderer/alexandria-workspace/AlexandriaWorkspaceLayout.tsx`
- [ ] `src/renderer/panels/components/DeleteAlexandriaEntryModal.tsx`
- [ ] `src/renderer/alexandria-workspace/AlexandriaWorkspaceApp.tsx`
- [ ] `src/renderer/panels/components/WorkspaceEntriesPanel.tsx`
- [ ] `src/renderer/services/WorkspaceDependencyGraphService.ts`
- [ ] `src/renderer/components/GitCloneModal.tsx`
- [ ] `src/renderer/panels/components/WorkspacesListPanel.tsx`
- [ ] `src/renderer/hooks/useRepositoryData.ts`
- [ ] `src/renderer/panels/components/CarouselTerminalPanel.tsx`
- [ ] `src/renderer/panels/components/AgentSessionsPanel.tsx`
- [ ] `src/renderer/panels/components/TabbedTerminalPanel.tsx`
- [ ] `src/renderer/panels/components/LocalProjectCard.tsx`
- [ ] `src/renderer/panels/components/GitHubRepositoryCard.tsx`
- [ ] `src/renderer/panels/components/AddRepositoryToWorkspaceModal.tsx`
- [ ] `src/renderer/principal-window/views/Settings/components/WorkspaceSettings.tsx`
- [ ] `src/renderer/components/Titlebar/AlexandriaWorkspaceTitlebar.tsx`

#### Renderer Process Files - dynamic-file-tree (4 files)
Files using `@principal-ade/dynamic-file-tree`:

- [x] `src/renderer/panels/components/FileTreeTab.tsx` ✅ Clean
- [x] `src/renderer/panels/components/GitChangesPanel.tsx` ✅ Clean
- [x] `src/renderer/panels/components/AgentContextTreePanel.tsx` ✅ Clean
- [x] `src/renderer/repo-manager/shared/CodebaseViewFileTree.tsx` ✅ Clean

#### Renderer Process Files - panels (10 files)
Files using `@principal-ade/panels`:

- [ ] `src/shared/types/userPreferences.types.ts`
- [ ] `src/renderer/services/WorkspaceLayoutService.ts`
- [ ] `src/renderer/repo-manager/RepositoryWorkspace.tsx`
- [ ] `src/renderer/repo-manager/RepositoryWorkspacePanelFramework.tsx`
- [ ] `src/renderer/pages/LandingPage/AgentConfigurationView/DetailedConfigurationView.tsx`
- [ ] `src/renderer/pages/StoreViewer.tsx`
- [ ] `src/renderer/panels/components/CarouselTerminalPanel.tsx` (also uses alexandria-core-library)
- [ ] `src/renderer/repo-manager/shared/PanelConfiguratorModal.tsx`
- [ ] `src/renderer/principal-window/views/FeedView/FeedView.tsx` (also uses alexandria-core-library)
- [ ] `src/renderer/principal-window/views/TerminalManager/TerminalManager.tsx`

#### Main/Shared Process Files - markdown-search (6 files)
Files using `@principal-ai/markdown-search`:

- [ ] `src/main/services/DocumentIndexingService.ts`
- [ ] `src/shared/ipc/DocumentSearchIPC.ts`
- [ ] `src/renderer/services/DocumentSearchService.ts`
- [ ] `src/renderer/principal-window/views/MarkdownSearch/components/DocumentSearchResults.tsx`
- [ ] `src/renderer/principal-window/views/MarkdownSearch/components/DocumentViewer.tsx`
- [ ] `src/renderer/principal-window/views/MarkdownSearch/MarkdownSearch.tsx`

## Cleanup Commands

### Check Specific File
```bash
# Lint check
npx eslint <file-path>

# TypeScript check
npx tsc --noEmit <file-path>
```

### Check All Migration Files
```bash
# Main process files
npx eslint \
  src/main/drawings/excalidrawHandlers.ts \
  src/main/stores/a24zHandler.ts \
  src/main/palace-tasks/palaceTasksHandlers.ts \
  src/main/principal-mcp/repositoryNoteHandler.ts \
  src/main/principal-mcp/PrincipalMCPBridge.ts \
  src/main/stores/AlexandriaRegistryService.ts

# Markdown search files
npx eslint \
  src/main/services/DocumentIndexingService.ts \
  src/shared/ipc/DocumentSearchIPC.ts \
  src/renderer/services/DocumentSearchService.ts
```

## Cleanup Guidelines

### Pre-existing Issues Policy
**All issues must be fixed, regardless of whether they're pre-existing or introduced by the migration.**

This ensures:
- Files with changed imports are fully clean
- No technical debt accumulates around migrated code
- Future migrations have clean baseline files to work with

### Common Issues to Address

1. **Unused Variables**
   - Remove if truly unused
   - Prefix with `_` only if required by interface but intentionally unused

2. **Console Statements**
   - Remove debug `console.log`
   - Keep only `console.warn`, `console.error`, `console.info` for important messages

3. **Type Safety**
   - Replace `any` with proper types
   - Use type guards for runtime checks
   - Add proper type annotations

4. **Empty Functions**
   - Add `@typescript-eslint/no-empty-function` disable comment if intentional
   - Or add implementation if stub

## Progress Tracking

### Statistics
- **Total Files**: 53
- **Completed**: 4 (7.5%)
- **Remaining**: 49 (92.5%)

### By Category
- **Main Process**: 0/6 (0%)
- **Renderer - alexandria-core-library**: 0/27 (0%)
- **Renderer - dynamic-file-tree**: 4/4 (100%) ✅
- **Renderer - panels**: 0/10 (0%)
- **Renderer - markdown-search**: 0/6 (0%)

## Commit Strategy

As files are cleaned up, commit them in logical groups:
- Main process files together
- Renderer files by migration package
- Document any significant fixes or patterns discovered

Example commit message:
```
chore: clean up lint/typecheck issues in alexandria-core-library migration files

- Fixed unused variable issues in PanelContext.tsx
- Replaced console.log with console.info in WorkspaceService.ts
- Added proper type annotations in AlexandriaService.ts

All files now pass lint and typecheck with zero errors/warnings.
```
