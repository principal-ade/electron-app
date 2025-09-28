# Codebase-Composition Library Usage Documentation

## Overview

This document details how the `@principal-ai/codebase-composition` library (v0.2.0) is used throughout our Electron application. The library provides core functionality for file system abstraction, package layer analysis, and type extraction capabilities.

**Total Files Using the Library**: 37 files across the codebase

## Core Features & Usage Patterns

### 1. Platform Adapter Pattern
**Purpose**: Abstract file system, Git, and shell operations across different platforms (Electron vs GitHub Web)

#### Key Interfaces Used
- `FileSystemAdapter` - File system operations interface
- `GitAdapter` - Git operations interface
- `ShellAdapter` - Shell command execution interface

#### Implementation Files

##### Electron Adapters
- `src/renderer/adapters/ElectronFileSystemAdapter.ts:1` - Implements FileSystemAdapter for local file system
- `src/renderer/adapters/ElectronGitAdapter.ts:1` - Implements GitAdapter for local Git operations
- `src/renderer/adapters/ElectronShellAdapter.ts:1` - Implements ShellAdapter for local shell execution
- `src/renderer/adapters/ElectronPlatformAdapters.ts` - Factory for Electron adapters

##### GitHub Web Adapters
- `src/renderer/adapters/github/GitHubFileSystemAdapter.ts:1` - Implements FileSystemAdapter using GitHub API
- `src/renderer/adapters/github/GitHubGitAdapter.ts:1` - Implements GitAdapter using GitHub API
- `src/renderer/adapters/github/GitHubShellAdapter.ts:1` - Implements ShellAdapter for GitHub context
- `src/renderer/adapters/GitHubWebAdapters.ts` - Factory for GitHub adapters

##### Source Abstraction
- `src/renderer/adapters/SourceFileSystemAdapter.ts:1` - Routes to correct adapter based on source type

### 2. File System Tree Management
**Purpose**: Build, cache, and manage file system trees for repositories

#### Core Modules Used
- `FileSystemModule` - Core module for building file trees with filtering
- `FilesystemService` - High-level service for file operations
- `FileSystemFilterLayer` - Type for filtering rules
- `FileTree` (from @principal-ai/repository-abstraction) - Tree structure type

#### Implementation Files
- `src/renderer/utils/loadFileSystemTree.ts:1-10` - Primary utility for loading trees from various sources
  - `loadLocalFileSystemTree()` - Load from local file system
  - `loadGitHubFileSystemTree()` - Load from GitHub API
  - `loadLocalGitCommitTree()` - Load from specific Git commit
- `src/renderer/services/RepositoryTreeCacheService.ts:1` - Caching layer for expensive tree operations
- `src/renderer/services/FileTreeSourceService.ts:2-6` - Manages multiple file tree sources
- `src/renderer/utils/loadFileSystemTree.test.ts` - Test coverage for tree loading

#### Usage Example
```typescript
const fileSystemModule = new FileSystemModule({
  directoryPath: options.localPath,
  buildFileSystemTree: async (path, filters) => {
    const { paths } = await FileSystemService.buildFilteredFileTree(path, {
      gitignore: true,
      includeStats: false,
    });
    return await transformPathsToFileTree(path, paths, filters);
  },
});
const result = await fileSystemModule.loadFileSystemTree();
```

### 3. Package Layer Analysis
**Purpose**: Discover and analyze package structures, dependencies, and configurations

#### Core Modules Used
- `PackageLayerModule` - Package discovery and analysis
- `PackageLayer` - Type representing package metadata and structure
- `PackageCommand` - Type for package scripts/commands

#### Implementation Files

##### Repository Management UI
- `src/renderer/pages/RepoManager/RepositoryManager.tsx:13-15` - Central orchestration of package discovery
- `src/renderer/pages/RepoManager/RepositoryMaintenanceView.tsx:22` - Maintenance operations on packages
- `src/renderer/pages/RepoManager/RepositoryExplorationView.tsx:14` - Package exploration interface
- `src/renderer/pages/RepoManager/RepositoryManagerHeader.tsx:46` - Header with package info display

##### Component Libraries
- `src/renderer/components/repository-maps/PackageCommandPanel.tsx:22` - Display and execute package commands
- `src/renderer/components/repository-maps/DependenciesPanel.tsx:22` - Visualize package dependencies
- `src/renderer/components/repository-maps/CloneManagementModal.tsx` - Clone management with package context

##### Processing & Validation
- `src/renderer/pages/RepoManager/shared/ProcessingPipelineModal.tsx:23` - Pipeline processing for packages
- `src/renderer/pages/RepoManager/shared/ProcessingDetailsModal.tsx:16` - Detailed processing view
- `src/renderer/pages/RepoManager/shared/ValidationsTab.tsx:15` - Package validation results
- `src/renderer/pages/RepoManager/shared/AgentSessionsTab.tsx:29` - Agent session management

#### Usage Example
```typescript
const packageModule = new PackageLayerModule();
const packageResult = await packageModule.discoverPackages(
  fileSystemTree,
  fileReader,
);
// Returns discovered packages with metadata, dependencies, and commands
```

### 4. Type Extraction System
**Purpose**: Extract TypeScript types and generate type definitions from packages

#### Core Types Used
- `ExtractedType` - Represents extracted TypeScript types
- `PackageTypes` - Package type information
- `TypeDefinitionLayer` - Type definition metadata

#### Implementation Files

##### Main Process Handlers
- `src/main/services/ipc/typeExtractionHandlers.ts:5` - IPC handlers for type extraction
- `src/window/main-process-api-implementations/typeExtractionApi.ts:6-10` - API implementation

##### Shared Interfaces
- `src/shared/main-process-api-interfaces/TypeExtractionAPI.ts:6` - Shared type extraction interface

#### Usage Example
```typescript
async extractPackageTypesFromLayer(
  packageLayer: PackageLayer,
  workingDirectory: string,
): Promise<PackageTypes> {
  // Extract types from a package layer
}
```

### 5. Quality Analysis Bridge
**Purpose**: Convert PackageLayer data to tool configurations for quality analysis

#### Implementation
- `src/main/quality-lenses/PackageLayerToToolConfigBridge.ts:7` - Bridge between package layers and quality tools

#### Key Functionality
- Analyzes ESLint configurations from package layers
- Converts package scripts to tool configurations
- Maps package structure to quality lens requirements

### 6. Package Manager Integration
**Purpose**: Interface with package managers for dependency operations

#### Implementation
- `src/renderer/providers/ElectronPackageManagerApiProvider.ts` - Package manager API provider

## Architecture Patterns

### Service Layer Architecture
```
┌─────────────────────────────────────┐
│         UI Components               │
│  (RepositoryManager, Panels, etc.)  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Service Layer               │
│  (FileTreeSourceService,            │
│   RepositoryTreeCacheService)       │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Adapter Layer                  │
│  (Platform-specific implementations) │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   @principal-ai/codebase-composition│
│      (Core functionality)           │
└─────────────────────────────────────┘
```

### Cross-Platform Support
The adapter pattern enables seamless operation across:
- **Local Development**: Using Electron IPC for file system access
- **Web Environment**: Using GitHub API for repository access
- **Hybrid Mode**: Supporting both local and remote repositories

### Caching Strategy
- File trees are cached in `RepositoryTreeCacheService`
- Package layers are cached after discovery
- Type extraction results are memoized

## Module Statistics

### Most Used Imports
1. `PackageLayer` type - 12 files
2. `FileSystemModule` - 6 files
3. `FileSystemAdapter` interface - 8 files
4. `FilesystemService` - 4 files

### Feature Coverage
- **File System Operations**: 14 files
- **Package Discovery**: 12 files
- **Type Extraction**: 3 files
- **Quality Analysis**: 1 file
- **UI Components**: 8 files

## Migration Notes (v0.1.0 → v0.2.0)

### Breaking Changes Fixed
1. **FileTree Structure**: Now requires `sha`, `root`, and `stats` properties
2. **FileInfo Type**: Added `relativePath` property, `lastModified` is now `Date` type
3. **DirectoryInfo Type**: Added `fileCount`, `totalSize`, `depth`, `relativePath`; removed `isDirectory`
4. **Removed Properties**: `includeVCS` option no longer exists in `LocalTreeOptions`

### Type Fixes Applied
- `src/renderer/utils/loadFileSystemTree.ts:245` - Changed `tree.paths` to `tree.allFiles`
- `src/renderer/utils/loadFileSystemTree.ts:349` - Removed `success` property check
- `src/renderer/utils/loadFileSystemTree.ts:402-425` - Updated FileTree construction
- `src/renderer/utils/loadFileSystemTree.test.ts` - Removed `includeVCS` from options
- `src/renderer/validation/runners/ESLintRunner.ts:111` - Removed invalid properties

## Future Considerations

### Potential Optimizations
1. Consider implementing lazy loading for large file trees
2. Add more granular caching for package layer discovery
3. Implement incremental type extraction for better performance

### Extension Points
1. Custom filter layers for specialized file tree filtering
2. Plugin system for additional package managers
3. Extended type extraction for other languages beyond TypeScript

## Related Documentation
- [Quality Hexagon Integration Plan](./quality-hexagon-integration-plan.md)
- [Bridge Report - Principal ADE Codebase Composition](../.bridge-report--principal-ade-codebase-composition.md)
- [Unified Secure Storage Plan](./UNIFIED_SECURE_STORAGE_PLAN.md)