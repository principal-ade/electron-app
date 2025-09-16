# FileTree Anti-Pattern Refactoring Guide

## Problem Summary

Multiple components are incorrectly traversing FileTree structures to find files, when the FileTree object already contains a flat list of relative paths that can be searched directly. Additionally, some components are manually searching for package.json files when there's a dedicated library for package management.

## Anti-Pattern #1: Complex FileTree Traversal for README Files

### Affected Components:
1. **LocalDevelopmentView.tsx** (lines 488-530)
   - Creates `findRootReadmePath` function that checks three different structures
   - Loads README content that is never actually used in the UI
   - Status: **Dead code** - README content is loaded into `_readmeContent` state but never rendered

2. **RepositoryExplorationView.tsx** (lines 515-560)
   - Similar `findRootReadmePath` function with complex traversal
   - Actually uses README content to display in markdown viewer
   - Status: **Active code** - Renders README in the UI

### Current Anti-Pattern:
```typescript
// DON'T DO THIS - Complex traversal with type mismatches
const findRootReadmePath = (tree: { files?: Array<{ name?: string; path?: string }> }): string | null => {
  // Check files array at root
  if (Array.isArray(tree.files)) { /* ... */ }
  // Check children for root-level files
  if ('children' in tree && tree.children) { /* ... */ }
  // Check allFiles for root-level README
  if ('allFiles' in tree && tree.allFiles) { /* ... */ }
  return null;
};
```

### Correct Approach:
```typescript
// DO THIS - Direct search in the files list
const findReadmeFile = (fileTree: FileTree): string | null => {
  // FileTree should have a list of all file paths
  const files = fileTree.getAllFiles(); // or fileTree.files depending on actual API
  return files.find(path => /^readme(\.[^/]*)?$/i.test(path.split('/').pop())) || null;
};
```

## Anti-Pattern #2: Manual package.json Highlighting

### Affected Components:
1. **RepositoryExplorationView.tsx** (lines 283-286, 422-424, 473-475)
   - Manually creates highlight layers for package.json files
   - Should use package library data

2. **RepositoryMaintenanceView.tsx** (lines 422-424, 447-449, 472-474)
   - Similar manual highlighting of package.json files
   - Should leverage existing package detection

### Current Anti-Pattern:
```typescript
// DON'T DO THIS - Manual package.json path construction
items: [
  { path: packagePath, type: 'directory' as const },
  { path: packagePath + '/package.json', type: 'file' as const }
]
```

### Correct Approach:
```typescript
// DO THIS - Use package library data
// Packages should already be identified by a package detection library
const packageHighlights = packageLayers.map(pkg => ({
  path: pkg.path,
  type: pkg.type
}));
```

## Anti-Pattern #3: Theme File Loading

### Affected Component:
- **LocalDevelopmentView.tsx** (lines 574-598)
  - Loads `.specktor/docs_theme.json` directly from filesystem
  - This should probably be handled by a theme service

## Refactoring Priority

### High Priority (Breaking TypeScript):
1. **LocalDevelopmentView.tsx line 530** - FileTree type mismatch
2. **RepositoryExplorationView.tsx line 549** - FileTree type mismatch

### Medium Priority (Code Smell):
1. Package.json manual searching in visualization layers
2. Dead README loading code in LocalDevelopmentView

### Low Priority (Architectural):
1. Theme loading should be in a service
2. Consider if README loading belongs in these views at all

## Recommended Actions

1. **Immediate Fix**: 
   - Remove the complex `findRootReadmePath` functions
   - Use the FileTree's actual API to get file lists
   - Simply search the flat list for README patterns

2. **Dead Code Removal**:
   - Remove README loading from LocalDevelopmentView since it's never used
   - Or complete the feature if it was intended to be displayed

3. **Use Package Library**:
   - Replace manual package.json path construction with data from the package detection library
   - PackageLayer data should already contain the necessary paths

4. **Service Extraction**:
   - Move theme loading to a dedicated theme service
   - Move README loading to a documentation service if multiple views need it

## Implementation Notes

The FileTree type from core-lib should have:
- A method or property to get all file paths as a flat list
- These paths should be relative from the tree root
- No complex traversal should be needed - just filter/find operations on the list

Example of what should work:
```typescript
// Assuming FileTree has something like this
interface FileTree {
  files: string[]; // or getAllFiles(): string[]
  // ... other properties
}

// Then finding files becomes trivial
const readmePath = fileTree.files.find(f => /readme\.md$/i.test(f));
const packageJsonPaths = fileTree.files.filter(f => f.endsWith('/package.json'));
```